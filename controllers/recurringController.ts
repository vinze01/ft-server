import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { RecurringTransaction, Income, Expense, Account } from '../models';
import sequelize from '../config/database';

const RECURRING_TYPES = ['income', 'expense'];
const FREQUENCIES = ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'];

/**
 * Add months without day-of-month overflow: Jan 31 + 1 month must land on
 * Feb 28/29, not skip into March. Optionally snaps to a specific day.
 */
function addMonthsClamped(fromDate: Date, months: number, dayOfMonth?: number): Date {
  const target = new Date(fromDate.getFullYear(), fromDate.getMonth() + months, 1);
  const wantedDay = dayOfMonth || fromDate.getDate();
  const lastDayOfTarget = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(wantedDay, lastDayOfTarget));
  // Preserve the original time-of-day.
  target.setHours(fromDate.getHours(), fromDate.getMinutes(), fromDate.getSeconds(), fromDate.getMilliseconds());
  return target;
}

class RecurringController {
  async getAll(req: Request, res: Response) {
    try {
      const { type, isActive } = req.query;
      const where: any = { userId: (req as any).userId };
      
      if (type) where.type = type;
      if (isActive !== undefined) where.isActive = isActive === 'true';
      
      const recurring = await RecurringTransaction.findAll({
        where,
        order: [['nextExecution', 'ASC']]
      });
      
      return res.json({ success: true, data: recurring });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async getOne(req: Request, res: Response) {
    try {
      const recurring = await RecurringTransaction.findOne({
        where: { id: req.params.id, userId: (req as any).userId }
      });
      
      if (!recurring) {
        return res.status(404).json({ success: false, error: 'Recurring transaction not found' });
      }
      
      return res.json({ success: true, data: recurring });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const {
        type, amount, categoryId, accountId, description,
        frequency, startDate, endDate, executionDay,
        autoGenerate, reminderDaysBefore
      } = req.body;

      if (!type || !RECURRING_TYPES.includes(type)) {
        return res.status(400).json({ success: false, error: 'Invalid transaction type' });
      }
      if (!FREQUENCIES.includes(frequency)) {
        return res.status(400).json({ success: false, error: 'Invalid frequency' });
      }
      const parsedAmount = Number(amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ success: false, error: 'Amount must be a positive number' });
      }
      if (!startDate || isNaN(new Date(startDate).getTime())) {
        return res.status(400).json({ success: false, error: 'A valid start date is required' });
      }
      if (accountId) {
        // The account to be debited/credited must belong to the caller.
        const account = await Account.findOne({
          where: { id: accountId, userId: (req as any).userId }
        });
        if (!account) {
          return res.status(400).json({ success: false, error: 'Account not found' });
        }
      }

      const start = new Date(startDate);
      const nextExecution = this.calculateNextExecution(
        start, frequency, executionDay
      );

      const recurring = await RecurringTransaction.create({
        userId: (req as any).userId,
        type,
        amount: parsedAmount,
        categoryId,
        accountId,
        description,
        frequency,
        startDate: start,
        endDate: endDate ? new Date(endDate) : undefined,
        nextExecution,
        executionDay: executionDay || start.getDate(),
        autoGenerate: autoGenerate !== false,
        reminderDaysBefore: reminderDaysBefore || 0
      });

      return res.status(201).json({ success: true, data: recurring });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const recurring = await RecurringTransaction.findOne({
        where: { id: req.params.id, userId: (req as any).userId }
      });
      
      if (!recurring) {
        return res.status(404).json({ success: false, error: 'Recurring transaction not found' });
      }
      
      const { 
        type, amount, categoryId, accountId, description,
        frequency, startDate, endDate, executionDay,
        autoGenerate, reminderDaysBefore, isActive
      } = req.body;

      if (type !== undefined && !RECURRING_TYPES.includes(type)) {
        return res.status(400).json({ success: false, error: 'Invalid transaction type' });
      }
      if (frequency !== undefined && !FREQUENCIES.includes(frequency)) {
        return res.status(400).json({ success: false, error: 'Invalid frequency' });
      }
      if (amount !== undefined && (!Number.isFinite(Number(amount)) || Number(amount) <= 0)) {
        return res.status(400).json({ success: false, error: 'Amount must be a positive number' });
      }
      if (startDate !== undefined && isNaN(new Date(startDate).getTime())) {
        return res.status(400).json({ success: false, error: 'A valid start date is required' });
      }
      if (accountId !== undefined && accountId !== null) {
        const account = await Account.findOne({
          where: { id: accountId, userId: (req as any).userId }
        });
        if (!account) {
          return res.status(400).json({ success: false, error: 'Account not found' });
        }
      }
      
      let nextExecution = recurring.nextExecution;
      if (frequency || executionDay) {
        nextExecution = this.calculateNextExecution(
          new Date(startDate || recurring.startDate),
          frequency || recurring.frequency,
          executionDay || recurring.executionDay
        );
      }
      
      await recurring.update({
        type: type || recurring.type,
        amount: amount !== undefined ? Number(amount) : recurring.amount,
        categoryId: categoryId !== undefined ? categoryId : recurring.categoryId,
        accountId: accountId !== undefined ? accountId : recurring.accountId,
        description: description !== undefined ? description : recurring.description,
        frequency: frequency || recurring.frequency,
        startDate: startDate ? new Date(startDate) : recurring.startDate,
        endDate: endDate ? new Date(endDate) : recurring.endDate,
        nextExecution,
        executionDay: executionDay || recurring.executionDay,
        autoGenerate: autoGenerate !== undefined ? autoGenerate : recurring.autoGenerate,
        reminderDaysBefore: reminderDaysBefore !== undefined ? reminderDaysBefore : recurring.reminderDaysBefore,
        isActive: isActive !== undefined ? isActive : recurring.isActive
      });
      
      return res.json({ success: true, data: recurring });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const recurring = await RecurringTransaction.findOne({
        where: { id: req.params.id, userId: (req as any).userId }
      });
      
      if (!recurring) {
        return res.status(404).json({ success: false, error: 'Recurring transaction not found' });
      }
      
      await recurring.destroy();
      return res.json({ success: true, message: 'Recurring transaction deleted' });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async execute(req: Request, res: Response) {
    try {
      const recurring = await RecurringTransaction.findOne({
        where: { id: req.params.id, userId: (req as any).userId }
      });

      if (!recurring) {
        return res.status(404).json({ success: false, error: 'Recurring transaction not found' });
      }

      const executeDate = req.body.executeDate
        ? new Date(req.body.executeDate)
        : new Date();

      // The linked account must belong to the caller — recurring.accountId
      // is user-supplied data and previously allowed crediting/debiting
      // another user's account.
      let account: Account | null = null;
      if (recurring.accountId) {
        account = await Account.findOne({
          where: { id: recurring.accountId, userId: (req as any).userId }
        });
        if (!account) {
          return res.status(400).json({ success: false, error: 'Linked account not found' });
        }
      }

      // Transaction + row lock: the transaction row, balance update, and
      // schedule advance must all commit together or not at all.
      const result = await sequelize.transaction(async (t) => {
        let transaction;
        if (recurring.type === 'income') {
          // Book the income into the period it was executed for, not
          // unconditionally "now".
          const incomeData = {
            userId: (req as any).userId,
            amount: recurring.amount,
            type: 'monthly' as const,
            year: executeDate.getFullYear(),
            month: executeDate.toLocaleString('default', { month: 'long' }),
            categoryId: recurring.categoryId,
            accountId: recurring.accountId,
            note: recurring.description || 'Recurring income'
          };
          transaction = await Income.create(incomeData as any, { transaction: t });
        } else {
          const expenseData = {
            userId: (req as any).userId,
            description: recurring.description || 'Recurring expense',
            amount: recurring.amount,
            category: req.body.category || 'General',
            date: executeDate,
            accountId: recurring.accountId,
            note: recurring.description
          };
          transaction = await Expense.create(expenseData as any, { transaction: t });
        }

        if (account) {
          const balance = parseFloat(account.balance.toString());
          const amount = parseFloat(recurring.amount.toString());
          const newBalance = recurring.type === 'income' ? balance + amount : balance - amount;
          await account.update(
            // Row is already locked via findOne(..., lock) inside this
            // transaction; instance.update accepts no lock option.
            { balance: Math.round(newBalance * 100) / 100 },
            { transaction: t }
          );
        }

        const nextExecution = this.calculateNextExecution(
          executeDate,
          recurring.frequency,
          recurring.executionDay
        );

        await recurring.update({
          lastExecutedAt: executeDate,
          nextExecution
        }, { transaction: t });

        return transaction;
      });

      return res.json({
        success: true,
        data: {
          transactionId: result.id,
          message: 'Transaction created successfully'
        }
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async getUpcoming(req: Request, res: Response) {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + days);
      
      const recurring = await RecurringTransaction.findAll({
        where: {
          userId: (req as any).userId,
          isActive: true,
          nextExecution: { [Op.lte]: endDate }
        },
        order: [['nextExecution', 'ASC']]
      });
      
      const grouped: Record<string, any> = {};
      recurring.forEach(r => {
        // nextExecution is DATEONLY, so Sequelize returns it as a
        // 'YYYY-MM-DD' string — Date methods like toISOString() don't exist.
        const dateKey = String(r.nextExecution).split('T')[0];
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        grouped[dateKey].push(r);
      });
      
      return res.json({ success: true, data: grouped });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  private calculateNextExecution(
    fromDate: Date,
    frequency: string,
    dayOfMonth?: number
  ): Date {
    switch (frequency) {
      case 'daily':
        return new Date(fromDate.getTime() + 24 * 60 * 60 * 1000);
      case 'weekly':
        return new Date(fromDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      case 'biweekly':
        return new Date(fromDate.getTime() + 14 * 24 * 60 * 60 * 1000);
      case 'monthly':
        // Clamp to month length so Jan 31 + 1 month = Feb 28, not Mar 3.
        return addMonthsClamped(fromDate, 1, dayOfMonth);
      case 'quarterly':
        return addMonthsClamped(fromDate, 3, dayOfMonth);
      case 'yearly': {
        // Preserve month + day, clamping Feb 29 to Feb 28 in non-leap years.
        const next = new Date(fromDate);
        next.setFullYear(next.getFullYear() + 1);
        const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
        next.setDate(Math.min(dayOfMonth || fromDate.getDate(), lastDay));
        return next;
      }
      default:
        // Unknown frequency: advance one month rather than returning the
        // same date (which would allow same-day re-execution loops).
        return addMonthsClamped(fromDate, 1, dayOfMonth);
    }
  }
}

export default new RecurringController();