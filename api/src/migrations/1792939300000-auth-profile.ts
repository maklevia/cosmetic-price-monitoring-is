import { MigrationInterface, QueryRunner } from "typeorm";

export class AuthProfile1792939300000 implements MigrationInterface {
  name = "AuthProfile1792939300000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "Users" DROP COLUMN "password"`);
    await queryRunner.query(
      `ALTER TABLE "Users" ALTER COLUMN "id" DROP DEFAULT`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "Users" ALTER COLUMN "id" SET DEFAULT nextval('"Users_id_seq"'::regclass)`,
    );
    await queryRunner.query(
      `ALTER TABLE "Users" ADD "password" character varying(255) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "Users" ALTER COLUMN "password" DROP DEFAULT`,
    );
  }
}
