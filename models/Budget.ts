import { DataTypes, Model, Optional, Association } from 'sequelize';
import sequelize from '../config/database';
import User from './User';

export type BudgetType = 'monthly' | 'yearly' | 'bi-monthly';
export type HalfMonth = 1 | 2; // 1 = 1st half (days 1-15), 2 = 2nd half (days 16-31)

interface BudgetAttributes {
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

interface BudgetCreationAttributes extends Optional<BudgetAttributes, 'id'> {}

class Budget extends Model<BudgetAttributes, BudgetCreationAttributes> implements BudgetAttributes {
  public id!: number;
  public category!: string;
  public amount!: number;
  public month!: string | null;
  public type!: BudgetType;
  public year!: number;
  public halfMonth!: HalfMonth | null;
  public userId!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public static associations: {
    user: Association<User, Budget>;
  };
}

Budget.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    category: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    month: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    type: {
      type: DataTypes.ENUM('monthly', 'yearly', 'bi-monthly'),
      allowNull: false,
      defaultValue: 'monthly'
    },
    year: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: () => new Date().getFullYear()
    },
    halfMonth: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '1 = 1st half (days 1-15), 2 = 2nd half (days 16-31)'
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    }
  },
  {
    tableName: 'budgets',
    underscored: true,
    timestamps: true,
    sequelize
  }
);

User.hasMany(Budget, { foreignKey: 'userId' });
Budget.belongsTo(User, { foreignKey: 'userId' });

export default Budget;