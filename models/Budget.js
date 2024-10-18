// models/Budget.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const Budget = sequelize.define('Budget', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  category: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  amount: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  month: {
    type: DataTypes.STRING, // Format: "YYYY-MM"
    allowNull: false,
  },
});

User.hasMany(Budget);
Budget.belongsTo(User);

module.exports = Budget;
