import {
	type CreationOptional,
	type InferAttributes,
	type InferCreationAttributes,
	Model,
} from "sequelize";

export class Device extends Model<
	InferAttributes<Device>,
	InferCreationAttributes<Device>
> {
	declare id: CreationOptional<number>;
	declare deviceId: string;
	declare tenantId: number;
	declare certSerial: string | null;
	declare revokedAt: Date | null;
	declare createdAt: CreationOptional<Date>;
	declare updatedAt: CreationOptional<Date>;
}
