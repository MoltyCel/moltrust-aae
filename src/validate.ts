import { AAESchema } from './schema';
import type { AAE, ValidationResult } from './types';

export function validate(aae: unknown): ValidationResult {
  const result = AAESchema.safeParse(aae);
  if (result.success) {
    return { valid: true, errors: [] };
  }
  return {
    valid: false,
    errors: result.error.issues.map((e: any) => `${(e.path || []).join('.')}: ${e.message}`)
  };
}

export function isExpired(aae: AAE): boolean {
  return new Date(aae.validity.expiresAt) < new Date();
}

export function isActive(aae: AAE): boolean {
  const now = new Date();
  return new Date(aae.validity.issuedAt) <= now &&
         now < new Date(aae.validity.expiresAt);
}
