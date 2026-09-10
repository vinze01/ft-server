import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Account, AccountTransfer } from '../models';

const API_URL = 'http://localhost:3001/api';

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
      
      const existingAccounts = await Account.findAll({
        where: { userId: (req as any).userId, isActive: true }
      });
      
      const isDefault = existingAccounts.length === 0;
      
      const account = await Account.create({
        userId: (req as any).userId,
        name,
        type: type || 'bank',
        balance: balance || 0,
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
      
      const fromAccount = await Account.findOne({
        where: { id: fromAccountId, userId: (req as any).userId }
      });
      const toAccount = await Account.findOne({
        where: { id: toAccountId, userId: (req as any).userId }
      });
      
      if (!fromAccount || !toAccount) {
        return res.status(404).json({ success: false, error: 'Account not found' });
      }
      
      const amountNum = parseFloat(amount.toString());
      const feeNum = parseFloat(fee.toString());
      const totalAmount = amountNum + feeNum;
      
      const fromBalance = parseFloat(fromAccount.balance.toString());
      if (fromBalance < totalAmount) {
        return res.status(400).json({ 
          success: false, 
          error: 'Insufficient funds' 
        });
      }
      
      const transfer = await AccountTransfer.create({
        userId: (req as any).userId,
        fromAccountId,
        toAccountId,
        amount: amountNum,
        fee: feeNum,
        note
      });
      
      await fromAccount.update({ balance: fromBalance - totalAmount });
      await toAccount.update({ 
        balance: parseFloat(toAccount.balance.toString()) + amountNum 
      });
      
      return res.status(201).json({ success: true, data: transfer });
    } catch (error: any) {
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