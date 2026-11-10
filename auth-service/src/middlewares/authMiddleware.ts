import { NextFunction, Request, Response } from "express";
import { AuthService } from "@auth/modules/auth/AuthService.js";
import { AuthenticationError } from "@auth/errors/AppError.js";
import { UserPayload } from "@auth/types/AuthTypes.js";
import { authTokenValidationFailuresTotal } from "@auth/observability/metrics.js";

const authService = new AuthService();

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const accessToken: string | undefined = req.cookies.accessToken;

  if (!accessToken) {
    authTokenValidationFailuresTotal.inc({ reason: "missing" });
    return next(new AuthenticationError("No access token provided"));
  }

  try {
    res.locals.user = authService.validateAccessToken(accessToken);
    next();
  } catch (error) {
    authTokenValidationFailuresTotal.inc({ reason: "invalid" });
    next(error);
  }
};

export function getAuthUser(res: Response): UserPayload {
  const user = res.locals.user as UserPayload | undefined;
  if (!user) {
    throw new AuthenticationError("User is not authenticated");
  }
  return user;
}
