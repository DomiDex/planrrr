// Package: @repo/api
// Path: apps/api/src/schemas/auth.schema.ts
// Dependencies: zod

import { z } from 'zod';

// Login input schema
export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters')
});

// Register input schema
export const RegisterSchema = LoginSchema.extend({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100)
});

// User response schema
export const UserResponseSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  teamId: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date()
});

// Auth response schema
export const AuthResponseSchema = z.object({
  user: UserResponseSchema,
  token: z.string(),
  refreshToken: z.string().optional()
});

// Refresh token schema
export const RefreshTokenSchema = z.object({
  refreshToken: z.string()
});

// Password reset request schema
export const PasswordResetRequestSchema = z.object({
  email: z.string().email('Invalid email address')
});

// Password reset schema
export const PasswordResetSchema = z.object({
  token: z.string(),
  password: z.string().min(8, 'Password must be at least 8 characters')
});

// Type exports
export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type UserResponse = z.infer<typeof UserResponseSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;