import {
	type CreationOptional,
	type InferAttributes,
	type InferCreationAttributes,
	Model,
} from "sequelize";

export type UserTenantRole = "member" | "admin";

export class UserTenant extends Model<
	InferAttributes<UserTenant>,
	InferCreationAttributes<UserTenant>
> {
	declare id: CreationOptional<number>;
	declare userId: string;
	declare tenantId: number;
	declare role: UserTenantRole;
	declare createdAt: CreationOptional<Date>;
	declare updatedAt: CreationOptional<Date>;
}
