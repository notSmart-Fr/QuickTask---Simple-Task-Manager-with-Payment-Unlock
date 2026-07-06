import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import config from "../../config.js";

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, config.JWT_SECRET) as {
      userId: string;
      name: string;
      email: string;
      isPremium: boolean;
    };

    req.user = {
      id: decoded.userId,
      name: decoded.name,
      email: decoded.email,
      isPremium: decoded.isPremium,
    };
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}

export default authMiddleware;
