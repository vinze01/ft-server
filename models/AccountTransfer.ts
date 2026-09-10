import { DataTypes, Model, Optional, Association } from 'sequelize';
import sequelize from '../config/database';
import Account from './Account';

interface AccountTransferAttributes {
  id: number;
  userId: number;
  fromAccountId: number;
  toAccountId: number;
  amount: number;
  fee: number;
  note?: string;
  createdAt?: Date;
}

interface AccountTransferCreationAttributes extends Optional<AccountTransferAttributes, 'id' | 'fee' | 'note'> {}

class AccountTransfer extends Model<AccountTransferAttributes, AccountTransferCreationAttributes> implements AccountTransferAttributes {
  public id!: number;
  public userId!: number;
  public fromAccountId!: number;
  public toAccountId!: number;
  public amount!: number;
  public fee!: number;
  public note!: string;
  public readonly createdAt!: Date;

  public fromAccount!: Account;
  public toAccount!: Account;

  static associations: {
    fromAccount: Association<AccountTransfer, Account>;
    toAccount: Association<AccountTransfer, Account>;
  };
}

AccountTransfer.init(
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
    fromAccountId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'accounts',
        key: 'id'
      }
    },
    toAccountId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'accounts',
        key: 'id'
      }
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false
    },
    fee: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0
    },
    note: {
      type: DataTypes.STRING(255),
      allowNull: true
    }
  },
  {
    tableName: 'account_transfers',
    underscored: true,
    timestamps: true,
    sequelize
  }
);

export default AccountTransfer;