import { JwtPayload } from "jsonwebtoken";

export interface UserPayload extends JwtPayload {
  userId: number;
  userEmail: string;
  type: "access";
}

export interface RefreshTokenPayload extends JwtPayload {
  userId: number;
  type: "refresh";
}

export interface AuthResult {
  userId: number;
  email: string;
  accessToken: string;
  refreshToken: string;
}
