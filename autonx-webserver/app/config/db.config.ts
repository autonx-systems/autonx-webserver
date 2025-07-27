import { Dialect } from "sequelize";

export const dbConfig = {
  HOST: process.env.DB_HOST ?? "test-db-host",
  USER: process.env.DB_USER ?? "test-db-user",
  PASSWORD: process.env.DB_PASSWORD ?? "test-db-password",
  DB: process.env.DB_NAME ?? "test-db-name",
  port: process.env.DB_PORT && Number.isInteger(process.env.DB_PORT) ? parseInt(process.env.DB_PORT) : 3306,
  dialect: "mysql" as Dialect,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
};
