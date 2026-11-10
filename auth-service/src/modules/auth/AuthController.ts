import { NextFunction, Request, Response } from "express";
import { AuthService } from "@auth/modules/auth/AuthService.js";
import {
  cookiesAccessOptions,
  cookiesRefreshOptions,
} from "@auth/utils/cookieUtils.js";
import {
  AuthenticationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@auth/errors/AppError.js";
import { getAuthUser } from "@auth/middlewares/authMiddleware.js";
import {
  authLoginTotal,
  authPasswordResetTotal,
  authRefreshTotal,
  authSignupTotal,
} from "@auth/observability/metrics.js";

const authService = new AuthService();

function authErrorResult(error: unknown): string {
  if (error instanceof AuthenticationError) return "invalid_credentials";
  if (error instanceof ConflictError) return "email_taken";
  if (error instanceof ValidationError) return "validation_error";
  if (error instanceof NotFoundError) return "not_found";
  return "internal_error";
}

function refreshErrorResult(error: unknown): string {
  if (error instanceof AuthenticationError) return "invalid";
  return "internal_error";
}

export class AuthController {
  signup = async (req: Request, res: Response) => {
    try {
      const { email, password, name } = req.body;
      const result = await authService.signup(email, password, name);

      this.setAuthCookies(res, result.accessToken, result.refreshToken);
      authSignupTotal.inc({ result: "success" });

      return res.status(201).json({
        message: "Created user",
        user: {
          id: result.userId,
          email: result.email,
        },
      });
    } catch (error) {
      authSignupTotal.inc({ result: authErrorResult(error) });
      throw error;
    }
  };

  login = async (req: Request, res: Response) => {
    try {
      const { email, enteredPassword, password } = req.body;
      const result = await authService.login(
        email,
        enteredPassword ?? password,
      );

      this.setAuthCookies(res, result.accessToken, result.refreshToken);
      authLoginTotal.inc({ result: "success" });

      return res.status(200).json({ message: "User logged in" });
    } catch (error) {
      authLoginTotal.inc({ result: authErrorResult(error) });
      throw error;
    }
  };

  refresh = async (req: Request, res: Response) => {
    const refreshToken: string | undefined = req.cookies.refreshToken;

    if (!refreshToken) {
      authRefreshTotal.inc({ result: "invalid" });
      this.clearAuthCookies(res);
      throw new AuthenticationError("No refresh token");
    }

    try {
      const result = await authService.refresh(refreshToken);
      this.setAuthCookies(res, result.accessToken, result.refreshToken);
      authRefreshTotal.inc({ result: "success" });

      return res.status(200).json({
        message: "Refresh token validated. New tokens issued.",
      });
    } catch (error) {
      authRefreshTotal.inc({ result: refreshErrorResult(error) });
      throw error;
    }
  };

  logout = async (req: Request, res: Response) => {
    const refreshToken: string | undefined = req.cookies.refreshToken;
    await authService.logout(refreshToken);
    this.clearAuthCookies(res);

    return res.status(200).json({ message: "Successfully logged out" });
  };

  resetPassword = async (req: Request, res: Response) => {
    try {
      const userId = getAuthUser(res).userId;
      const { oldPassword, newPassword } = req.body;

      const result = await authService.resetPassword(
        userId,
        oldPassword,
        newPassword,
      );

      this.setAuthCookies(res, result.accessToken, result.refreshToken);
      authPasswordResetTotal.inc({ result: "success" });

      return res.status(200).json({
        message: "Password changed successfully",
      });
    } catch (error) {
      authPasswordResetTotal.inc({ result: authErrorResult(error) });
      throw error;
    }
  };

  private setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ): void {
    res.cookie("accessToken", accessToken, cookiesAccessOptions);
    res.cookie("refreshToken", refreshToken, cookiesRefreshOptions);
  }

  private clearAuthCookies(res: Response): void {
    res.clearCookie("accessToken", cookiesAccessOptions);
    res.clearCookie("refreshToken", cookiesRefreshOptions);
  }
}
