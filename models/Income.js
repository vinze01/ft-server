// models/Income.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database'); // assuming you have a configured sequelize instance

const Income = sequelize.define('Income', {
  amount: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  month: {
    type: DataTypes.STRING, // E.g., 'October 2024'
    allowNull: false,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users', // Assumes you have a User model
      key: 'id',
    },
  },
});

module.exports = Income;
