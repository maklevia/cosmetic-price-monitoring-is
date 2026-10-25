import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Relation,
} from "typeorm";
import { Credential } from "@auth/entities/Credential.js";

@Entity("Refresh_Tokens")
export class RefreshToken {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Credential, (credential) => credential.refreshTokens, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "credential_id" })
  credential: Relation<Credential>;

  @Column({ name: "token_hash", type: "varchar", length: 64, unique: true })
  tokenHash: string;

  @Column({ name: "expires_at", type: "timestamptz" })
  expiresAt: Date;

  @Column({ name: "revoked_at", type: "timestamptz", nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn({
    name: "created_at",
    type: "timestamptz",
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt: Date;
}
