import {
	type CreationOptional,
	type InferAttributes,
	type InferCreationAttributes,
	Model,
} from "sequelize";

export class Tenant extends Model<
	InferAttributes<Tenant>,
	InferCreationAttributes<Tenant>
> {
	declare id: CreationOptional<number>;
	declare slug: string;
	declare name: string;
	declare createdAt: CreationOptional<Date>;
	declare updatedAt: CreationOptional<Date>;
}
