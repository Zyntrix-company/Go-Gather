import { z } from 'zod';

// ─── Strong password rule (reused across schemas) ─────────────────────────────
const strongPassword = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character (!@#$%^&*)');

// ─── Login ────────────────────────────────────────────────────────────────────
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

// ─── Signup ───────────────────────────────────────────────────────────────────
export const signupSchema = z
  .object({
    email: z
      .string()
      .min(1, 'Email is required')
      .email('Enter a valid email address'),
    phone: z
      .string()
      .optional()
      .refine(
        (val) => !val || /^[0-9]{6,15}$/.test(val),
        'Enter a valid phone number (digits only)',
      ),
    password: strongPassword,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

// ─── Reset Password (with OTP) ────────────────────────────────────────────────
export const resetPasswordSchema = z
  .object({
    otp: z
      .string()
      .length(6, 'OTP must be exactly 6 digits')
      .regex(/^[0-9]+$/, 'OTP must be numeric'),
    password: strongPassword,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

// ─── Profile ──────────────────────────────────────────────────────────────────
export const profileSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(60, 'Full name is too long'),
  gender: z.string().min(1, 'Gender is required'),
  country: z.string().min(1, 'Country is required'),
  bio: z.string().max(100, 'Bio must be under 100 characters').optional(),
});
