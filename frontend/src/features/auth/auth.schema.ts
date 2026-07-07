import { z } from 'zod';

export const NameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(100, "Name must be ≤ 100 characters");

export const EmailSchema = z.string().email("Invalid email address").trim();

export const PasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters");

export const RegisterInputSchema = z.object({
  name: NameSchema,
  email: EmailSchema,
  password: PasswordSchema,
});

export const LoginInputSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
});
