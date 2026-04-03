import { DataTypes, Model, Optional, Association } from 'sequelize';
import sequelize from '../config/database';
import User from './User';

export type IncomeType = 'monthly' | 'yearly' | 'bi-monthly';
export type HalfMonth = 1 | 2; // 1 = 1st half (days 1-15), 2 = 2nd half (days 16-31)

interface IncomeAttributes {
  id: number;
  amount: number;
  month: string | null;
  type: IncomeType;
  year: number;
  halfMonth: HalfMonth | null;
  userId: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface IncomeCreationAttributes extends Optional<IncomeAttributes, 'id'> {}

class Income extends Model<IncomeAttributes, IncomeCreationAttributes> implements IncomeAttributes {
  public id!: number;
  public amount!: number;
  public month!: string | null;
  public type!: IncomeType;
  public year!: number;
  public halfMonth!: HalfMonth | null;
  public userId!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public static associations: {
    user: Association<User, Income>;
  };
}

Income.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
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
    tableName: 'incomes',
    underscored: true,
    timestamps: true,
    sequelize
  }
);

User.hasMany(Income, { foreignKey: 'userId' });
Income.belongsTo(User, { foreignKey: 'userId' });

export default Income;