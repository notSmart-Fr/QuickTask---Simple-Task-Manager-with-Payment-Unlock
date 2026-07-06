import { z } from 'zod';
import { NameSchema, EmailSchema, PasswordSchema } from './index';

export const RegisterInputSchema = z.object({
  name: NameSchema,
  email: EmailSchema,
  password: PasswordSchema,
});

export const LoginInputSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
});
