import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface AccountAttributes {
  id: number;
  userId: number;
  name: string;
  type: 'cash' | 'bank' | 'e_wallet' | 'credit_card' | 'investment';
  balance: number;
  currency: string;
  color?: string;
  icon?: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface AccountCreationAttributes extends Optional<AccountAttributes, 'id' | 'balance' | 'color' | 'icon' | 'isDefault' | 'isActive'> {}

class Account extends Model<AccountAttributes, AccountCreationAttributes> implements AccountAttributes {
  public id!: number;
  public userId!: number;
  public name!: string;
  public type!: 'cash' | 'bank' | 'e_wallet' | 'credit_card' | 'investment';
  public balance!: number;
  public currency!: string;
  public color?: string;
  public icon?: string;
  public isDefault!: boolean;
  public isActive!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Account.init(
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
    type: {
      type: DataTypes.ENUM('cash', 'bank', 'e_wallet', 'credit_card', 'investment'),
      allowNull: false,
      defaultValue: 'bank'
    },
    balance: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'USD'
    },
    color: {
      type: DataTypes.STRING(7),
      allowNull: true
    },
    icon: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    }
  },
  {
    tableName: 'accounts',
    underscored: true,
    timestamps: true,
    sequelize
  }
);

export default Account;