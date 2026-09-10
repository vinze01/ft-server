import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface BillAttributes {
  id: number;
  userId: number;
  name: string;
  amount: number;
  categoryId?: number;
  accountId?: number;
  dueDay: number;
  frequency: 'monthly' | 'quarterly' | 'yearly' | 'one_time';
  nextDueDate: Date;
  isSubscription: boolean;
  isPaid: boolean;
  paidDate?: Date;
  reminderDays: number;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface BillCreationAttributes extends Optional<BillAttributes, 'id' | 'categoryId' | 'accountId' | 'isSubscription' | 'isPaid' | 'paidDate' | 'reminderDays' | 'notes'> {}

class Bill extends Model<BillAttributes, BillCreationAttributes> implements BillAttributes {
  public id!: number;
  public userId!: number;
  public name!: string;
  public amount!: number;
  public categoryId?: number;
  public accountId?: number;
  public dueDay!: number;
  public frequency!: 'monthly' | 'quarterly' | 'yearly' | 'one_time';
  public nextDueDate!: Date;
  public isSubscription!: boolean;
  public isPaid!: boolean;
  public paidDate?: Date;
  public reminderDays!: number;
  public notes?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Bill.init(
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
    name: {
      type: DataTypes.STRING(100),
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
    dueDay: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    frequency: {
      type: DataTypes.ENUM('monthly', 'quarterly', 'yearly', 'one_time'),
      allowNull: false,
      defaultValue: 'monthly'
    },
    nextDueDate: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    isSubscription: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    isPaid: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    paidDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    reminderDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 3
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  },
  {
    tableName: 'bills',
    underscored: true,
    timestamps: true,
    sequelize
  }
);

export default Bill;