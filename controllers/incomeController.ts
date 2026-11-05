import { Request, Response } from 'express';
import { Op } from 'sequelize';
import Income, { HalfMonth } from '../models/Income';
import { IncomeInput } from '../types/finance';

const INCOME_TYPES = ['monthly', 'yearly', 'bi-monthly'];

// Month names sort alphabetically in SQL — order chronologically instead.
const MONTH_INDEX: Record<string, number> = {
  January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
  July: 7, August: 8, September: 9, October: 10, November: 11, December: 12
};

/** year DESC, then chronological month DESC (yearly rows first), halfMonth DESC. */
function sortIncomes(incomes: Income[]): Income[] {
  return incomes.sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    const am = a.month ? MONTH_INDEX[a.month] : 99;
    const bm = b.month ? MONTH_INDEX[b.month] : 99;
    if (am !== bm) return bm - am;
    const ah = a.halfMonth ?? 0;
    const bh = b.halfMonth ?? 0;
    if (ah !== bh) return bh - ah;
    return b.id - a.id;
  });
}

export const addIncome = async (req: Request, res: Response): Promise<void> => {
  try {
    const { amount, months, type, year, halfMonths, accountId, category, note } = req.body as IncomeInput;
    const userId = (req as any).userId;

    const incomeType = type || 'monthly';
    if (!INCOME_TYPES.includes(incomeType)) {
      res.status(400).json({ error: 'Invalid income type' });
      return;
    }
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      res.status(400).json({ error: 'Amount must be a positive number' });
      return;
    }
    const incomeYear = Number(year);
    if (!Number.isInteger(incomeYear) || incomeYear < 1900 || incomeYear > 2200) {
      res.status(400).json({ error: 'Invalid year' });
      return;
    }

    const incomeMonths = (months && months.length > 0) ? months.filter((m: string) => m && m.trim()) : [];
    const incomeHalfMonths: number[] = (halfMonths && halfMonths.length > 0) ? halfMonths.filter((h: number) => h === 1 || h === 2) : [];

    if (incomeMonths.length === 0 && incomeType !== 'yearly') {
      res.status(400).json({ error: 'Please select at least one month' });
      return;
    }

    if (incomeType === 'bi-monthly' && incomeHalfMonths.length === 0) {
      res.status(400).json({ error: 'Please select at least one pay period' });
      return;
    }

    const existingIncomes: Income[] = [];

    // For monthly/yearly rows halfMonth is NULL, so iterate a single pass per
    // month instead of zipping with the (empty) halfMonths selection —
    // otherwise nothing is created and the API still returns 201 [].
    const halfMonthValues: (number | null)[] = incomeType === 'bi-monthly' ? incomeHalfMonths : [null];

    if (incomeType === 'yearly') {
      const existing = await Income.findOne({
        where: { userId, type: incomeType, year: incomeYear }
      });
      if (existing) existingIncomes.push(existing);
    } else {
      for (const month of incomeMonths) {
        for (const halfMonth of halfMonthValues) {
          const whereClause: any = {
            userId,
            type: incomeType,
            year: incomeYear,
            month
          };

          if (incomeType === 'bi-monthly') {
            whereClause.halfMonth = halfMonth;
          }

          const existing = await Income.findOne({ where: whereClause });
          if (existing) existingIncomes.push(existing);
        }
      }
    }

    if (existingIncomes.length > 0) {
      res.status(400).json({ error: 'Income for one or more selected periods already exists' });
      return;
    }

    const createdIncomes: Income[] = [];

    if (incomeType === 'yearly') {
      const income = await Income.create({
        amount: amountNum,
        month: null,
        type: incomeType,
        year: incomeYear,
        halfMonth: null,
        userId,
        accountId: accountId || null,
        category: category || null,
        note: note || null
      });
      createdIncomes.push(income);
    } else {
      for (const month of incomeMonths) {
        for (const halfMonth of halfMonthValues) {
          const incomeData: any = {
            amount: amountNum,
            month,
            type: incomeType,
            year: incomeYear,
            userId,
            accountId: accountId || null,
            category: category || null,
            note: note || null
          };

          if (incomeType === 'bi-monthly') {
            incomeData.halfMonth = halfMonth;
          }

          const income = await Income.create(incomeData);
          createdIncomes.push(income);
        }
      }
    }

    res.status(201).json(createdIncomes);
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
      // `month` is a name string — SQL ordering is alphabetical, so sort
      // chronologically in JS instead.
    });
    sortIncomes(incomes);

    res.json(incomes);
  } catch (error) {
    console.error('Get incomes error:', error);
    res.status(500).json({ error: 'Failed to fetch incomes' });
  }
};

export const getTotalIncome = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    let { year } = req.query;

    if (!year) {
      year = new Date().getFullYear().toString();
    }

    const where: any = { userId, year: parseInt(year as string) };

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
    const { amount, month, type, year, halfMonth, accountId, category, note } = req.body as IncomeInput;

    const income = await Income.findOne({
      where: { id: parseInt(id), userId }
    });

    if (!income) {
      res.status(404).json({ error: 'Income not found' });
      return;
    }

    // Fall back to the stored values for anything the body omits, so the
    // duplicate check reflects the row as it will actually be saved.
    const newType = type || income.type;
    const newMonth = month || income.month || undefined;
    const newYear = year || income.year;
    const newHalfMonth = halfMonth !== undefined ? halfMonth : income.halfMonth;

    if (amount !== undefined && (!Number.isFinite(Number(amount)) || Number(amount) <= 0)) {
      res.status(400).json({ error: 'Amount must be a positive number' });
      return;
    }
    if (newType && !INCOME_TYPES.includes(newType)) {
      res.status(400).json({ error: 'Invalid income type' });
      return;
    }

    const existingIncome = await Income.findOne({
      where: {
        userId,
        type: newType,
        id: { [Op.ne]: parseInt(id) },
        ...(newType === 'monthly' && { month: newMonth, year: newYear, halfMonth: null }),
        ...(newType === 'yearly' && { year: newYear }),
        // bi-monthly rows are unique per (month, half) — the previous check
        // omitted `month`, so updating a February H1 income was falsely
        // rejected whenever any other month had an H1 income.
        ...(newType === 'bi-monthly' && { month: newMonth, year: newYear, halfMonth: newHalfMonth as HalfMonth })
      }
    });

    if (existingIncome) {
      res.status(400).json({ error: 'Income for this period already exists' });
      return;
    }

    await income.update({
      amount: amount !== undefined ? Number(amount) : income.amount,
      month: (newType === 'monthly' || newType === 'bi-monthly') ? newMonth : null,
      type: newType,
      year: newYear,
      halfMonth: newType === 'bi-monthly' ? newHalfMonth : null,
      // Only overwrite the optional detail fields when actually sent, so a
      // partial PUT (e.g. { amount }) doesn't wipe them to null.
      ...(accountId !== undefined && { accountId: accountId || null }),
      ...(category !== undefined && { category: category || null }),
      ...(note !== undefined && { note: note || null })
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