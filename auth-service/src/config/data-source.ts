import "reflect-metadata";
import { DataSource } from "typeorm";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { Credential } from "@auth/entities/Credential.js";
import { RefreshToken } from "@auth/entities/RefreshToken.js";
import { getEnvOrThrow } from "@auth/utils/getEnvOrThrow.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const AuthDataSource = new DataSource({
  type: "postgres",
  host: getEnvOrThrow("AUTH_DB_HOST"),
  port: Number(getEnvOrThrow("AUTH_DB_PORT")),
  username: getEnvOrThrow("AUTH_DB_USER"),
  password: getEnvOrThrow("AUTH_DB_PASSWORD"),
  database: getEnvOrThrow("AUTH_DB_NAME"),
  synchronize: false,
  logging: false,
  poolSize: 10,
  entities: [Credential, RefreshToken],
  migrations: [__dirname + "/../migrations/*.{js,ts}"],
});
