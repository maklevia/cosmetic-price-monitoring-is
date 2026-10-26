import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { getEnvOrThrow } from "@api/utils/getEnvOrThrow.js";
import { UserPayload } from "@api/types/AuthTypes.js";
import { AuthenticationError } from "@api/errors/AppError.js";

const accessTokenSecret = getEnvOrThrow("ACCESS_TOKEN_SECRET");

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const accessToken: string | undefined = req.cookies.accessToken;

  if (!accessToken) {
    return next(new AuthenticationError("No access token provided"));
  }

  try {
    const decoded = jwt.verify(accessToken, accessTokenSecret);

    if (
      typeof decoded === "string" ||
      decoded.type !== "access" ||
      typeof decoded.userId !== "number" ||
      typeof decoded.userEmail !== "string"
    ) {
      throw new AuthenticationError("Invalid access token payload");
    }

    res.locals.user = {
      userId: decoded.userId,
      userEmail: decoded.userEmail,
    } as UserPayload;

    next();
  } catch {
    next(new AuthenticationError("Invalid or expired access token"));
  }
};

export function getAuthUser(res: Response): UserPayload {
  const user = res.locals.user as UserPayload | undefined;
  if (!user) {
    throw new AuthenticationError("User is not authenticated");
  }
  return user;
}
