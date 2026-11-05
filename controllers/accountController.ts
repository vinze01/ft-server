import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Account, AccountTransfer } from '../models';
import sequelize from '../config/database';

const ACCOUNT_TYPES = ['cash', 'bank', 'e_wallet', 'credit_card', 'investment'];

class AccountController {
  async getAll(req: Request, res: Response) {
    try {
      const accounts = await Account.findAll({
        where: { userId: (req as any).userId, isActive: true },
        order: [['createdAt', 'DESC']]
      });
      return res.json({ success: true, data: accounts });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async getOne(req: Request, res: Response) {
    try {
      const account = await Account.findOne({
        where: { id: req.params.id, userId: (req as any).userId }
      });
      if (!account) {
        return res.status(404).json({ success: false, error: 'Account not found' });
      }
      return res.json({ success: true, data: account });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const { name, type, balance, currency, color, icon } = req.body;

      if (!name || !String(name).trim()) {
        return res.status(400).json({ success: false, error: 'Account name is required' });
      }
      if (type !== undefined && !ACCOUNT_TYPES.includes(type)) {
        // The DB column is an ENUM — without this check an invalid type
        // surfaced as a raw 500 from PostgreSQL.
        return res.status(400).json({ success: false, error: 'Invalid account type' });
      }
      if (balance !== undefined && balance !== null && !Number.isFinite(Number(balance))) {
        return res.status(400).json({ success: false, error: 'Balance must be a number' });
      }

      const existingAccounts = await Account.findAll({
        where: { userId: (req as any).userId, isActive: true }
      });
      
      const isDefault = existingAccounts.length === 0;
      
      const account = await Account.create({
        userId: (req as any).userId,
        name,
        type: type || 'bank',
        balance: balance !== undefined && balance !== null ? Number(balance) : 0,
        currency: currency || 'USD',
        color,
        icon,
        isDefault
      });
      
      return res.status(201).json({ success: true, data: account });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const account = await Account.findOne({
        where: { id: req.params.id, userId: (req as any).userId }
      });
      
      if (!account) {
        return res.status(404).json({ success: false, error: 'Account not found' });
      }
      
      const { name, type, balance, currency, color, icon, isDefault } = req.body;

      if (name !== undefined && !String(name).trim()) {
        return res.status(400).json({ success: false, error: 'Account name cannot be empty' });
      }
      if (type !== undefined && !ACCOUNT_TYPES.includes(type)) {
        return res.status(400).json({ success: false, error: 'Invalid account type' });
      }
      if (balance !== undefined && balance !== null && !Number.isFinite(Number(balance))) {
        return res.status(400).json({ success: false, error: 'Balance must be a number' });
      }

      if (isDefault) {
        await Account.update(
          { isDefault: false },
          { where: { userId: (req as any).userId, isDefault: true } }
        );
      }
      
      await account.update({
        name: name || account.name,
        type: type || account.type,
        balance: balance !== undefined ? balance : account.balance,
        currency: currency || account.currency,
        color: color || account.color,
        icon: icon || account.icon,
        isDefault: isDefault !== undefined ? isDefault : account.isDefault
      });
      
      return res.json({ success: true, data: account });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const account = await Account.findOne({
        where: { id: req.params.id, userId: (req as any).userId }
      });
      
      if (!account) {
        return res.status(404).json({ success: false, error: 'Account not found' });
      }
      
      if (parseFloat(account.balance.toString()) !== 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'Cannot delete account with balance. Transfer funds first.' 
        });
      }
      
      await account.update({ isActive: false });
      return res.json({ success: true, message: 'Account deleted' });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async getSummary(req: Request, res: Response) {
    try {
      const accounts = await Account.findAll({
        where: { userId: (req as any).userId, isActive: true }
      });
      
      const totalBalance = accounts.reduce((sum, acc) => {
        return sum + parseFloat(acc.balance.toString());
      }, 0);
      
      const byType: Record<string, number> = {};
      accounts.forEach(acc => {
        byType[acc.type] = (byType[acc.type] || 0) + parseFloat(acc.balance.toString());
      });
      
      return res.json({ 
        success: true, 
        data: { totalBalance, byType, accountCount: accounts.length } 
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async transfer(req: Request, res: Response) {
    try {
      const { fromAccountId, toAccountId, amount, fee = 0, note } = req.body;

      if (fromAccountId === toAccountId) {
        return res.status(400).json({
          success: false,
          error: 'Cannot transfer to the same account'
        });
      }

      const amountNum = Number(amount);
      const feeNum = Number(fee);
      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        return res.status(400).json({ success: false, error: 'Amount must be a positive number' });
      }
      if (!Number.isFinite(feeNum) || feeNum < 0) {
        return res.status(400).json({ success: false, error: 'Fee must be zero or a positive number' });
      }
      const totalAmount = amountNum + feeNum;

      // Transaction + row locks: both balance reads and writes happen inside
      // one transaction with the rows locked, so concurrent transfers can't
      // read the same starting balance (lost update) and a mid-flight crash
      // can't leave money created or destroyed.
      await sequelize.transaction(async (t) => {
        const fromAccount = await Account.findOne({
          where: { id: fromAccountId, userId: (req as any).userId },
          transaction: t,
          lock: t.LOCK.UPDATE
        });
        const toAccount = await Account.findOne({
          where: { id: toAccountId, userId: (req as any).userId },
          transaction: t,
          lock: t.LOCK.UPDATE
        });

        if (!fromAccount || !toAccount) {
          throw Object.assign(new Error('Account not found'), { statusCode: 404 });
        }

        const fromBalance = parseFloat(fromAccount.balance.toString());
        if (fromBalance < totalAmount) {
          throw Object.assign(new Error('Insufficient funds'), { statusCode: 400 });
        }

        await AccountTransfer.create({
          userId: (req as any).userId,
          fromAccountId,
          toAccountId,
          amount: amountNum,
          fee: feeNum,
          note
        }, { transaction: t });

        // Round to cents before persisting — JS float math on DECIMAL
        // balances must not accumulate binary artifacts.
        const newFrom = Math.round((fromBalance - totalAmount) * 100) / 100;
        const newTo = Math.round(
          (parseFloat(toAccount.balance.toString()) + amountNum) * 100
        ) / 100;

        await fromAccount.update({ balance: newFrom }, { transaction: t });
        await toAccount.update({ balance: newTo }, { transaction: t });
      });

      return res.status(201).json({ success: true, data: { fromAccountId, toAccountId, amount: amountNum, fee: feeNum, note } });
    } catch (error: any) {
      if (error?.statusCode) {
        return res.status(error.statusCode).json({ success: false, error: error.message });
      }
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async getTransfers(req: Request, res: Response) {
    try {
      const { fromDate, toDate, accountId } = req.query;
      
      const where: any = { userId: (req as any).userId };
      
      if (accountId) {
        where[Op.or] = [
          { fromAccountId: accountId },
          { toAccountId: accountId }
        ];
      }
      
      if (fromDate || toDate) {
        where.createdAt = {};
        if (fromDate) where.createdAt[Op.gte] = new Date(fromDate as string);
        if (toDate) where.createdAt[Op.lte] = new Date(toDate as string);
      }
      
      const transfers = await AccountTransfer.findAll({
        where,
        include: ['fromAccount', 'toAccount'],
        order: [['createdAt', 'DESC']],
        limit: 100
      });
      
      return res.json({ success: true, data: transfers });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}

export default new AccountController();