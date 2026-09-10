import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface AutomationRuleAttributes {
  id: number;
  userId: number;
  name: string;
  description?: string;
  triggerType: 'transaction_added' | 'balance_low' | 'due_date' | 'recurring_executed' | 'periodic';
  triggerConditions: any;
  actionType: 'allocate_savings' | 'send_notification' | 'create_transaction' | 'mark_paid';
  actionParams: any;
  isActive: boolean;
  executionCount: number;
  lastExecutedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface AutomationRuleCreationAttributes extends Optional<AutomationRuleAttributes, 'id' | 'description' | 'isActive' | 'executionCount' | 'lastExecutedAt'> {}

class AutomationRule extends Model<AutomationRuleAttributes, AutomationRuleCreationAttributes> implements AutomationRuleAttributes {
  public id!: number;
  public userId!: number;
  public name!: string;
  public description?: string;
  public triggerType!: 'transaction_added' | 'balance_low' | 'due_date' | 'recurring_executed' | 'periodic';
  public triggerConditions!: any;
  public actionType!: 'allocate_savings' | 'send_notification' | 'create_transaction' | 'mark_paid';
  public actionParams!: any;
  public isActive!: boolean;
  public executionCount!: number;
  public lastExecutedAt?: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

AutomationRule.init(
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
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    triggerType: {
      type: DataTypes.ENUM('transaction_added', 'balance_low', 'due_date', 'recurring_executed', 'periodic'),
      allowNull: false
    },
    triggerConditions: {
      type: DataTypes.JSONB,
      allowNull: false
    },
    actionType: {
      type: DataTypes.ENUM('allocate_savings', 'send_notification', 'create_transaction', 'mark_paid'),
      allowNull: false
    },
    actionParams: {
      type: DataTypes.JSONB,
      allowNull: false
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    executionCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    lastExecutedAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    tableName: 'automation_rules',
    underscored: true,
    timestamps: true,
    sequelize
  }
);

export default AutomationRule;