import { Router } from "express";
import { AuthController } from "@auth/modules/auth/AuthController.js";
import { authMiddleware } from "@auth/middlewares/authMiddleware.js";

export const authRoutes = Router();

const authController = new AuthController();

authRoutes.post("/signup", authController.signup);
authRoutes.post("/login", authController.login);
authRoutes.post("/refresh", authController.refresh);
authRoutes.post("/logout", authController.logout);
authRoutes.patch(
  "/resetPassword",
  authMiddleware,
  authController.resetPassword,
);
