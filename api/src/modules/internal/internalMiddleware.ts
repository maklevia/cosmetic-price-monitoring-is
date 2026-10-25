import { NextFunction, Request, Response } from "express";
import { ForbiddenError } from "@api/errors/AppError.js";
import { getEnvOrThrow } from "@api/utils/getEnvOrThrow.js";

export const  internalMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const expectedKey = getEnvOrThrow("INTERNAL_API_KEY");
  const providedKey = req.headers["x-internal-api-key"];

  if (!providedKey || providedKey !== expectedKey) {
    return next(new ForbiddenError("Invalid internal API key"));
  }

  next();
};
