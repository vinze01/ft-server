import { Request, Response } from 'express';
import { Op } from 'sequelize';
import Expense from '../models/Expense';
import { ExpenseInput } from '../types/finance';

export const addExpense = async (req: Request, res: Response): Promise<void> => {
  try {
    const { description, amount, category, date } = req.body as ExpenseInput;
    const userId = (req as any).userId;

    const expense = await Expense.create({
      description,
      amount,
      category,
      date,
      userId
    });

    res.status(201).json(expense);
  } catch (error) {
    console.error('Add expense error:', error);
    res.status(500).json({ error: 'Failed to add expense' });
  }
};

export const getExpenses = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const { month, category } = req.query;

    const where: any = { userId };

    if (month) {
      const [year, mon] = (month as string).split('-').map(Number);
      const startOfMonth = new Date(year, mon - 1, 1);
      const endOfMonth = new Date(year, mon, 0);
      where.date = { [Op.between]: [startOfMonth, endOfMonth] };
    }

    if (category) {
      where.category = category;
    }

    const expenses = await Expense.findAll({ 
      where,
      order: [['date', 'DESC']]
    });

    res.json(expenses);
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
};

export const getExpensesForMonth = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const { month } = req.query;

    if (!month) {
      res.status(400).json({ error: 'Month parameter is required' });
      return;
    }

    const [year, mon] = (month as string).split('-').map(Number);
    const startOfMonth = new Date(year, mon - 1, 1);
    const endOfMonth = new Date(year, mon, 0);

    const expenses = await Expense.findAll({
      where: {
        userId,
        date: { [Op.between]: [startOfMonth, endOfMonth] }
      }
    });

    const totalExpenses: Record<string, number> = {};
    expenses.forEach(expense => {
      totalExpenses[expense.category] = (totalExpenses[expense.category] || 0) + Number(expense.amount);
    });

    res.json({ totalExpenses, expenses });
  } catch (error) {
    console.error('Get monthly expenses error:', error);
    res.status(500).json({ error: 'Failed to fetch monthly expenses' });
  }
};

export const updateExpense = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;
    const { description, amount, category, date } = req.body as ExpenseInput;

    const expense = await Expense.findOne({
      where: { id: parseInt(id), userId }
    });

    if (!expense) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }

    await expense.update({
      description,
      amount,
      category,
      date
    });

    res.json(expense);
  } catch (error) {
    console.error('Update expense error:', error);
    res.status(500).json({ error: 'Failed to update expense' });
  }
};

export const deleteExpense = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    const expense = await Expense.findOne({
      where: { id: parseInt(id), userId }
    });

    if (!expense) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }

    await expense.destroy();
    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
};
