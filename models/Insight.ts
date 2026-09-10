import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface InsightAttributes {
  id: number;
  userId: number;
  type: 'overspending' | 'savings_drop' | 'burn_rate' | 'category_alert' | 'trend';
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'alert';
  data?: any;
  month: number;
  year: number;
  createdAt?: Date;
}

interface InsightCreationAttributes extends Optional<InsightAttributes, 'id' | 'data'> {}

class Insight extends Model<InsightAttributes, InsightCreationAttributes> implements InsightAttributes {
  public id!: number;
  public userId!: number;
  public type!: 'overspending' | 'savings_drop' | 'burn_rate' | 'category_alert' | 'trend';
  public title!: string;
  public description!: string;
  public severity!: 'info' | 'warning' | 'alert';
  public data?: any;
  public month!: number;
  public year!: number;
  public readonly createdAt!: Date;
}

Insight.init(
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
      type: DataTypes.ENUM('overspending', 'savings_drop', 'burn_rate', 'category_alert', 'trend'),
      allowNull: false
    },
    title: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    severity: {
      type: DataTypes.ENUM('info', 'warning', 'alert'),
      allowNull: false,
      defaultValue: 'info'
    },
    data: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    month: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    year: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  },
  {
    tableName: 'insights_cache',
    underscored: true,
    timestamps: true,
    sequelize
  }
);

export default Insight;