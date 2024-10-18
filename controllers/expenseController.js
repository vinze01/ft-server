const Expense = require('../models/Expense');

const addExpense = async (req, res) => {
  const { description, amount, category, date } = req.body;
  try {
    const expense = await Expense.create({
      description,
      amount,
      category,
      date,
      UserId: req.userId
    });
    res.status(201).json(expense);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add expense' });
  }
};

const getExpenses = async (req, res) => {
  try {
    const expenses = await Expense.findAll({ where: { UserId: req.userId } });
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
};

const getExpensesForMonth = async (req, res) => {
  const { month } = req.query; // month format: "YYYY-MM"
  try {
    const expenses = await Expense.findAll({
      where: {
        UserId: req.userId,
        date: {
          [Op.like]: `${month}%`, // Match all days in the month
        },
      },
    });
    
    const totalExpenses = expenses.reduce((acc, expense) => {
      acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
      return acc;
    }, {});
    
    res.json({ totalExpenses });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch monthly expenses' });
  }
};



module.exports = { addExpense, getExpenses, getExpensesForMonth };
