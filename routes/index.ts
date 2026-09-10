import { Router, Request, Response } from 'express';
import { register, login, authenticate, getCurrentUser } from '../controllers/authController';
import { addExpense, getExpenses, getExpensesForMonth, updateExpense, deleteExpense } from '../controllers/expenseController';
import { addIncome, getIncomes, getTotalIncome, updateIncome, deleteIncome } from '../controllers/incomeController';
import { addBudget, getBudgets, updateBudget, deleteBudget } from '../controllers/budgetController';
import { getDashboardSummary } from '../controllers/dashboardController';
import { updateProfile, updatePassword, uploadAvatar, deleteAccount } from '../controllers/userController';
import { forgotPassword, resetPassword } from '../controllers/passwordController';
import accountController from '../controllers/accountController';
import billController from '../controllers/billController';
import goalController from '../controllers/goalController';
import recurringController from '../controllers/recurringController';
import tagController from '../controllers/tagController';
import savingsController from '../controllers/savingsController';
import automationController from '../controllers/automationController';
import analyticsController from '../controllers/analyticsController';
import exportController from '../controllers/exportController';
import securityController from '../controllers/securityController';
import notificationController from '../controllers/notificationController';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Auth
router.post('/register', upload.none(), register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/me', authenticate, getCurrentUser);

// User
router.put('/users/profile', authenticate, updateProfile);
router.put('/users/password', authenticate, updatePassword);
router.post('/users/avatar', authenticate, upload.single('avatar'), uploadAvatar);
router.delete('/users/account', authenticate, deleteAccount);

// Dashboard
router.get('/dashboard', authenticate, getDashboardSummary);

// Expenses
router.post('/expenses', authenticate, addExpense);
router.get('/expenses', authenticate, getExpenses);
router.get('/expenses/summary', authenticate, getExpensesForMonth);
router.put('/expenses/:id', authenticate, updateExpense);
router.delete('/expenses/:id', authenticate, deleteExpense);

// Incomes
router.post('/incomes', authenticate, addIncome);
router.get('/incomes', authenticate, getIncomes);
router.get('/incomes/total', authenticate, getTotalIncome);
router.put('/incomes/:id', authenticate, updateIncome);
router.delete('/incomes/:id', authenticate, deleteIncome);

// Budgets
router.post('/budgets', authenticate, addBudget);
router.get('/budgets', authenticate, getBudgets);
router.put('/budgets/:id', authenticate, updateBudget);
router.delete('/budgets/:id', authenticate, deleteBudget);

// Accounts
router.get('/accounts', authenticate, accountController.getAll.bind(accountController));
router.get('/accounts/:id', authenticate, accountController.getOne.bind(accountController));
router.post('/accounts', authenticate, accountController.create.bind(accountController));
router.put('/accounts/:id', authenticate, accountController.update.bind(accountController));
router.delete('/accounts/:id', authenticate, accountController.delete.bind(accountController));
router.get('/accounts/summary', authenticate, accountController.getSummary.bind(accountController));
router.post('/accounts/transfer', authenticate, accountController.transfer.bind(accountController));
router.get('/accounts/transfers', authenticate, accountController.getTransfers.bind(accountController));

// Bills
router.get('/bills', authenticate, billController.getAll.bind(billController));
router.get('/bills/due-soon', authenticate, billController.getDueSoon.bind(billController));
router.get('/bills/summary', authenticate, billController.getSummary.bind(billController));
router.get('/bills/:id', authenticate, billController.getOne.bind(billController));
router.post('/bills', authenticate, billController.create.bind(billController));
router.put('/bills/:id', authenticate, billController.update.bind(billController));
router.delete('/bills/:id', authenticate, billController.delete.bind(billController));
router.post('/bills/:id/mark-paid', authenticate, billController.markPaid.bind(billController));
router.post('/bills/:id/mark-unpaid', authenticate, billController.markUnpaid.bind(billController));

// Goals
router.get('/goals', authenticate, goalController.getAll.bind(goalController));
router.get('/goals/summary', authenticate, goalController.getSummary.bind(goalController));
router.get('/goals/:id', authenticate, goalController.getOne.bind(goalController));
router.post('/goals', authenticate, goalController.create.bind(goalController));
router.put('/goals/:id', authenticate, goalController.update.bind(goalController));
router.delete('/goals/:id', authenticate, goalController.delete.bind(goalController));
router.post('/goals/:id/contribute', authenticate, goalController.contribute.bind(goalController));
router.get('/goals/:id/progress', authenticate, goalController.getProgress.bind(goalController));

// Recurring
router.get('/recurring', authenticate, recurringController.getAll.bind(recurringController));
router.get('/recurring/upcoming', authenticate, recurringController.getUpcoming.bind(recurringController));
router.get('/recurring/:id', authenticate, recurringController.getOne.bind(recurringController));
router.post('/recurring', authenticate, recurringController.create.bind(recurringController));
router.put('/recurring/:id', authenticate, recurringController.update.bind(recurringController));
router.delete('/recurring/:id', authenticate, recurringController.delete.bind(recurringController));
router.post('/recurring/:id/execute', authenticate, recurringController.execute.bind(recurringController));

// Tags
router.get('/tags', authenticate, tagController.getAll.bind(tagController));
router.post('/tags', authenticate, tagController.create.bind(tagController));
router.put('/tags/:id', authenticate, tagController.update.bind(tagController));
router.delete('/tags/:id', authenticate, tagController.delete.bind(tagController));
router.post('/tags/:id/transactions', authenticate, tagController.addToTransactions.bind(tagController));
router.get('/tags/:id/transactions', authenticate, tagController.getTransactions.bind(tagController));

// Savings
router.get('/savings/config', authenticate, savingsController.getConfig.bind(savingsController));
router.post('/savings/config', authenticate, savingsController.createOrUpdateConfig.bind(savingsController));
router.post('/savings/config/activate', authenticate, savingsController.activate.bind(savingsController));
router.post('/savings/config/deactivate', authenticate, savingsController.deactivate.bind(savingsController));
router.post('/savings/calculate', authenticate, savingsController.calculate.bind(savingsController));
router.get('/savings/allocations', authenticate, savingsController.getAllocations.bind(savingsController));
router.get('/savings/projection', authenticate, savingsController.getProjection.bind(savingsController));

// Automations
router.get('/automations', authenticate, automationController.getAll.bind(automationController));
router.get('/automations/:id', authenticate, automationController.getOne.bind(automationController));
router.post('/automations', authenticate, automationController.create.bind(automationController));
router.put('/automations/:id', authenticate, automationController.update.bind(automationController));
router.delete('/automations/:id', authenticate, automationController.delete.bind(automationController));
router.post('/automations/:id/toggle', authenticate, automationController.toggle.bind(automationController));
router.post('/automations/:id/test', authenticate, automationController.test.bind(automationController));
router.post('/automations/execute', authenticate, automationController.executeAll.bind(automationController));

// Analytics
router.get('/analytics/expenses-by-category', authenticate, analyticsController.getExpensesByCategory.bind(analyticsController));
router.get('/analytics/income-by-category', authenticate, analyticsController.getIncomeByCategory.bind(analyticsController));
router.get('/analytics/trends', authenticate, analyticsController.getTrends.bind(analyticsController));
router.get('/analytics/savings-rate', authenticate, analyticsController.getSavingsRate.bind(analyticsController));
router.get('/analytics/net-worth', authenticate, analyticsController.getNetWorth.bind(analyticsController));
router.get('/analytics/burn-rate', authenticate, analyticsController.getBurnRate.bind(analyticsController));

// Export/Import
router.get('/export/transactions', authenticate, exportController.exportTransactions.bind(exportController));
router.get('/export/full-data', authenticate, exportController.exportFullData.bind(exportController));
router.post('/import/transactions', authenticate, upload.single('file'), exportController.importTransactions.bind(exportController));
router.get('/import/template', exportController.getTemplate.bind(exportController));

// Security
router.post('/security/2fa/enable', authenticate, securityController.enable2FA.bind(securityController));
router.post('/security/2fa/verify', authenticate, securityController.verify2FA.bind(securityController));
router.post('/security/2fa/disable', authenticate, securityController.disable2FA.bind(securityController));
router.get('/security/sessions', authenticate, securityController.getSessions.bind(securityController));
router.delete('/security/sessions/other', authenticate, securityController.revokeOtherSessions.bind(securityController));
router.delete('/security/sessions/:id', authenticate, securityController.revokeSession.bind(securityController));
router.get('/security/devices', authenticate, securityController.getDevices.bind(securityController));
router.put('/security/password', authenticate, securityController.changePassword.bind(securityController));

// Notifications
router.get('/notifications', authenticate, notificationController.getAll.bind(notificationController));
router.get('/notifications/unread-count', authenticate, notificationController.getUnreadCount.bind(notificationController));
router.post('/notifications/:id/read', authenticate, notificationController.markAsRead.bind(notificationController));
router.post('/notifications/read-all', authenticate, notificationController.markAllAsRead.bind(notificationController));
router.delete('/notifications/:id', authenticate, notificationController.delete.bind(notificationController));
router.get('/notifications/settings', authenticate, notificationController.getSettings.bind(notificationController));
router.put('/notifications/settings', authenticate, notificationController.updateSettings.bind(notificationController));

export default router;