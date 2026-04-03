import { Request, Response } from 'express';
import Income, { HalfMonth } from '../models/Income';
import { IncomeInput } from '../types/finance';

export const addIncome = async (req: Request, res: Response): Promise<void> => {
  try {
    const { amount, month, type, year, halfMonth } = req.body as IncomeInput;
    const userId = (req as any).userId;

    const existingIncome = await Income.findOne({
      where: {
        userId,
        type,
        ...(type === 'monthly' && { month, year, halfMonth: halfMonth || null }),
        ...(type === 'yearly' && { year }),
        ...(type === 'bi-monthly' && { year, halfMonth: halfMonth as HalfMonth })
      }
    });

    if (existingIncome) {
      res.status(400).json({ error: 'Income for this period already exists' });
      return;
    }

    const income = await Income.create({
      amount,
      month: (type === 'monthly' || type === 'bi-monthly') ? month : null,
      type: type || 'monthly',
      year,
      halfMonth: type === 'bi-monthly' ? halfMonth : null,
      userId
    });

    res.status(201).json(income);
  } catch (error) {
    console.error('Add income error:', error);
    res.status(500).json({ error: 'Failed to add income' });
  }
};

export const getIncomes = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const { type, year } = req.query;

    const where: any = { userId };
    if (type) where.type = type;
    if (year) where.year = parseInt(year as string);

    const incomes = await Income.findAll({
      where,
      order: [['year', 'DESC'], ['halfMonth', 'DESC'], ['month', 'DESC']]
    });

    res.json(incomes);
  } catch (error) {
    console.error('Get incomes error:', error);
    res.status(500).json({ error: 'Failed to fetch incomes' });
  }
};

export const getTotalIncome = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const { year } = req.query;

    const where: any = { userId };
    if (year) where.year = parseInt(year as string);

    const incomes = await Income.findAll({ where });
    const totalIncome = incomes.reduce((sum, income) => sum + Number(income.amount), 0);

    res.json({ totalIncome });
  } catch (error) {
    console.error('Get total income error:', error);
    res.status(500).json({ error: 'Failed to fetch total income' });
  }
};

export const updateIncome = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;
    const { amount, month, type, year, halfMonth } = req.body as IncomeInput;

    const income = await Income.findOne({
      where: { id: parseInt(id), userId }
    });

    if (!income) {
      res.status(404).json({ error: 'Income not found' });
      return;
    }

    const existingIncome = await Income.findOne({
      where: {
        userId,
        type,
        id: { [require('sequelize').Op.ne]: parseInt(id) },
        ...(type === 'monthly' && { month, year, halfMonth: halfMonth || null }),
        ...(type === 'yearly' && { year }),
        ...(type === 'bi-monthly' && { year, halfMonth: halfMonth as HalfMonth })
      }
    });

    if (existingIncome) {
      res.status(400).json({ error: 'Income for this period already exists' });
      return;
    }

    await income.update({
      amount,
      month: (type === 'monthly' || type === 'bi-monthly') ? month : null,
      type: type || 'monthly',
      year,
      halfMonth: type === 'bi-monthly' ? halfMonth : null
    });
    res.json(income);
  } catch (error) {
    console.error('Update income error:', error);
    res.status(500).json({ error: 'Failed to update income' });
  }
};

export const deleteIncome = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    const income = await Income.findOne({
      where: { id: parseInt(id), userId }
    });

    if (!income) {
      res.status(404).json({ error: 'Income not found' });
      return;
    }

    await income.destroy();
    res.json({ message: 'Income deleted successfully' });
  } catch (error) {
    console.error('Delete income error:', error);
    res.status(500).json({ error: 'Failed to delete income' });
  }
};