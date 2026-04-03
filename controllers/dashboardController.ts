import { Request, Response } from 'express';
import Expense from '../models/Expense';
import Income from '../models/Income';
import Budget from '../models/Budget';
import { Op } from 'sequelize';

export const getDashboardSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const { view, year, month, halfMonth } = req.query;
    const viewType = (view as string) || 'monthly';
    
    const selectedYear = year ? parseInt(year as string) : new Date().getFullYear();
    const selectedMonth = month ? parseInt(month as string) : (new Date().getMonth() + 1);
    const selectedHalfMonth = halfMonth ? parseInt(halfMonth as string) : 1;

    let totalIncome = 0;
    let totalExpenses = 0;
    let expensesByCategory: Record<string, number> = {};
    let budgetStatus: any[] = [];
    let monthlyData: any[] = [];
    let yearlyData: any[] = [];
    let biMonthlyData: any[] = [];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    if (viewType === 'monthly' || !viewType) {
      const startOfMonth = new Date(selectedYear, selectedMonth - 1, 1);
      const endOfMonth = new Date(selectedYear, selectedMonth, 0);

      const currentMonthIncomes = await Income.findAll({
        where: { userId }
      });
      totalIncome = currentMonthIncomes.reduce((sum, inc) => sum + Number(inc.amount), 0);

      const currentMonthExpenses = await Expense.findAll({
        where: {
          userId,
          date: { [Op.between]: [startOfMonth, endOfMonth] }
        }
      });
      totalExpenses = currentMonthExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

      currentMonthExpenses.forEach(exp => {
        expensesByCategory[exp.category] = (expensesByCategory[exp.category] || 0) + Number(exp.amount);
      });

      const budgets = await Budget.findAll({
        where: { userId, type: 'monthly', year: selectedYear }
      });

      budgetStatus = budgets.map(budget => {
        const budgetMonthNum = months.indexOf(budget.month || '') + 1;
        return {
          category: budget.category,
          budgeted: Number(budget.amount),
          spent: budgetMonthNum === selectedMonth ? (expensesByCategory[budget.category] || 0) : 0,
          remaining: Number(budget.amount) - (budgetMonthNum === selectedMonth ? (expensesByCategory[budget.category] || 0) : 0),
          type: 'monthly',
          period: budget.month
        };
      });

      for (let i = 5; i >= 0; i--) {
        const d = new Date(selectedYear, selectedMonth - 1 - i);
        const y = d.getFullYear();
        const m = d.getMonth();
        const start = new Date(y, m, 1);
        const end = new Date(y, m + 1, 0);

        const incomes = await Income.findAll({ where: { userId } });
        const expenses = await Expense.findAll({
          where: { userId, date: { [Op.between]: [start, end] } }
        });

        const monthName = d.toLocaleString('default', { month: 'short', year: 'numeric' });
        monthlyData.push({
          month: monthName,
          income: incomes.reduce((sum, inc) => sum + Number(inc.amount), 0),
          expenses: expenses.reduce((sum, exp) => sum + Number(exp.amount), 0)
        });
      }
    } else if (viewType === 'yearly') {
      const startOfYear = new Date(selectedYear, 0, 1);
      const endOfYear = new Date(selectedYear, 11, 31);

      const yearlyIncomes = await Income.findAll({ where: { userId } });
      totalIncome = yearlyIncomes.reduce((sum, inc) => sum + Number(inc.amount), 0);

      const yearlyExpenses = await Expense.findAll({
        where: {
          userId,
          date: { [Op.between]: [startOfYear, endOfYear] }
        }
      });
      totalExpenses = yearlyExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

      yearlyExpenses.forEach(exp => {
        expensesByCategory[exp.category] = (expensesByCategory[exp.category] || 0) + Number(exp.amount);
      });

      const budgets = await Budget.findAll({
        where: { userId, type: 'yearly', year: selectedYear }
      });

      budgetStatus = budgets.map(budget => ({
        category: budget.category,
        budgeted: Number(budget.amount),
        spent: expensesByCategory[budget.category] || 0,
        remaining: Number(budget.amount) - (expensesByCategory[budget.category] || 0),
        type: 'yearly',
        period: String(selectedYear)
      }));

      yearlyData.push({
        year: selectedYear,
        income: totalIncome,
        expenses: totalExpenses
      });
    } else if (viewType === 'bi-monthly') {
      const halfStartDay = selectedHalfMonth === 1 ? 1 : 16;
      const halfEndDay = selectedHalfMonth === 1 ? 15 : new Date(selectedYear, selectedMonth - 1 + 1, 0).getDate();
      const startOfHalf = new Date(selectedYear, selectedMonth - 1, halfStartDay);
      const endOfHalf = new Date(selectedYear, selectedMonth - 1, halfEndDay);

      const incomes = await Income.findAll({
        where: {
          userId,
          type: 'bi-monthly',
          year: selectedYear,
          month: months[selectedMonth - 1],
          halfMonth: selectedHalfMonth
        }
      });
      totalIncome = incomes.reduce((sum, inc) => sum + Number(inc.amount), 0);

      const biMonthlyExpenses = await Expense.findAll({
        where: {
          userId,
          date: { [Op.between]: [startOfHalf, endOfHalf] }
        }
      });
      totalExpenses = biMonthlyExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

      biMonthlyExpenses.forEach(exp => {
        expensesByCategory[exp.category] = (expensesByCategory[exp.category] || 0) + Number(exp.amount);
      });

      const budgets = await Budget.findAll({
        where: { userId, type: 'bi-monthly', year: selectedYear, month: months[selectedMonth - 1] }
      });

      budgetStatus = budgets.map(budget => {
        const period = budget.halfMonth === 1 ? '1st Half (1-15)' : '2nd Half (16-31)';
        const isCurrentPeriod = budget.halfMonth === selectedHalfMonth;
        
        return {
          category: budget.category,
          budgeted: Number(budget.amount),
          spent: isCurrentPeriod ? (expensesByCategory[budget.category] || 0) : 0,
          remaining: Number(budget.amount) - (isCurrentPeriod ? (expensesByCategory[budget.category] || 0) : 0),
          type: 'bi-monthly',
          period
        };
      });

      const half1StartDay = 1;
      const half1EndDay = 15;
      const half2StartDay = 16;
      const half2EndDay = new Date(selectedYear, selectedMonth - 1 + 1, 0).getDate();
      
      const start1 = new Date(selectedYear, selectedMonth - 1, half1StartDay);
      const end1 = new Date(selectedYear, selectedMonth - 1, half1EndDay);
      const start2 = new Date(selectedYear, selectedMonth - 1, half2StartDay);
      const end2 = new Date(selectedYear, selectedMonth - 1, half2EndDay);
      
      const half1Incomes = await Income.findAll({
        where: { userId, type: 'bi-monthly', year: selectedYear, month: months[selectedMonth - 1], halfMonth: 1 }
      });
      const half2Incomes = await Income.findAll({
        where: { userId, type: 'bi-monthly', year: selectedYear, month: months[selectedMonth - 1], halfMonth: 2 }
      });
      
      const half1Expenses = await Expense.findAll({
        where: { userId, date: { [Op.between]: [start1, end1] } }
      });
      const half2Expenses = await Expense.findAll({
        where: { userId, date: { [Op.between]: [start2, end2] } }
      });
      
      biMonthlyData = [
        {
          halfMonth: 1,
          month: months[selectedMonth - 1],
          year: selectedYear,
          label: `1st Half (1-15)`,
          income: half1Incomes.reduce((sum, inc) => sum + Number(inc.amount), 0),
          expenses: half1Expenses.reduce((sum, exp) => sum + Number(exp.amount), 0)
        },
        {
          halfMonth: 2,
          month: months[selectedMonth - 1],
          year: selectedYear,
          label: `2nd Half (16-31)`,
          income: half2Incomes.reduce((sum, inc) => sum + Number(inc.amount), 0),
          expenses: half2Expenses.reduce((sum, exp) => sum + Number(exp.amount), 0)
        }
      ];
    }

    res.json({
      totalIncome,
      totalExpenses,
      balance: totalIncome - totalExpenses,
      expensesByCategory,
      budgetStatus,
      monthlyData,
      yearlyData,
      biMonthlyData
    });
  } catch (error) {
    console.error('Get dashboard summary error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard summary' });
  }
};