export interface Expense {
  id: number;
  description: string;
  amount: number;
  category: string;
  date: Date | string;
  userId: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ExpenseInput {
  description: string;
  amount: number;
  category: string;
  date: string;
}

export type IncomeType = 'monthly' | 'yearly' | 'bi-monthly';
export type HalfMonth = 1 | 2;

export interface Income {
  id: number;
  amount: number;
  month: string | null;
  type: IncomeType;
  year: number;
  halfMonth: HalfMonth | null;
  userId: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IncomeInput {
  amount: number;
  months?: string[];
  month?: string;
  type: IncomeType;
  year: number;
  halfMonths?: HalfMonth[];
  halfMonth?: HalfMonth;
}

export type BudgetType = 'monthly' | 'yearly' | 'bi-monthly';

export interface Budget {
  id: number;
  category: string;
  amount: number;
  month: string | null;
  type: BudgetType;
  year: number;
  halfMonth: HalfMonth | null;
  userId: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface BudgetInput {
  category: string;
  amount: number;
  months?: string[];
  month?: string;
  type: BudgetType;
  year: number;
  halfMonths?: HalfMonth[];
  halfMonth?: HalfMonth;
}

export interface ExpenseSummary {
  totalExpenses: Record<string, number>;
}

export interface DashboardSummary {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  expensesByCategory: Record<string, number>;
  monthlyData: MonthlyData[];
  yearlyData: YearlyData[];
  biMonthlyData: BiMonthlyData[];
}

export interface MonthlyData {
  month: string;
  income: number;
  expenses: number;
}

export interface YearlyData {
  year: number;
  income: number;
  expenses: number;
}

export interface BiMonthlyData {
  halfMonth: number;
  month: string;
  year: number;
  income: number;
  expenses: number;
}