import {
	type CreationOptional,
	type InferAttributes,
	type InferCreationAttributes,
	Model,
} from "sequelize";

export class View extends Model<
	InferAttributes<View>,
	InferCreationAttributes<View>
> {
	declare id: CreationOptional<number>;
	declare name: string;
  declare description: string | null;
  declare widgets: string | null;
}