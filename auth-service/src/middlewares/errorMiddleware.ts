import { NextFunction, Request, Response } from "express";
import { AppError } from "@auth/errors/AppError.js";

export const errorMiddleware = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      status: "error",
      statusCode: err.statusCode,
      message: err.message,
    });
    return;
  }

  console.error("[auth] Unexpected error:", err);

  res.status(500).json({
    status: "error",
    statusCode: 500,
    message: "Internal server error",
  });
};
