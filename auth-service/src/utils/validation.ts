import { ValidationError } from "@auth/errors/AppError.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(rawEmail: unknown): string {
  if (typeof rawEmail !== "string") {
    throw new ValidationError("Email is required");
  }

  const email = rawEmail.trim().toLowerCase();

  if (!EMAIL_PATTERN.test(email) || email.length > 255) {
    throw new ValidationError("Email is invalid");
  }

  return email;
}

export function validatePassword(rawPassword: unknown): string {
  if (typeof rawPassword !== "string") {
    throw new ValidationError("Password is required");
  }

  if (rawPassword.length < 8) {
    throw new ValidationError("Password must be at least 8 characters");
  }

  if (Buffer.byteLength(rawPassword, "utf8") > 72) {
    throw new ValidationError("Password must be at most 72 bytes");
  }

  return rawPassword;
}

export function normalizeName(rawName: unknown): string | null {
  if (rawName === undefined || rawName === null || rawName === "") {
    return null;
  }

  if (typeof rawName !== "string") {
    throw new ValidationError("Name must be a string");
  }

  const name = rawName.trim();
  if (name.length > 25) {
    throw new ValidationError("Name must be at most 25 characters");
  }

  return name || null;
}
