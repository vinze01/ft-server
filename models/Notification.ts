import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface NotificationAttributes {
  id: number;
  userId: number;
  type: 'budget_alert' | 'bill_due' | 'goal_progress' | 'savings' | 'insight' | 'security';
  title: string;
  message: string;
  data?: any;
  isRead: boolean;
  readAt?: Date;
  scheduledFor?: Date;
  createdAt?: Date;
}

interface NotificationCreationAttributes extends Optional<NotificationAttributes, 'id' | 'data' | 'isRead' | 'readAt' | 'scheduledFor'> {}

class Notification extends Model<NotificationAttributes, NotificationCreationAttributes> implements NotificationAttributes {
  public id!: number;
  public userId!: number;
  public type!: 'budget_alert' | 'bill_due' | 'goal_progress' | 'savings' | 'insight' | 'security';
  public title!: string;
  public message!: string;
  public data?: any;
  public isRead!: boolean;
  public readAt?: Date;
  public scheduledFor?: Date;
  public readonly createdAt!: Date;
}

Notification.init(
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
      type: DataTypes.ENUM('budget_alert', 'bill_due', 'goal_progress', 'savings', 'insight', 'security'),
      allowNull: false
    },
    title: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    data: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    readAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    scheduledFor: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    tableName: 'notifications',
    underscored: true,
    timestamps: true,
    sequelize
  }
);

export default Notification;