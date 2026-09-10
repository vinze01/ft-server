import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface NotificationSettingsAttributes {
  id: number;
  userId: number;
  budgetAlerts: boolean;
  billReminders: boolean;
  goalUpdates: boolean;
  weeklySummary: boolean;
  insights: boolean;
  securityAlerts: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  updatedAt?: Date;
}

interface NotificationSettingsCreationAttributes extends Optional<NotificationSettingsAttributes, 'id' | 'budgetAlerts' | 'billReminders' | 'goalUpdates' | 'weeklySummary' | 'insights' | 'securityAlerts' | 'emailNotifications' | 'pushNotifications'> {}

class NotificationSettings extends Model<NotificationSettingsAttributes, NotificationSettingsCreationAttributes> implements NotificationSettingsAttributes {
  public id!: number;
  public userId!: number;
  public budgetAlerts!: boolean;
  public billReminders!: boolean;
  public goalUpdates!: boolean;
  public weeklySummary!: boolean;
  public insights!: boolean;
  public securityAlerts!: boolean;
  public emailNotifications!: boolean;
  public pushNotifications!: boolean;
  public readonly updatedAt!: Date;
}

NotificationSettings.init(
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
    budgetAlerts: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    billReminders: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    goalUpdates: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    weeklySummary: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    insights: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    securityAlerts: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    emailNotifications: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    pushNotifications: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    }
  },
  {
    tableName: 'user_notification_settings',
    underscored: true,
    timestamps: true,
    sequelize
  }
);

export default NotificationSettings;