import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface TransactionTagAttributes {
  transactionId: number;
  transactionType: 'income' | 'expense';
  tagId: number;
}

interface TransactionTagCreationAttributes extends Optional<TransactionTagAttributes, 'transactionId' | 'transactionType' | 'tagId'> {}

class TransactionTag extends Model<TransactionTagAttributes, TransactionTagCreationAttributes> implements TransactionTagAttributes {
  public transactionId!: number;
  public transactionType!: 'income' | 'expense';
  public tagId!: number;
}

TransactionTag.init(
  {
    transactionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    transactionType: {
      type: DataTypes.ENUM('income', 'expense'),
      allowNull: false,
      primaryKey: true
    },
    tagId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: {
        model: 'tags',
        key: 'id'
      }
    }
  },
  {
    tableName: 'transaction_tags',
    underscored: true,
    timestamps: false,
    sequelize
  }
);

export default TransactionTag;