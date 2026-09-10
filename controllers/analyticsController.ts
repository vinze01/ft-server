import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Income, Expense, Account, Budget } from '../models';

class AnalyticsController {
  async getExpensesByCategory(req: Request, res: Response) {
    try {
      const { from, to } = req.query;
      const userId = (req as any).userId;
      const where: any = { userId };

      if (from || to) {
        where.date = {};
        if (from) where.date[Op.gte] = new Date(from as string);
        if (to) where.date[Op.lte] = new Date(to as string);
      }

      const expenses = await Expense.findAll({ where });
      const total = expenses.reduce((sum, e) => sum + parseFloat(e.amount.toString()), 0);

      const byCategory: Record<string, number> = {};
      expenses.forEach(e => {
        const category = e.category || 'other';
        byCategory[category] = (byCategory[category] || 0) + parseFloat(e.amount.toString());
      });

      const result = Object.entries(byCategory).map(([category, amount]) => ({
        category,
        amount,
        percentage: total > 0 ? Math.round((amount / total) * 1000) / 10 : 0
      })).sort((a, b) => b.amount - a.amount);

      return res.json({ success: true, data: result });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async getIncomeByCategory(req: Request, res: Response) {
    try {
      const { from, to } = req.query;
      const userId = (req as any).userId;
      const where: any = { userId };

      if (from || to) {
        where.year = new Date().getFullYear();
      }

      const incomes = await Income.findAll({ where });
      const total = incomes.reduce((sum, i) => sum + parseFloat(i.amount.toString()), 0);

      const byCategory: Record<string, number> = {};
      incomes.forEach(i => {
        const category = i.category || 'other';
        byCategory[category] = (byCategory[category] || 0) + parseFloat(i.amount.toString());
      });

      const result = Object.entries(byCategory).map(([category, amount]) => ({
        category,
        amount,
        percentage: total > 0 ? Math.round((amount / total) * 1000) / 10 : 0
      })).sort((a, b) => b.amount - a.amount);

      return res.json({ success: true, data: result });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async getTrends(req: Request, res: Response) {
    try {
      const { metric, months } = req.query;
      const userId = (req as any).userId;
      const numMonths = parseInt(months as string) || 12;

      let labels: string[] = [];
      let values: number[] = [];

      if (metric === 'income') {
        const year = new Date().getFullYear();
        const incomes = await Income.findAll({
          where: { userId, year },
          order: [['month', 'ASC']]
        });
        
        const byMonth: Record<string, number> = {};
        incomes.forEach(i => {
          const month = i.month || 'Unknown';
          byMonth[month] = (byMonth[month] || 0) + parseFloat(i.amount.toString());
        });
        
        labels = Object.keys(byMonth);
        values = labels.map(l => Math.round(byMonth[l] * 100) / 100);
      } else {
        const expenses = await Expense.findAll({
          where: { userId },
          order: [['date', 'ASC']]
        });

        const byMonth: Record<string, number> = {};
        expenses.forEach(e => {
          const dateStr = e.date instanceof Date ? e.date.toISOString().substring(0, 7) : String(e.date).substring(0, 7);
          byMonth[dateStr] = (byMonth[dateStr] || 0) + parseFloat(e.amount.toString());
        });

        labels = Object.keys(byMonth).sort().slice(-numMonths);
        values = labels.map(l => Math.round(byMonth[l] * 100) / 100);
      }

      return res.json({ success: true, data: { labels, values } });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async getSavingsRate(req: Request, res: Response) {
    try {
      const { months } = req.query;
      const userId = (req as any).userId;
      const numMonths = parseInt(months as string) || 12;
      const year = new Date().getFullYear();

      const incomes = await Income.findAll({ where: { userId, year } });
      const expenses = await Expense.findAll({ where: { userId } });

      const totalIncome = incomes.reduce((sum, i) => sum + parseFloat(i.amount.toString()), 0);
      const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount.toString()), 0);
      const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

      const monthsList = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const result = monthsList.slice(0, numMonths).map(month => ({
        month,
        rate: Math.round(savingsRate * 10) / 10
      }));

      return res.json({ success: true, data: result });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async getNetWorth(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      
      const accounts = await Account.findAll({
        where: { userId, isActive: true }
      });

      const currentNetWorth = accounts.reduce((sum, acc) => {
        return acc.type === 'credit_card' 
          ? sum - parseFloat(acc.balance.toString())
          : sum + parseFloat(acc.balance.toString());
      }, 0);

      return res.json({ success: true, data: [{ date: new Date().toISOString().split('T')[0], value: currentNetWorth }] });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async getBurnRate(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      
      const startOfMonth = new Date();
      startOfMonth.setDate(1);

      const expenses = await Expense.findAll({
        where: { userId, date: { [Op.gte]: startOfMonth } }
      });

      const currentBurn = expenses.reduce((sum, e) => sum + parseFloat(e.amount.toString()), 0);
      const dayOfMonth = new Date().getDate();
      const dailyAverage = currentBurn / Math.max(1, dayOfMonth);

      return res.json({ 
        success: true, 
        data: { 
          current: Math.round(currentBurn * 100) / 100,
          daily: Math.round(dailyAverage * 100) / 100,
          projectedMonthly: Math.round((dailyAverage * 30) * 100) / 100
        } 
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}

export default new AnalyticsController();