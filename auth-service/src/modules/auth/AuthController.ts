import { NextFunction, Request, Response } from "express";
import { AuthService } from "@auth/modules/auth/AuthService.js";
import {
  cookiesAccessOptions,
  cookiesRefreshOptions,
} from "@auth/utils/cookieUtils.js";
import { AuthenticationError } from "@auth/errors/AppError.js";
import { getAuthUser } from "@auth/middlewares/authMiddleware.js";

const authService = new AuthService();

export class AuthController {
  signup = async (req: Request, res: Response) => {
    const { email, password, name } = req.body;
    const result = await authService.signup(email, password, name);

    this.setAuthCookies(res, result.accessToken, result.refreshToken);

    return res.status(201).json({
      message: "Created user",
      user: {
        id: result.userId,
        email: result.email,
      },
    });
  };

  login = async (req: Request, res: Response) => {
    const { email, enteredPassword, password } = req.body;
    const result = await authService.login(
      email,
      enteredPassword ?? password,
    );

    this.setAuthCookies(res, result.accessToken, result.refreshToken);

    return res.status(200).json({ message: "User logged in" });
  };

  refresh = async (req: Request, res: Response) => {
    const refreshToken: string | undefined = req.cookies.refreshToken;

    if (!refreshToken) {
      this.clearAuthCookies(res);
      throw new AuthenticationError("No refresh token");
    }

    const result = await authService.refresh(refreshToken);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);

    return res.status(200).json({
      message: "Refresh token validated. New tokens issued.",
    });
  };

  logout = async (req: Request, res: Response) => {
    const refreshToken: string | undefined = req.cookies.refreshToken;
    await authService.logout(refreshToken);
    this.clearAuthCookies(res);

    return res.status(200).json({ message: "Successfully logged out" });
  };

  resetPassword = async (req: Request, res: Response) => {
    const userId = getAuthUser(res).userId;
    const { oldPassword, newPassword } = req.body;

    const result = await authService.resetPassword(
      userId,
      oldPassword,
      newPassword,
    );

    this.setAuthCookies(res, result.accessToken, result.refreshToken);

    return res.status(200).json({
      message: "Password changed successfully",
    });
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
