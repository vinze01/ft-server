const Budget = require('../models/Budget');

// Add a new budget for a category
const addBudget = async (req, res) => {
  const { category, amount, month } = req.body;
  try {
    const budget = await Budget.create({
      category,
      amount,
      month,
      UserId: req.userId, // from JWT
    });
    res.status(201).json(budget);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add budget' });
  }
};

// Get budgets for the current month
// Get all budgets for the user (optional filtering by month)
const getBudgets = async (req, res) => {
  const { month } = req.query;
  try {
    const budgets = await Budget.findAll({
      where: { UserId: req.userId }, // Ensure req.userId is defined and valid
      ...(month && { month }), // Filter by month only if provided
    });
    res.json(budgets);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch budgets' });
  }
};



module.exports = { addBudget, getBudgets };
