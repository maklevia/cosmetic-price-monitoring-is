import { MigrationInterface, QueryRunner } from "typeorm";

export class ParseJobs1792768124000 implements MigrationInterface {
  name = "ParseJobs1792768124000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "Parse_Jobs" (
        "id" SERIAL NOT NULL,
        "type" character varying(64) NOT NULL,
        "store" "public"."store_name_enum",
        "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "status" character varying(16) NOT NULL DEFAULT 'pending',
        "attempts" integer NOT NULL DEFAULT 0,
        "max_attempts" integer NOT NULL DEFAULT 3,
        "available_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "locked_at" TIMESTAMP WITH TIME ZONE,
        "locked_by" character varying(128),
        "last_error" text,
        "trace_parent" character varying(128),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_parse_jobs" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_parse_jobs_status_available_at" ON "Parse_Jobs" ("status", "available_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_parse_jobs_store_status" ON "Parse_Jobs" ("store", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_parse_jobs_type_status" ON "Parse_Jobs" ("type", "status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "Parse_Jobs"`);
  }
}
