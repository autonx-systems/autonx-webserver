import {
	type CreationOptional,
	type InferAttributes,
	type InferCreationAttributes,
	Model,
} from "sequelize";

export class MessageSchema extends Model<
	InferAttributes<MessageSchema>,
	InferCreationAttributes<MessageSchema>
> {
	declare id: CreationOptional<number>;
	declare tenantId: number;
	declare protocol: "ros2" | "mavlink";
	declare name: string;
	declare definition: string;
	declare createdAt: CreationOptional<Date>;
	declare updatedAt: CreationOptional<Date>;
}
