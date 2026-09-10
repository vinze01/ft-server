import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface SessionAttributes {
  id: number;
  userId: number;
  tokenHash: string;
  deviceInfo?: string;
  ipAddress?: string;
  location?: string;
  userAgent?: string;
  isCurrent: boolean;
  expiresAt: Date;
  lastActiveAt?: Date;
  createdAt?: Date;
}

interface SessionCreationAttributes extends Optional<SessionAttributes, 'id' | 'deviceInfo' | 'ipAddress' | 'location' | 'userAgent' | 'isCurrent' | 'lastActiveAt'> {}

class Session extends Model<SessionAttributes, SessionCreationAttributes> implements SessionAttributes {
  public id!: number;
  public userId!: number;
  public tokenHash!: string;
  public deviceInfo?: string;
  public ipAddress?: string;
  public location?: string;
  public userAgent?: string;
  public isCurrent!: boolean;
  public expiresAt!: Date;
  public lastActiveAt?: Date;
  public readonly createdAt!: Date;
}

Session.init(
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
    tokenHash: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    deviceInfo: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    ipAddress: {
      type: DataTypes.STRING(45),
      allowNull: true
    },
    location: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    userAgent: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    isCurrent: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    lastActiveAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    tableName: 'sessions',
    underscored: true,
    timestamps: true,
    sequelize
  }
);

export default Session;