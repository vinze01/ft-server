import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface TagAttributes {
  id: number;
  userId: number;
  name: string;
  color: string;
  createdAt?: Date;
}

interface TagCreationAttributes extends Optional<TagAttributes, 'id' | 'color'> {}

class Tag extends Model<TagAttributes, TagCreationAttributes> implements TagAttributes {
  public id!: number;
  public userId!: number;
  public name!: string;
  public color!: string;
  public readonly createdAt!: Date;
}

Tag.init(
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
      type: DataTypes.STRING(50),
      allowNull: false
    },
    color: {
      type: DataTypes.STRING(7),
      allowNull: false,
      defaultValue: '#6366f1'
    }
  },
  {
    tableName: 'tags',
    underscored: true,
    timestamps: true,
    sequelize
  }
);

export default Tag;