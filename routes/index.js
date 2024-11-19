const express = require('express');
const { register, login, authenticate } = require('../controllers/authController');
const { addExpense, getExpenses, getExpensesForMonth } = require('../controllers/expenseController');
const { addBudget, getBudgets } = require('../controllers/budgetController');
const upload = require("../middleware/upload");
const router = express.Router();

// User Authentication Routes
router.post('/register', upload.single("avatar"), register);
router.post('/login', login);

// Expense Routes
router.post('/expenses', authenticate, addExpense);
router.get('/expenses', authenticate, getExpenses);
router.get('/expenses/summary', authenticate, getExpensesForMonth);

// Budget Routes
router.post('/budgets', authenticate, addBudget);
router.get('/budgets', authenticate, getBudgets);

module.exports = router;
