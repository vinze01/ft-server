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

      if (!name || !String(name).trim()) {
        return res.status(400).json({ success: false, error: 'Bill name is required' });
      }
      const amountNum = Number(amount);
      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        return res.status(400).json({ success: false, error: 'Amount must be a positive number' });
      }
      const freq = frequency || 'monthly';
      if (!['monthly', 'quarterly', 'yearly', 'one_time'].includes(freq)) {
        return res.status(400).json({ success: false, error: 'Invalid frequency' });
      }
      const day = Number(dueDay);
      if (!Number.isInteger(day) || day < 1 || day > 31) {
        return res.status(400).json({ success: false, error: 'Due day must be between 1 and 31' });
      }

      const nextDueDate = this.calculateNextDueDate(day, freq);

      const bill = await Bill.create({
        userId: (req as any).userId,
        name,
        amount: amountNum,
        categoryId,
        accountId,
        dueDay: day,
        frequency: freq,
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

      if (frequency !== undefined && !['monthly', 'quarterly', 'yearly', 'one_time'].includes(frequency)) {
        return res.status(400).json({ success: false, error: 'Invalid frequency' });
      }
      if (dueDay !== undefined && (!Number.isInteger(Number(dueDay)) || Number(dueDay) < 1 || Number(dueDay) > 31)) {
        return res.status(400).json({ success: false, error: 'Due day must be between 1 and 31' });
      }
      if (amount !== undefined && amount !== null && (!Number.isFinite(Number(amount)) || Number(amount) <= 0)) {
        return res.status(400).json({ success: false, error: 'Amount must be a positive number' });
      }

      let nextDueDate = bill.nextDueDate;
      if (dueDay !== undefined || frequency !== undefined) {
        nextDueDate = this.calculateNextDueDate(
          dueDay !== undefined ? Number(dueDay) : bill.dueDay,
          frequency || bill.frequency
        );
      }

      await bill.update({
        name: name || bill.name,
        // !== undefined (not falsy-OR): explicit values like amount 0 or
        // reminderDays 0 must be settable.
        amount: amount !== undefined && amount !== null ? Number(amount) : bill.amount,
        categoryId: categoryId !== undefined ? categoryId : bill.categoryId,
        accountId: accountId !== undefined ? accountId : bill.accountId,
        dueDay: dueDay !== undefined ? Number(dueDay) : bill.dueDay,
        frequency: frequency || bill.frequency,
        nextDueDate,
        isSubscription: isSubscription !== undefined ? isSubscription : bill.isSubscription,
        reminderDays: reminderDays !== undefined ? Number(reminderDays) : bill.reminderDays,
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
        // Advance from the cycle that was just settled — paying on (or before)
        // the due date must move to the NEXT occurrence, not re-suggest the
        // same day. Paying late advances from the actual payment date.
        const base = new Date(Math.max(
          new Date(paidDate).getTime(),
          new Date(bill.nextDueDate).getTime()
        ));
        const dayAfterBase = new Date(base.getTime() + 24 * 60 * 60 * 1000);
        nextDueDate = this.calculateNextDueDate(bill.dueDay, bill.frequency, dayAfterBase);
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
        // null (not undefined) — Sequelize strips undefined keys, so the
        // paid date would silently survive an "unpay".
        paidDate: null as any
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
      const endDate = new Date(year, month, 0, 23, 59, 59);

      const bills = await Bill.findAll({
        where: { userId: (req as any).userId }
      });

      // Attribute each bill to the requested month by its relevant date:
      // paid bills by paidDate, unpaid bills by nextDueDate. Previously the
      // month range was computed but never applied, so month/year params
      // silently did nothing.
      const inMonth = bills.filter(b => {
        const relevant = b.isPaid && b.paidDate ? new Date(b.paidDate) : new Date(b.nextDueDate);
        return relevant >= startDate && relevant <= endDate;
      });

      const totalDue = inMonth.reduce((sum, b) => sum + parseFloat(b.amount.toString()), 0);
      const paid = inMonth.filter(b => b.isPaid).reduce((sum, b) => sum + parseFloat(b.amount.toString()), 0);
      const unpaid = totalDue - paid;
      const subscriptions = inMonth.filter(b => b.isSubscription).length;

      const byFrequency: Record<string, number> = {};
      inMonth.forEach(b => {
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
    const monthsStep = frequency === 'quarterly' ? 3 : frequency === 'yearly' ? 12 : 1;

    if (frequency === 'one_time') {
      return fromDate;
    }

    // Build the candidate date, clamping the day to the target month's
    // length (dueDay 31 in April → April 30, not a May overflow).
    const buildCandidate = (year: number, month: number) => {
      const lastDay = new Date(year, month + 1, 0).getDate();
      return new Date(year, month, Math.min(dueDay, lastDay));
    };

    const startOfFrom = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
    let candidate = buildCandidate(fromDate.getFullYear(), fromDate.getMonth());

    // Never return a date in the past: if this month's occurrence already
    // passed, advance whole cycles until the date is current or future.
    let guard = 0;
    while (candidate < startOfFrom && guard < 240) {
      candidate = buildCandidate(
        candidate.getFullYear(),
        candidate.getMonth() + monthsStep
      );
      guard++;
    }
    return candidate;
  }
}

export default new BillController();