import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { RecurringTransaction, Income, Expense, Account } from '../models';

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
      
      const start = new Date(startDate);
      const nextExecution = this.calculateNextExecution(
        start, frequency, executionDay
      );
      
      const recurring = await RecurringTransaction.create({
        userId: (req as any).userId,
        type,
        amount,
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
        amount: amount || recurring.amount,
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
      
      let transaction;
      if (recurring.type === 'income') {
        const incomeData = {
          userId: (req as any).userId,
          amount: recurring.amount,
          type: 'monthly' as const,
          year: new Date().getFullYear(),
          month: new Date().toLocaleString('default', { month: 'long' }),
          categoryId: recurring.categoryId,
          accountId: recurring.accountId,
          note: recurring.description || 'Recurring income'
        };
        transaction = await Income.create(incomeData as any);
      } else {
        const expenseData = {
          userId: (req as any).userId,
          description: recurring.description || 'Recurring expense',
          amount: recurring.amount,
          category: 'General',
          date: executeDate,
          accountId: recurring.accountId,
          note: recurring.description
        };
        transaction = await Expense.create(expenseData as any);
      }
      
      if (recurring.accountId) {
        const account = await Account.findByPk(recurring.accountId);
        if (account) {
          const balance = parseFloat(account.balance.toString());
          const newBalance = recurring.type === 'income'
            ? balance + parseFloat(recurring.amount.toString())
            : balance - parseFloat(recurring.amount.toString());
          await account.update({ balance: newBalance });
        }
      }
      
      const nextExecution = this.calculateNextExecution(
        executeDate,
        recurring.frequency,
        recurring.executionDay
      );
      
      await recurring.update({
        lastExecutedAt: executeDate,
        nextExecution
      });
      
      return res.json({ 
        success: true, 
        data: { 
          transactionId: transaction.id, 
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
        const dateKey = r.nextExecution.toISOString().split('T')[0];
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
    const date = new Date(fromDate);
    
    switch (frequency) {
      case 'daily':
        date.setDate(date.getDate() + 1);
        break;
      case 'weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'biweekly':
        date.setDate(date.getDate() + 14);
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        if (dayOfMonth) date.setDate(dayOfMonth);
        break;
      case 'quarterly':
        date.setMonth(date.getMonth() + 3);
        break;
      case 'yearly':
        date.setFullYear(date.getFullYear() + 1);
        break;
    }
    
    return date;
  }
}

export default new RecurringController();