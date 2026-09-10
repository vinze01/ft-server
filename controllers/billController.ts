import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Bill } from '../models';

class BillController {
  async getAll(req: Request, res: Response) {
    try {
      const { isSubscription, isPaid } = req.query;
      const where: any = { userId: (req as any).userId };
      
      if (isSubscription !== undefined) {
        where.isSubscription = isSubscription === 'true';
      }
      if (isPaid !== undefined) {
        where.isPaid = isPaid === 'true';
      }
      
      const bills = await Bill.findAll({
        where,
        order: [['nextDueDate', 'ASC']]
      });
      
      return res.json({ success: true, data: bills });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async getOne(req: Request, res: Response) {
    try {
      const bill = await Bill.findOne({
        where: { id: req.params.id, userId: (req as any).userId }
      });
      
      if (!bill) {
        return res.status(404).json({ success: false, error: 'Bill not found' });
      }
      
      return res.json({ success: true, data: bill });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const { 
        name, amount, categoryId, accountId, dueDay, 
        frequency, isSubscription, reminderDays, notes 
      } = req.body;
      
      const nextDueDate = this.calculateNextDueDate(dueDay, frequency);
      
      const bill = await Bill.create({
        userId: (req as any).userId,
        name,
        amount,
        categoryId,
        accountId,
        dueDay,
        frequency: frequency || 'monthly',
        nextDueDate,
        isSubscription: isSubscription || false,
        reminderDays: reminderDays || 3,
        notes
      });
      
      return res.status(201).json({ success: true, data: bill });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const bill = await Bill.findOne({
        where: { id: req.params.id, userId: (req as any).userId }
      });
      
      if (!bill) {
        return res.status(404).json({ success: false, error: 'Bill not found' });
      }
      
      const { 
        name, amount, categoryId, accountId, dueDay, 
        frequency, isSubscription, reminderDays, notes 
      } = req.body;
      
      let nextDueDate = bill.nextDueDate;
      if (dueDay || frequency) {
        nextDueDate = this.calculateNextDueDate(
          dueDay || bill.dueDay, 
          frequency || bill.frequency
        );
      }
      
      await bill.update({
        name: name || bill.name,
        amount: amount || bill.amount,
        categoryId: categoryId !== undefined ? categoryId : bill.categoryId,
        accountId: accountId !== undefined ? accountId : bill.accountId,
        dueDay: dueDay || bill.dueDay,
        frequency: frequency || bill.frequency,
        nextDueDate,
        isSubscription: isSubscription !== undefined ? isSubscription : bill.isSubscription,
        reminderDays: reminderDays || bill.reminderDays,
        notes: notes !== undefined ? notes : bill.notes
      });
      
      return res.json({ success: true, data: bill });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const bill = await Bill.findOne({
        where: { id: req.params.id, userId: (req as any).userId }
      });
      
      if (!bill) {
        return res.status(404).json({ success: false, error: 'Bill not found' });
      }
      
      await bill.destroy();
      return res.json({ success: true, message: 'Bill deleted' });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async markPaid(req: Request, res: Response) {
    try {
      const bill = await Bill.findOne({
        where: { id: req.params.id, userId: (req as any).userId }
      });
      
      if (!bill) {
        return res.status(404).json({ success: false, error: 'Bill not found' });
      }
      
      const paidDate = req.body.paidDate ? new Date(req.body.paidDate) : new Date();
      
      let nextDueDate = bill.nextDueDate;
      if (bill.frequency !== 'one_time') {
        nextDueDate = this.calculateNextDueDate(bill.dueDay, bill.frequency, paidDate);
      }
      
      await bill.update({
        isPaid: true,
        paidDate,
        nextDueDate
      });
      
      return res.json({ success: true, data: bill });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async markUnpaid(req: Request, res: Response) {
    try {
      const bill = await Bill.findOne({
        where: { id: req.params.id, userId: (req as any).userId }
      });
      
      if (!bill) {
        return res.status(404).json({ success: false, error: 'Bill not found' });
      }
      
      await bill.update({
        isPaid: false,
        paidDate: undefined
      });
      
      return res.json({ success: true, data: bill });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async getDueSoon(req: Request, res: Response) {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + days);
      
      const bills = await Bill.findAll({
        where: {
          userId: (req as any).userId,
          isPaid: false,
          nextDueDate: { [Op.lte]: targetDate }
        },
        order: [['nextDueDate', 'ASC']]
      });
      
      return res.json({ success: true, data: bills });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async getSummary(req: Request, res: Response) {
    try {
      const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      
      const bills = await Bill.findAll({
        where: { userId: (req as any).userId }
      });
      
      const totalDue = bills.reduce((sum, b) => sum + parseFloat(b.amount.toString()), 0);
      const paid = bills.filter(b => b.isPaid).reduce((sum, b) => sum + parseFloat(b.amount.toString()), 0);
      const unpaid = totalDue - paid;
      const subscriptions = bills.filter(b => b.isSubscription).length;
      
      const byFrequency: Record<string, number> = {};
      bills.forEach(b => {
        byFrequency[b.frequency] = (byFrequency[b.frequency] || 0) + parseFloat(b.amount.toString());
      });
      
      return res.json({ 
        success: true, 
        data: { totalDue, paid, unpaid, byFrequency, subscriptions } 
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  private calculateNextDueDate(
    dueDay: number, 
    frequency: string, 
    fromDate: Date = new Date()
  ): Date {
    let year = fromDate.getFullYear();
    let month = fromDate.getMonth();
    
    switch (frequency) {
      case 'monthly':
        return new Date(year, month, dueDay);
      case 'quarterly':
        return new Date(year, month + 3, dueDay);
      case 'yearly':
        return new Date(year + 1, month, dueDay);
      case 'one_time':
        return fromDate;
      default:
        return new Date(year, month, dueDay);
    }
  }
}

export default new BillController();