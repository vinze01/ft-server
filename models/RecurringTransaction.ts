import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface RecurringTransactionAttributes {
  id: number;
  userId: number;
  type: 'income' | 'expense';
  amount: number;
  categoryId?: number;
  accountId?: number;
  description?: string;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  startDate: Date;
  endDate?: Date;
  nextExecution: Date;
  executionDay?: number;
  autoGenerate: boolean;
  reminderDaysBefore: number;
  isActive: boolean;
  lastExecutedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface RecurringTransactionCreationAttributes extends Optional<RecurringTransactionAttributes, 'id' | 'description' | 'endDate' | 'executionDay' | 'autoGenerate' | 'reminderDaysBefore' | 'isActive' | 'lastExecutedAt'> {}

class RecurringTransaction extends Model<RecurringTransactionAttributes, RecurringTransactionCreationAttributes> implements RecurringTransactionAttributes {
  public id!: number;
  public userId!: number;
  public type!: 'income' | 'expense';
  public amount!: number;
  public categoryId?: number;
  public accountId?: number;
  public description?: string;
  public frequency!: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  public startDate!: Date;
  public endDate?: Date;
  public nextExecution!: Date;
  public executionDay?: number;
  public autoGenerate!: boolean;
  public reminderDaysBefore!: number;
  public isActive!: boolean;
  public lastExecutedAt?: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

RecurringTransaction.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    type: {
      type: DataTypes.ENUM('income', 'expense'),
      allowNull: false
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false
    },
    categoryId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    accountId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    frequency: {
      type: DataTypes.ENUM('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'),
      allowNull: false
    },
    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    endDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    nextExecution: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    executionDay: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    autoGenerate: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    reminderDaysBefore: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    lastExecutedAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    tableName: 'recurring_transactions',
    underscored: true,
    timestamps: true,
    sequelize
  }
);

export default RecurringTransaction;