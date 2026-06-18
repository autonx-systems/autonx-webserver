import Sequelize, { DataTypes } from "sequelize";
import { dbConfig } from "../config/db.config";
import { Device } from "./device.model";
import { Tenant } from "./tenant.model";
import { UserTenant } from "./user_tenant.model";
import { View } from "./view.model";

const sequelize = new Sequelize.Sequelize(dbConfig.DB, dbConfig.USER, dbConfig.PASSWORD, {
  host: dbConfig.HOST,
  dialect: dbConfig.dialect,
  port: dbConfig.port,
  operatorsAliases: {},

  pool: {
    max: dbConfig.pool.max,
    min: dbConfig.pool.min,
    acquire: dbConfig.pool.acquire,
    idle: dbConfig.pool.idle
  }
});

export const db = {
  Sequelize,
  sequelize,
  models: {
    View,
    Tenant,
    UserTenant,
    Device,
  }
};

View.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    tenantId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    widgets: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    indexes: [{ fields: ["tenantId"] }],
  },
);

Tenant.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    slug: {
      type: DataTypes.STRING(40),
      allowNull: false,
      unique: true,
      validate: { is: /^[a-z0-9-]{3,40}$/ },
    },
    name: { type: DataTypes.STRING, allowNull: false },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  { sequelize, tableName: "tenants" },
);

UserTenant.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    userId: { type: DataTypes.STRING, allowNull: false },
    tenantId: { type: DataTypes.INTEGER, allowNull: false },
    role: {
      type: DataTypes.ENUM("member", "admin"),
      allowNull: false,
      defaultValue: "member",
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: "user_tenants",
    indexes: [{ unique: true, fields: ["userId", "tenantId"] }],
  },
);

Device.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    deviceId: {
      type: DataTypes.STRING(64),
      allowNull: false,
      validate: { is: /^[a-z0-9-]{8,64}$/ },
    },
    tenantId: { type: DataTypes.INTEGER, allowNull: false },
    certSerial: { type: DataTypes.STRING(128), allowNull: true },
    revokedAt: { type: DataTypes.DATE, allowNull: true },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: "devices",
    indexes: [{ unique: true, fields: ["tenantId", "deviceId"] }],
  },
);

UserTenant.belongsTo(Tenant, { foreignKey: "tenantId" });
Tenant.hasMany(UserTenant, { foreignKey: "tenantId" });
Device.belongsTo(Tenant, { foreignKey: "tenantId" });
Tenant.hasMany(Device, { foreignKey: "tenantId" });
View.belongsTo(Tenant, { foreignKey: "tenantId" });
Tenant.hasMany(View, { foreignKey: "tenantId" });

/**
 * Idempotent schema bootstrap.
 *
 * `db.sync()` historically aborted when a partial older schema existed
 * (see repo memory `schema-sync-notes`). We call `sync()` per-model
 * without `alter`/`force`, so existing tables are left untouched and
 * missing ones are created.
 *
 * MySQL inside docker-compose is typically still booting when the
 * webserver starts, so we retry `authenticate()` with backoff before
 * giving up.
 */
