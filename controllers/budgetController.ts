import { Request, Response } from 'express';
import Budget, { HalfMonth } from '../models/Budget';
import { BudgetInput } from '../types/finance';

export const addBudget = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, amount, month, type, year, halfMonth } = req.body as BudgetInput;
    const userId = (req as any).userId;

    const existingBudget = await Budget.findOne({
      where: {
        userId,
        category,
        type,
        ...(type === 'monthly' && { month, year, halfMonth: halfMonth || null }),
        ...(type === 'yearly' && { year }),
        ...(type === 'bi-monthly' && { year, halfMonth: halfMonth as HalfMonth })
      }
    });

    if (existingBudget) {
      res.status(400).json({ error: 'A budget for this category and period already exists' });
      return;
    }

    const budget = await Budget.create({
      category,
      amount,
      month: (type === 'monthly' || type === 'bi-monthly') ? month : null,
      type: type || 'monthly',
      year,
      halfMonth: type === 'bi-monthly' ? halfMonth : null,
      userId
    });

    res.status(201).json(budget);
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
    const { category, amount, month, type, year, halfMonth } = req.body as BudgetInput;

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
        ...(type === 'monthly' && { month, year, halfMonth: halfMonth || null }),
        ...(type === 'yearly' && { year }),
        ...(type === 'bi-monthly' && { year, halfMonth: halfMonth as HalfMonth })
      }
    });

    if (existingBudget) {
      res.status(400).json({ error: 'A budget for this category and period already exists' });
      return;
    }

    await budget.update({
      category,
      amount,
      month: (type === 'monthly' || type === 'bi-monthly') ? month : null,
      type: type || 'monthly',
      year,
      halfMonth: type === 'bi-monthly' ? halfMonth : null
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