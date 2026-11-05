import { Request, Response } from 'express';
import { Op } from 'sequelize';
import Budget, { HalfMonth } from '../models/Budget';
import { BudgetInput } from '../types/finance';

const BUDGET_TYPES = ['monthly', 'yearly', 'bi-monthly'];

// Month names sort alphabetically in SQL — order chronologically instead.
const MONTH_INDEX: Record<string, number> = {
  January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
  July: 7, August: 8, September: 9, October: 10, November: 11, December: 12
};

/** year DESC, then chronological month DESC (yearly rows first), halfMonth DESC, category ASC. */
function sortBudgets(budgets: Budget[]): Budget[] {
  return budgets.sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    const am = a.month ? MONTH_INDEX[a.month] : 99;
    const bm = b.month ? MONTH_INDEX[b.month] : 99;
    if (am !== bm) return bm - am;
    const ah = a.halfMonth ?? 0;
    const bh = b.halfMonth ?? 0;
    if (ah !== bh) return bh - ah;
    return a.category.localeCompare(b.category) || b.id - a.id;
  });
}

export const addBudget = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, amount, months, type, year, halfMonths } = req.body as BudgetInput;
    const userId = (req as any).userId;

    const budgetType = type || 'monthly';
    if (!BUDGET_TYPES.includes(budgetType)) {
      res.status(400).json({ error: 'Invalid budget type' });
      return;
    }
    if (!category || !String(category).trim()) {
      res.status(400).json({ error: 'Category is required' });
      return;
    }
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      res.status(400).json({ error: 'Amount must be a positive number' });
      return;
    }
    const budgetYear = Number(year);
    if (!Number.isInteger(budgetYear) || budgetYear < 1900 || budgetYear > 2200) {
      res.status(400).json({ error: 'Invalid year' });
      return;
    }

    const budgetMonths = (months && months.length > 0) ? months.filter((m: string) => m && m.trim()) : [];
    const budgetHalfMonths: number[] = (halfMonths && halfMonths.length > 0) ? halfMonths.filter((h: number) => h === 1 || h === 2) : [];

    if (budgetMonths.length === 0 && budgetType !== 'yearly') {
      res.status(400).json({ error: 'Please select at least one month' });
      return;
    }

    if (budgetType === 'bi-monthly' && budgetHalfMonths.length === 0) {
      res.status(400).json({ error: 'Please select at least one pay period' });
      return;
    }

    const existingBudgets: Budget[] = [];

    // Same as incomes: monthly/yearly rows have halfMonth NULL, so iterate a
    // single pass per month rather than zipping with the (empty) halfMonths.
    const halfMonthValues: (number | null)[] = budgetType === 'bi-monthly' ? budgetHalfMonths : [null];

    if (budgetType === 'yearly') {
      const existing = await Budget.findOne({
        where: { userId, category, type: budgetType, year: budgetYear }
      });
      if (existing) existingBudgets.push(existing);
    } else {
      for (const month of budgetMonths) {
        for (const halfMonth of halfMonthValues) {
          const whereClause: any = {
            userId,
            category,
            type: budgetType,
            year: budgetYear,
            month
          };

          if (budgetType === 'bi-monthly') {
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

    if (budgetType === 'yearly') {
      const budget = await Budget.create({
        category,
        amount: amountNum,
        month: null,
        type: budgetType,
        year: budgetYear,
        halfMonth: null,
        userId
      });
      createdBudgets.push(budget);
    } else {
      for (const month of budgetMonths) {
        for (const halfMonth of halfMonthValues) {
          const budgetData: any = {
            category,
            amount: amountNum,
            month,
            type: budgetType,
            year: budgetYear,
            userId
          };

          if (budgetType === 'bi-monthly') {
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
      where
      // `month` is a name string — SQL ordering is alphabetical, so sort
      // chronologically in JS instead.
    });
    sortBudgets(budgets);

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

    const budget = await Budget.findOne({
      where: { id: parseInt(id), userId }
    });

    if (!budget) {
      res.status(404).json({ error: 'Budget not found' });
      return;
    }

    const budgetMonth = month || (months && months[0]) || budget.month || null;
    const budgetHalfMonth = halfMonth !== undefined ? halfMonth : (halfMonths && halfMonths[0]) || budget.halfMonth;
    // Fall back to stored values for anything the body omits, so the
    // duplicate check reflects the row as it will actually be saved.
    const newType = type || budget.type;
    const newCategory = category || budget.category;
    const newYear = year || budget.year;

    if (amount !== undefined && (!Number.isFinite(Number(amount)) || Number(amount) <= 0)) {
      res.status(400).json({ error: 'Amount must be a positive number' });
      return;
    }
    if (newType && !BUDGET_TYPES.includes(newType)) {
      res.status(400).json({ error: 'Invalid budget type' });
      return;
    }

    const existingBudget = await Budget.findOne({
      where: {
        userId,
        category: newCategory,
        type: newType,
        id: { [Op.ne]: parseInt(id) },
        ...(newType === 'monthly' && { month: budgetMonth, year: newYear, halfMonth: null }),
        ...(newType === 'yearly' && { year: newYear }),
        // bi-monthly rows are unique per (category, month, half) — the
        // previous check omitted `month`, causing false rejections across
        // different months.
        ...(newType === 'bi-monthly' && { month: budgetMonth, year: newYear, halfMonth: budgetHalfMonth as HalfMonth })
      }
    });

    if (existingBudget) {
      res.status(400).json({ error: 'A budget for this category and period already exists' });
      return;
    }

    await budget.update({
      category: newCategory,
      amount: amount !== undefined ? Number(amount) : budget.amount,
      month: (newType === 'monthly' || newType === 'bi-monthly') ? budgetMonth : null,
      type: newType,
      year: newYear,
      halfMonth: newType === 'bi-monthly' ? budgetHalfMonth : null
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