export const bootstrapDb = async (): Promise<void> => {
  const maxAttempts = Number(process.env.DB_BOOTSTRAP_MAX_ATTEMPTS ?? 30);
  const delayMs = Number(process.env.DB_BOOTSTRAP_RETRY_MS ?? 2000);
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await sequelize.authenticate();
      lastErr = undefined;
      break;
    } catch (err) {
      lastErr = err;
      console.warn(
        `[bootstrapDb] DB not ready (attempt ${attempt}/${maxAttempts}): ${
          (err as Error).message
        }`,
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  if (lastErr) throw lastErr;

  await Tenant.sync();
  await UserTenant.sync();
  await Device.sync();
  await View.sync();
  await migrateViewTenant();
  await seedDevTenant();
};

/**
 * One-time additive migration: give the `Views` table a `tenantId` column.
 *
 * `View.sync()` (no `alter`) creates the column on fresh databases but never
 * touches a pre-existing `Views` table, so an older deployment keeps a global,
 * tenant-less table. This adds the column, backfills existing rows to the
 * tenant named by `VIEW_BACKFILL_TENANT_SLUG`, then best-effort adds the FK +
 * index and tightens the column to NOT NULL once no NULLs remain.
 *
 * Idempotent: a no-op once the column exists. Aborts (throws) if a backfill
 * slug is configured but missing, rather than silently orphaning view rows.
 */
const migrateViewTenant = async (): Promise<void> => {
  const qi = sequelize.getQueryInterface();
  let table: Record<string, unknown>;
  try {
    table = await qi.describeTable("Views");
  } catch {
    // Table doesn't exist yet — View.sync() will have created it with the
    // tenantId column already; nothing to migrate.
    return;
  }
  if ("tenantId" in table) return; // already migrated

  console.log("[migrate] adding Views.tenantId column");
  await qi.addColumn("Views", "tenantId", {
    type: DataTypes.INTEGER,
    allowNull: true,
  });

  const slug = process.env.VIEW_BACKFILL_TENANT_SLUG;
  if (slug) {
    const tenant = await Tenant.findOne({ where: { slug } });
    if (!tenant) {
      throw new Error(
        `[migrate] VIEW_BACKFILL_TENANT_SLUG="${slug}" not found in tenants; ` +
          "aborting to avoid orphaning view rows.",
      );
    }
    await sequelize.query(
      "UPDATE `Views` SET `tenantId` = :tid WHERE `tenantId` IS NULL",
      { replacements: { tid: tenant.id } },
    );
    console.log(
      `[migrate] backfilled Views.tenantId -> tenant ${slug} (id=${tenant.id})`,
    );
  }

  try {
    await qi.addIndex("Views", ["tenantId"]);
  } catch (err) {
    console.warn(
      `[migrate] addIndex Views(tenantId) skipped: ${(err as Error).message}`,
    );
  }
  try {
    await qi.addConstraint("Views", {
      type: "foreign key",
      fields: ["tenantId"],
      name: "views_tenantId_fkey",
      references: { table: "tenants", field: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    });
  } catch (err) {
    console.warn(
      `[migrate] addConstraint Views FK skipped: ${(err as Error).message}`,
    );
  }

  const [rows] = await sequelize.query(
    "SELECT COUNT(*) AS cnt FROM `Views` WHERE `tenantId` IS NULL",
  );
  const remaining = Number((rows as Array<{ cnt: number }>)[0]?.cnt ?? 0);
  if (remaining === 0) {
    await qi.changeColumn("Views", "tenantId", {
      type: DataTypes.INTEGER,
      allowNull: false,
    });
    console.log("[migrate] Views.tenantId set NOT NULL");
  } else {
    console.warn(
      `[migrate] ${remaining} Views row(s) still have NULL tenantId ` +
        "(set VIEW_BACKFILL_TENANT_SLUG to a valid slug to fix); leaving column " +
        "nullable. These rows are invisible to all tenants.",
    );
  }
};

/**
 * Best-effort dev convenience: when `DEV_SEED_TENANT_SLUG` is set, make
 * sure that tenant exists and the configured user is a member of it.
 * Designed for `AUTH_MOCK=true` workflows where the mock user has no
 * real tenant assignment and the WS handshake would otherwise reject
 * every connection with "user has 0 tenants".
 *
 * Skipped in production. No-op if the env vars are absent.
 */
const seedDevTenant = async (): Promise<void> => {
  if (process.env.NODE_ENV === "production") return;
  const slug = process.env.DEV_SEED_TENANT_SLUG;
  const userId = process.env.DEV_SEED_USER_ID || process.env.MOCK_USER_ID;
  if (!slug || !userId) return;
  const name = process.env.DEV_SEED_TENANT_NAME || slug;

  const [tenant] = await Tenant.findOrCreate({
    where: { slug },
    defaults: { slug, name },
  });
  await UserTenant.findOrCreate({
    where: { userId, tenantId: tenant.id },
    defaults: { userId, tenantId: tenant.id, role: "admin" },
  });
  console.log(
    `[seed] dev tenant ready: slug=${slug} user=${userId} (tenant id=${tenant.id})`,
  );
};