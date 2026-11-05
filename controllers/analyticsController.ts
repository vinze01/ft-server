import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Income, Expense, Account, Budget } from '../models';

const MONTH_INDEX: Record<string, number> = {
  January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
  July: 6, August: 7, September: 8, October: 9, November: 10, December: 11
};

/** Comparable month key for an income row (yearly rows → January of that year). */
function incomeMonthKey(year: number, month: string | null): number {
  return year * 12 + (month ? MONTH_INDEX[month] ?? 0 : 0);
}

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

      // Income rows carry (year, month-name) rather than a date — translate
      // the requested range into comparable month keys. Previously the
      // range was ignored and silently replaced with the current year.
      let minKey: number | null = null;
      let maxKey: number | null = null;
      if (from) {
        const f = new Date(from as string);
        if (!isNaN(f.getTime())) minKey = f.getFullYear() * 12 + f.getMonth();
      }
      if (to) {
        const t = new Date(to as string);
        if (!isNaN(t.getTime())) maxKey = t.getFullYear() * 12 + t.getMonth();
      }

      const incomes = await Income.findAll({ where });
      const filtered = (minKey !== null || maxKey !== null)
        ? incomes.filter(i =>
            (minKey === null || incomeMonthKey(i.year, i.month) >= minKey) &&
            (maxKey === null || incomeMonthKey(i.year, i.month) <= maxKey)
          )
        : incomes;

      const total = filtered.reduce((sum, i) => sum + parseFloat(i.amount.toString()), 0);

      const byCategory: Record<string, number> = {};
      filtered.forEach(i => {
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
          where: { userId, year }
        });

        const byMonth: Record<string, number> = {};
        incomes.forEach(i => {
          const month = i.month || 'Unknown';
          byMonth[month] = (byMonth[month] || 0) + parseFloat(i.amount.toString());
        });

        // Month names sort alphabetically in SQL — order chronologically
        // and trim to the requested window.
        labels = Object.keys(byMonth).sort(
          (a, b) => (MONTH_INDEX[a] ?? 99) - (MONTH_INDEX[b] ?? 99)
        ).slice(-numMonths);
        values = labels.map(l => Math.round(byMonth[l] * 100) / 100);
      } else {
        // Bound the query to the requested window instead of loading the
        // entire expense history.
        const now = new Date();
        const windowStart = new Date(now.getFullYear(), now.getMonth() - numMonths, 1);
        const expenses = await Expense.findAll({
          where: { userId, date: { [Op.gte]: windowStart } },
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
      const now = new Date();

      // Per-month series: match monthly/bi-monthly incomes by period name
      // and expenses by actual date. (Yearly incomes have no month and are
      // reflected in the overall rate below, not the monthly breakdown.)
      const incomes = await Income.findAll({ where: { userId, year: now.getFullYear() } });
      const yearStart = new Date(now.getFullYear(), 0, 1);
      const expenses = await Expense.findAll({
        where: { userId, date: { [Op.gte]: yearStart } }
      });

      const totalIncome = incomes.reduce((sum, i) => sum + parseFloat(i.amount.toString()), 0);
      const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount.toString()), 0);
      const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
      const shortNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      const expenseByMonth: number[] = new Array(12).fill(0);
      expenses.forEach(e => {
        const d = e.date instanceof Date ? e.date : new Date(e.date);
        if (!isNaN(d.getTime())) expenseByMonth[d.getMonth()] += parseFloat(e.amount.toString());
      });

      const result = monthNames.slice(0, numMonths).map((monthName, idx) => {
        const income = incomes
          .filter(i => i.month === monthName)
          .reduce((sum, i) => sum + parseFloat(i.amount.toString()), 0);
        const rate = income > 0
          ? ((income - expenseByMonth[idx]) / income) * 100
          : 0;
        return { month: shortNames[idx], rate: Math.round(rate * 10) / 10 };
      });

      return res.json({ success: true, data: result, overallRate: Math.round(savingsRate * 10) / 10 });
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