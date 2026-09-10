import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import Goal from './Goal';

interface SavingsAllocationAttributes {
  id: number;
  userId: number;
  savingsConfigId: number;
  goalId?: number;
  amount: number;
  periodStart: Date;
  periodEnd: Date;
  status: 'pending' | 'allocated' | 'failed';
  createdAt?: Date;
}

interface SavingsAllocationCreationAttributes extends Optional<SavingsAllocationAttributes, 'id' | 'goalId' | 'status'> {}

class SavingsAllocation extends Model<SavingsAllocationAttributes, SavingsAllocationCreationAttributes> implements SavingsAllocationAttributes {
  public id!: number;
  public userId!: number;
  public savingsConfigId!: number;
  public goalId?: number;
  public amount!: number;
  public periodStart!: Date;
  public periodEnd!: Date;
  public status!: 'pending' | 'allocated' | 'failed';
  public readonly createdAt!: Date;
}

SavingsAllocation.init(
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
    savingsConfigId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'savings_configs',
        key: 'id'
      }
    },
    goalId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false
    },
    periodStart: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    periodEnd: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('pending', 'allocated', 'failed'),
      allowNull: false,
      defaultValue: 'pending'
    }
  },
  {
    tableName: 'savings_allocations',
    underscored: true,
    timestamps: true,
    sequelize
  }
);

Goal.hasMany(SavingsAllocation, { foreignKey: 'goalId' });
SavingsAllocation.belongsTo(Goal, { as: 'goal', foreignKey: 'goalId' });

export default SavingsAllocation;