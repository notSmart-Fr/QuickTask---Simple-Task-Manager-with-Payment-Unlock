import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { NameSchema, EmailSchema, PasswordSchema } from '../shared/schemas.js';
import type { AuthService } from '../core/auth/auth.service.js';
import authMiddleware from './middleware/auth.middleware.js';

const RegisterInputSchema = z.object({
  name: NameSchema,
  email: EmailSchema,
  password: PasswordSchema,
});

const LoginInputSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
});

export function createAuthRouter(authService: AuthService) {
  const router = Router();

  router.post('/register', async (req: Request, res: Response) => {
    try {
      const input = RegisterInputSchema.parse(req.body);
      const { user, token } = await authService.register(
        input.name,
        input.email,
        input.password,
      );

      res.status(201).json({
        user: { id: user.id, name: user.name, email: user.email, isPremium: user.isPremium },
        token,
      });
    } catch (err: unknown) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: err.errors[0]?.message ?? 'Invalid input' });
      }
      if (err instanceof Error && err.message === 'Email already registered') {
        return res.status(409).json({ error: err.message });
      }
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/login', async (req: Request, res: Response) => {
    try {
      const input = LoginInputSchema.parse(req.body);
      const { user, token } = await authService.login(input.email, input.password);
      res.json({
        user: { id: user.id, name: user.name, email: user.email, isPremium: user.isPremium },
        token,
      });
    } catch (err: unknown) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: err.errors[0]?.message ?? 'Invalid input' });
      }
      if (err instanceof Error && err.message === 'Invalid credentials') {
        return res.status(401).json({ error: err.message });
      }
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/me', authMiddleware, (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    res.json(req.user);
  });

  return router;
}
