import { Router } from "express";
import { InternalUserController } from "@api/modules/internal/InternalUserController.js";
import { internalMiddleware } from "@api/modules/internal/internalMiddleware.js";

export const internalRoutes = Router();

const internalUserController = new InternalUserController();

internalRoutes.post(
  "/users",
  internalMiddleware,
  internalUserController.createUserProfile,
);
