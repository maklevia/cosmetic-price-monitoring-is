import { AppError } from "@api/errors/AppError.js";
import { NextFunction, Request, Response } from "express";

export const errorMiddleware = (err: Error, req: Request, res: Response, next: NextFunction): void => {
    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            status: "error",
            statusCode: err.statusCode,
            message: err.message,
        });
        return;
    }

    console.error("[api] Unexpected error:", err);

    res.status(500).json({
        status: "error",
        statusCode: 500,
        message: "Internal server error"
    })
}
