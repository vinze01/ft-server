import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface SavingsConfigAttributes {
  id: number;
  userId: number;
  mode: 'fixed_percentage' | 'leftover_based' | 'goal_based';
  targetPercentage?: number;
  targetAccountId?: number;
  spendingAccountId?: number;
  minBalance: number;
  isActive: boolean;
  lastCalculatedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface SavingsConfigCreationAttributes extends Optional<SavingsConfigAttributes, 'id' | 'targetPercentage' | 'targetAccountId' | 'spendingAccountId' | 'minBalance' | 'isActive' | 'lastCalculatedAt'> {}

class SavingsConfig extends Model<SavingsConfigAttributes, SavingsConfigCreationAttributes> implements SavingsConfigAttributes {
  public id!: number;
  public userId!: number;
  public mode!: 'fixed_percentage' | 'leftover_based' | 'goal_based';
  public targetPercentage?: number;
  public targetAccountId?: number;
  public spendingAccountId?: number;
  public minBalance!: number;
  public isActive!: boolean;
  public lastCalculatedAt?: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

SavingsConfig.init(
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
    mode: {
      type: DataTypes.ENUM('fixed_percentage', 'leftover_based', 'goal_based'),
      allowNull: false,
      defaultValue: 'fixed_percentage'
    },
    targetPercentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true
    },
    targetAccountId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    spendingAccountId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    minBalance: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    lastCalculatedAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    tableName: 'savings_configs',
    underscored: true,
    timestamps: true,
    sequelize
  }
);

export default SavingsConfig;