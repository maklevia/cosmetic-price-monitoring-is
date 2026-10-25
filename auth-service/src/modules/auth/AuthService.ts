import { compare, hash } from "bcrypt-ts";
import jwt from "jsonwebtoken";
import { createHash, randomUUID } from "crypto";
import { AuthRepository } from "@auth/modules/auth/AuthRepository.js";
import { createUserProfile } from "@auth/clients/apiClient.js";
import { getEnvOrThrow } from "@auth/utils/getEnvOrThrow.js";
import { DAY } from "@auth/utils/time.js";
import {
  normalizeName,
  validateEmail,
  validatePassword,
} from "@auth/utils/validation.js";
import {
  AuthenticationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@auth/errors/AppError.js";
import {
  AuthResult,
  RefreshTokenPayload,
  UserPayload,
} from "@auth/types/AuthTypes.js";

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL = "30d";
const REFRESH_TOKEN_TTL_MS = 30 * DAY;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

export class AuthService {
  private readonly repository = new AuthRepository();
  private readonly accessSecret = getEnvOrThrow("ACCESS_TOKEN_SECRET");
  private readonly refreshSecret = getEnvOrThrow("REFRESH_TOKEN_SECRET");

  async signup(
    rawEmail: unknown,
    rawPassword: unknown,
    rawName?: unknown,
  ): Promise<AuthResult> {
    const email = validateEmail(rawEmail);
    const password = validatePassword(rawPassword);
    const name = normalizeName(rawName);

    const existingCredential =
      await this.repository.findCredentialByEmail(email);
    if (existingCredential) {
      throw new ConflictError("User with this email already exists");
    }

    const passwordHash = await hash(password, 10);

    let credential;
    try {
      credential = await this.repository.createCredential(email, passwordHash);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError("User with this email already exists");
      }
      throw error;
    }

    try {
      await createUserProfile({
        id: credential.id,
        email: credential.email,
        name,
      });
    } catch (error) {
      await this.repository.deleteCredential(credential.id);
      throw error;
    }

    return this.issueTokens(credential.id, credential.email);
  }

  async login(
    rawEmail: unknown,
    rawPassword: unknown,
  ): Promise<AuthResult> {
    const email = validateEmail(rawEmail);

    if (typeof rawPassword !== "string" || rawPassword.length === 0) {
      throw new AuthenticationError("Invalid credentials");
    }

    const credential = await this.repository.findCredentialByEmail(email);
    if (!credential) {
      throw new AuthenticationError("Invalid credentials");
    }

    const passwordMatches = await compare(rawPassword, credential.passwordHash);
    if (!passwordMatches) {
      throw new AuthenticationError("Invalid credentials");
    }

    return this.issueTokens(credential.id, credential.email);
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    const payload = this.verifyRefreshToken(refreshToken);
    const tokenHash = hashToken(refreshToken);
    const storedToken =
      await this.repository.findRefreshTokenByHash(tokenHash);

    if (
      !storedToken ||
      storedToken.revokedAt !== null ||
      storedToken.expiresAt.getTime() <= Date.now() ||
      storedToken.credential.id !== payload.userId
    ) {
      throw new AuthenticationError("Invalid refresh token");
    }

    await this.repository.revokeRefreshToken(storedToken.id);

    return this.issueTokens(
      storedToken.credential.id,
      storedToken.credential.email,
    );
  }

  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) return;

    try {
      this.verifyRefreshToken(refreshToken);
      const tokenHash = hashToken(refreshToken);
      const storedToken =
        await this.repository.findRefreshTokenByHash(tokenHash);

      if (storedToken && storedToken.revokedAt === null) {
        await this.repository.revokeRefreshToken(storedToken.id);
      }
    } catch {
      // Logout is idempotent; an invalid or expired token is already useless.
    }
  }

  async resetPassword(
    userId: number,
    rawOldPassword: unknown,
    rawNewPassword: unknown,
  ): Promise<AuthResult> {
    const credential = await this.repository.findCredentialById(userId);
    if (!credential) {
      throw new NotFoundError("User not found");
    }

    if (typeof rawOldPassword !== "string" || rawOldPassword.length === 0) {
      throw new ValidationError("Old password is required");
    }

    const oldPasswordMatches = await compare(
      rawOldPassword,
      credential.passwordHash,
    );
    if (!oldPasswordMatches) {
      throw new ValidationError("Old password is not correct");
    }

    const newPassword = validatePassword(rawNewPassword);
    const newPasswordHash = await hash(newPassword, 10);

    await this.repository.updatePassword(userId, newPasswordHash);
    await this.repository.revokeAllRefreshTokens(userId);

    return this.issueTokens(credential.id, credential.email);
  }

  validateAccessToken(accessToken: string): UserPayload {
    const decoded = this.verifyToken(accessToken, this.accessSecret);

    if (
      decoded.type !== "access" ||
      typeof decoded.userId !== "number" ||
      typeof decoded.userEmail !== "string"
    ) {
      throw new AuthenticationError("Invalid access token");
    }

    return decoded as UserPayload;
  }

  private verifyRefreshToken(refreshToken: string): RefreshTokenPayload {
    const decoded = this.verifyToken(refreshToken, this.refreshSecret);

    if (decoded.type !== "refresh" || typeof decoded.userId !== "number") {
      throw new AuthenticationError("Invalid refresh token");
    }

    return decoded as RefreshTokenPayload;
  }

  private verifyToken(token: string, secret: string): jwt.JwtPayload {
    try {
      const decoded = jwt.verify(token, secret);
      if (typeof decoded === "string") {
        throw new Error("Unexpected token payload");
      }
      return decoded;
    } catch {
      throw new AuthenticationError("Invalid or expired token");
    }
  }

  private async issueTokens(
    userId: number,
    email: string,
  ): Promise<AuthResult> {
    const accessToken = jwt.sign(
      { userId, userEmail: email, type: "access" },
      this.accessSecret,
      { expiresIn: ACCESS_TOKEN_TTL },
    );

    const refreshToken = jwt.sign(
      { userId, type: "refresh" },
      this.refreshSecret,
      { expiresIn: REFRESH_TOKEN_TTL, jwtid: randomUUID() },
    );

    await this.repository.saveRefreshToken(
      userId,
      hashToken(refreshToken),
      new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    );

    return { userId, email, accessToken, refreshToken };
  }
}
