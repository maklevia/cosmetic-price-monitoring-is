import { getEnvOrThrow } from "@auth/utils/getEnvOrThrow.js";
import { DAY, MINUTE } from "@auth/utils/time.js";
import { CookieOptions } from "express";

export const cookiesRefreshOptions: CookieOptions = {
  httpOnly: true,
  sameSite: getEnvOrThrow("NODE_ENV") === "production" ? "none" : "strict",
  secure: getEnvOrThrow("NODE_ENV") === "production",
  path: "/",
  maxAge: 30 * DAY,
};

export const cookiesAccessOptions: CookieOptions = {
  httpOnly: true,
  sameSite: getEnvOrThrow("NODE_ENV") === "production" ? "none" : "strict",
  secure: getEnvOrThrow("NODE_ENV") === "production",
  path: "/",
  maxAge: 15 * MINUTE,
};
