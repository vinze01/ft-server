import { DataTypes, Model, Optional, Association } from 'sequelize';
import sequelize from '../config/database';
import User from './User';

interface ExpenseAttributes {
  id: number;
  description: string;
  amount: number;
  category: string;
  date: Date | string;
  userId: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ExpenseCreationAttributes extends Optional<ExpenseAttributes, 'id'> {}

class Expense extends Model<ExpenseAttributes, ExpenseCreationAttributes> implements ExpenseAttributes {
  public id!: number;
  public description!: string;
  public amount!: number;
  public category!: string;
  public date!: Date | string;
  public userId!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public static associations: {
    user: Association<User, Expense>;
  };
}

Expense.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    category: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false
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
    tableName: 'expenses',
    underscored: true,
    timestamps: true,
    sequelize
  }
);

User.hasMany(Expense, { foreignKey: 'userId' });
Expense.belongsTo(User, { foreignKey: 'userId' });

export default Expense;
