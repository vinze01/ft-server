import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface GoalAttributes {
  id: number;
  userId: number;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: Date;
  category: 'emergency' | 'investment' | 'purchase' | 'travel' | 'other';
  priority: 'low' | 'medium' | 'high';
  imageUrl?: string;
  isCompleted: boolean;
  completedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface GoalCreationAttributes extends Optional<GoalAttributes, 'id' | 'currentAmount' | 'category' | 'priority' | 'imageUrl' | 'isCompleted' | 'completedAt'> {}

class Goal extends Model<GoalAttributes, GoalCreationAttributes> implements GoalAttributes {
  public id!: number;
  public userId!: number;
  public name!: string;
  public targetAmount!: number;
  public currentAmount!: number;
  public deadline?: Date;
  public category!: 'emergency' | 'investment' | 'purchase' | 'travel' | 'other';
  public priority!: 'low' | 'medium' | 'high';
  public imageUrl?: string;
  public isCompleted!: boolean;
  public completedAt?: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Goal.init(
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
    targetAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false
    },
    currentAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0
    },
    deadline: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    category: {
      type: DataTypes.ENUM('emergency', 'investment', 'purchase', 'travel', 'other'),
      allowNull: false,
      defaultValue: 'other'
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high'),
      allowNull: false,
      defaultValue: 'medium'
    },
    imageUrl: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    isCompleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    tableName: 'goals',
    underscored: true,
    timestamps: true,
    sequelize
  }
);

export default Goal;