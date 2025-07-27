import { CreationOptional, InferAttributes, InferCreationAttributes, Model } from "sequelize";

export class View extends Model<InferAttributes<View>, InferCreationAttributes<View>> {
  declare id: CreationOptional<string>;
  declare title: string;
  declare description: string;
}
