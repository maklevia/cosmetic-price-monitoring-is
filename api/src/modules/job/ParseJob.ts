import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { StoreName } from "@api/types/Enums.js";
import { JobStatus, JobType } from "@api/modules/job/jobTypes.js";

@Entity("Parse_Jobs")
export class ParseJob {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 64 })
  type: JobType;

  @Column({
    type: "enum",
    enum: StoreName,
    enumName: "store_name_enum",
    nullable: true,
  })
  store: StoreName | null;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  payload: Record<string, unknown>;

  @Column({ type: "varchar", length: 16, default: JobStatus.Pending })
  status: JobStatus;

  @Column({ type: "int", default: 0 })
  attempts: number;

  @Column({ name: "max_attempts", type: "int", default: 3 })
  maxAttempts: number;

  @Column({
    name: "available_at",
    type: "timestamptz",
    default: () => "CURRENT_TIMESTAMP",
  })
  availableAt: Date;

  @Column({ name: "locked_at", type: "timestamptz", nullable: true })
  lockedAt: Date | null;

  @Column({ name: "locked_by", type: "varchar", length: 128, nullable: true })
  lockedBy: string | null;

  @Column({ name: "last_error", type: "text", nullable: true })
  lastError: string | null;

  @Column({ name: "trace_parent", type: "varchar", length: 128, nullable: true })
  traceParent: string | null;

  @CreateDateColumn({
    name: "created_at",
    type: "timestamptz",
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: "updated_at",
    type: "timestamptz",
    default: () => "CURRENT_TIMESTAMP",
  })
  updatedAt: Date;
}
