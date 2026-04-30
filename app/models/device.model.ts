import { DataTypes, Model } from "sequelize";

export class Device extends Model {
	declare id: string;
	declare deviceId: string;
	declare tenantId: string;
	declare name: string;
	declare revokedAt: Date | null;
}

export const initDevice = (sequelize: any) => {
	Device.init(
		{
			id: {
				type: DataTypes.UUID,
				defaultValue: DataTypes.UUIDV4,
				primaryKey: true,
			},
			deviceId: {
				type: DataTypes.STRING,
				allowNull: false,
				unique: true,
				field: "device_id",
			},
			tenantId: {
				type: DataTypes.STRING,
				allowNull: false,
				field: "tenant_id",
			},
			name: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			revokedAt: {
				type: DataTypes.DATE,
				allowNull: true,
				field: "revoked_at",
			},
		},
		{
			sequelize,
			tableName: "devices",
			timestamps: true,
		},
	);
};
