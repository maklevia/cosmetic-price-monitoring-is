import { MigrationInterface, QueryRunner } from "typeorm";

export class AuthInit1792939200000 implements MigrationInterface {
  name = "AuthInit1792939200000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "Credentials" (
        "id" SERIAL NOT NULL,
        "email" character varying(255) NOT NULL,
        "password_hash" character varying(255) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_credentials_email" UNIQUE ("email"),
        CONSTRAINT "PK_credentials" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "Refresh_Tokens" (
        "id" SERIAL NOT NULL,
        "credential_id" integer NOT NULL,
        "token_hash" character varying(64) NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "revoked_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_refresh_tokens_token_hash" UNIQUE ("token_hash"),
        CONSTRAINT "PK_refresh_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "FK_refresh_tokens_credential"
          FOREIGN KEY ("credential_id")
          REFERENCES "Credentials"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_refresh_tokens_credential_id" ON "Refresh_Tokens" ("credential_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_refresh_tokens_expires_at" ON "Refresh_Tokens" ("expires_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "Refresh_Tokens"`);
    await queryRunner.query(`DROP TABLE "Credentials"`);
  }
}
