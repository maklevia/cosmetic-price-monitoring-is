import { IsNull } from "typeorm";
import { AuthDataSource } from "@auth/config/data-source.js";
import { Credential } from "@auth/entities/Credential.js";
import { RefreshToken } from "@auth/entities/RefreshToken.js";

export class AuthRepository {
  private readonly credentialRepository =
    AuthDataSource.getRepository(Credential);
  private readonly refreshTokenRepository =
    AuthDataSource.getRepository(RefreshToken);

  async findCredentialByEmail(email: string): Promise<Credential | null> {
    return this.credentialRepository.findOneBy({ email });
  }

  async findCredentialById(id: number): Promise<Credential | null> {
    return this.credentialRepository.findOneBy({ id });
  }

  async createCredential(
    email: string,
    passwordHash: string,
  ): Promise<Credential> {
    const credential = new Credential();
    credential.email = email;
    credential.passwordHash = passwordHash;

    return this.credentialRepository.save(credential);
  }

  async deleteCredential(id: number): Promise<void> {
    await this.credentialRepository.delete(id);
  }

  async updatePassword(id: number, passwordHash: string): Promise<void> {
    await this.credentialRepository.update(id, { passwordHash });
  }

  async saveRefreshToken(
    credentialId: number,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    const token = new RefreshToken();
    token.credential = { id: credentialId } as Credential;
    token.tokenHash = tokenHash;
    token.expiresAt = expiresAt;
    token.revokedAt = null;

    await this.refreshTokenRepository.insert(token);
  }

  async findRefreshTokenByHash(
    tokenHash: string,
  ): Promise<RefreshToken | null> {
    return this.refreshTokenRepository.findOne({
      where: { tokenHash },
      relations: { credential: true },
    });
  }

  async revokeRefreshToken(id: number): Promise<void> {
    await this.refreshTokenRepository.update(id, { revokedAt: new Date() });
  }

  async revokeAllRefreshTokens(credentialId: number): Promise<void> {
    await this.refreshTokenRepository.update(
      { credential: { id: credentialId }, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  async deleteExpiredRefreshTokens(): Promise<void> {
    await this.refreshTokenRepository
      .createQueryBuilder()
      .delete()
      .where("expires_at < now()")
      .orWhere("(revoked_at IS NOT NULL AND revoked_at < now() - interval '7 days')")
      .execute();
  }
}
