import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface UserAttributes {
  id: number;
  username: string;
  password: string;
  firstName: string;
  middleName: string;
  lastName: string;
  contactNo: number;
  email: string;
  avatar?: string;
  resetToken?: string;
  resetTokenExpiry?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'avatar' | 'middleName' | 'resetToken' | 'resetTokenExpiry'> {}

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: number;
  public username!: string;
  public password!: string;
  public firstName!: string;
  public middleName!: string;
  public lastName!: string;
  public contactNo!: number;
  public email!: string;
  public avatar?: string;
  public resetToken?: string;
  public resetTokenExpiry?: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    username: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    firstName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'first_name'
    },
    middleName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'middle_name'
    },
    lastName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'last_name'
    },
    contactNo: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: 'contact_no'
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    avatar: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    resetToken: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    resetTokenExpiry: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'reset_token_expiry'
    }
  },
  {
    tableName: 'users',
    underscored: true,
    timestamps: true,
    sequelize
  }
);

export default User;
