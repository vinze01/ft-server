import { Request, Response } from 'express';
import Budget, { HalfMonth } from '../models/Budget';
import { BudgetInput } from '../types/finance';

export const addBudget = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, amount, months, type, year, halfMonths } = req.body as BudgetInput;
    const userId = (req as any).userId;

    const budgetMonths = (months && months.length > 0) ? months.filter((m: string) => m && m.trim()) : [];
    const budgetHalfMonths: number[] = (halfMonths && halfMonths.length > 0) ? halfMonths.filter((h: number) => h === 1 || h === 2) : [];

    if (budgetMonths.length === 0 && type !== 'yearly') {
      res.status(400).json({ error: 'Please select at least one month' });
      return;
    }

    if (type === 'bi-monthly' && budgetHalfMonths.length === 0) {
      res.status(400).json({ error: 'Please select at least one pay period' });
      return;
    }

    const existingBudgets: Budget[] = [];

    if (type === 'yearly') {
      const existing = await Budget.findOne({
        where: { userId, category, type, year }
      });
      if (existing) existingBudgets.push(existing);
    } else {
      for (const month of budgetMonths) {
        for (const halfMonth of budgetHalfMonths) {
          const whereClause: any = {
            userId,
            category,
            type,
            year,
            month
          };
          
          if (type === 'bi-monthly') {
            whereClause.halfMonth = halfMonth;
          }

          const existing = await Budget.findOne({ where: whereClause });
          if (existing) existingBudgets.push(existing);
        }
      }
    }

    if (existingBudgets.length > 0) {
      res.status(400).json({ error: 'Budget for one or more selected periods already exists' });
      return;
    }

    const createdBudgets: Budget[] = [];

    if (type === 'yearly') {
      const budget = await Budget.create({
        category,
        amount,
        month: null,
        type: type || 'monthly',
        year,
        halfMonth: null,
        userId
      });
      createdBudgets.push(budget);
    } else {
      for (const month of budgetMonths) {
        for (const halfMonth of budgetHalfMonths) {
          const budgetData: any = {
            category,
            amount,
            month,
            type: type || 'monthly',
            year,
            userId
          };
          
          if (type === 'bi-monthly') {
            budgetData.halfMonth = halfMonth;
          }

          const budget = await Budget.create(budgetData);
          createdBudgets.push(budget);
        }
      }
    }

    res.status(201).json(createdBudgets);
  } catch (error) {
    console.error('Add budget error:', error);
    res.status(500).json({ error: 'Failed to add budget' });
  }
};

export const getBudgets = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const { type, year } = req.query;

    const where: any = { userId };
    if (type) where.type = type;
    if (year) where.year = parseInt(year as string);

    const budgets = await Budget.findAll({
      where,
      order: [['year', 'DESC'], ['halfMonth', 'DESC'], ['month', 'DESC'], ['category', 'ASC']]
    });

    res.json(budgets);
  } catch (error) {
    console.error('Get budgets error:', error);
    res.status(500).json({ error: 'Failed to fetch budgets' });
  }
};

export const updateBudget = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;
    const { category, amount, month, months, type, year, halfMonth, halfMonths } = req.body as BudgetInput;

    const budgetMonth = month || (months && months[0]) || null;
    const budgetHalfMonth = halfMonth || (halfMonths && halfMonths[0]) || null;

    const budget = await Budget.findOne({
      where: { id: parseInt(id), userId }
    });

    if (!budget) {
      res.status(404).json({ error: 'Budget not found' });
      return;
    }

    const existingBudget = await Budget.findOne({
      where: {
        userId,
        category,
        type,
        id: { [require('sequelize').Op.ne]: parseInt(id) },
        ...(type === 'monthly' && { month: budgetMonth, year, halfMonth: null }),
        ...(type === 'yearly' && { year }),
        ...(type === 'bi-monthly' && { year, halfMonth: budgetHalfMonth as HalfMonth })
      }
    });

    if (existingBudget) {
      res.status(400).json({ error: 'A budget for this category and period already exists' });
      return;
    }

    await budget.update({
      category,
      amount,
      month: (type === 'monthly' || type === 'bi-monthly') ? budgetMonth : null,
      type: type || 'monthly',
      year,
      halfMonth: type === 'bi-monthly' ? budgetHalfMonth : null
    });
    res.json(budget);
  } catch (error) {
    console.error('Update budget error:', error);
    res.status(500).json({ error: 'Failed to update budget' });
  }
};

export const deleteBudget = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    const budget = await Budget.findOne({
      where: { id: parseInt(id), userId }
    });

    if (!budget) {
      res.status(404).json({ error: 'Budget not found' });
      return;
    }

    await budget.destroy();
    res.json({ message: 'Budget deleted successfully' });
  } catch (error) {
    console.error('Delete budget error:', error);
    res.status(500).json({ error: 'Failed to delete budget' });
  }
};