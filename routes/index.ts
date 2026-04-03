import { Router, Request, Response } from 'express';
import { register, login, authenticate, getCurrentUser } from '../controllers/authController';
import { addExpense, getExpenses, getExpensesForMonth, updateExpense, deleteExpense } from '../controllers/expenseController';
import { addIncome, getIncomes, getTotalIncome, updateIncome, deleteIncome } from '../controllers/incomeController';
import { addBudget, getBudgets, updateBudget, deleteBudget } from '../controllers/budgetController';
import { getDashboardSummary } from '../controllers/dashboardController';
import { updateProfile, updatePassword, uploadAvatar, deleteAccount } from '../controllers/userController';
import multer from 'multer';

const router = Router();
const upload = multer({ 
  dest: 'uploads/',
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + '-' + Math.random().toString(36).substring(7));
    }
  })
});

router.post('/register', upload.single('avatar'), register);
router.post('/login', login);
router.get('/me', authenticate, getCurrentUser);

router.put('/users/profile', authenticate, updateProfile);
router.put('/users/password', authenticate, updatePassword);
router.post('/users/avatar', authenticate, upload.single('avatar'), uploadAvatar);
router.delete('/users/account', authenticate, deleteAccount);

router.get('/dashboard', authenticate, getDashboardSummary);

router.post('/expenses', authenticate, addExpense);
router.get('/expenses', authenticate, getExpenses);
router.get('/expenses/summary', authenticate, getExpensesForMonth);
router.put('/expenses/:id', authenticate, updateExpense);
router.delete('/expenses/:id', authenticate, deleteExpense);

router.post('/incomes', authenticate, addIncome);
router.get('/incomes', authenticate, getIncomes);
router.get('/incomes/total', authenticate, getTotalIncome);
router.put('/incomes/:id', authenticate, updateIncome);
router.delete('/incomes/:id', authenticate, deleteIncome);

router.post('/budgets', authenticate, addBudget);
router.get('/budgets', authenticate, getBudgets);
router.put('/budgets/:id', authenticate, updateBudget);
router.delete('/budgets/:id', authenticate, deleteBudget);

export default router;
