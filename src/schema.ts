import { z } from 'zod';

const PurposeEnum = z.enum([
  'commerce', 'data_read', 'data_write',
  'communication', 'delegation', 'administration', 'general'
]);

const CurrencyEnum = z.enum(['USDC', 'EUR', 'CHF', 'USD']);

const DelegationSchema = z.object({
  allowed: z.boolean(),
  maxSubAgents: z.number().int().min(0),
  maxDepth: z.number().int().min(0).max(8),
  attenuationOnly: z.boolean()
});

const MandateSchema = z.object({
  purpose: z.array(PurposeEnum).min(1),
  allowedActions: z.array(z.string()).min(1),
  deniedActions: z.array(z.string()).optional(),
  resources: z.array(z.string()).optional(),
  delegation: DelegationSchema.optional()
});

const DurationSchema = z.object({
  ttl: z.number().int().min(1).max(604800),
  maxSessionDuration: z.number().int().min(1).optional(),
  allowedDays: z.array(z.number().int().min(1).max(7)).optional(),
  allowedHours: z.object({
    start: z.number().int().min(0).max(23),
    end: z.number().int().min(0).max(23)
  }).optional(),
  timezone: z.string().optional()
}).refine(
  (d) => !(d.allowedDays || d.allowedHours) || d.timezone,
  { message: 'timezone is required when allowedDays or allowedHours is present' }
);

const LimitsSchema = z.object({
  autonomousThreshold: z.number().min(0),
  stepUpThreshold: z.number().min(0),
  approvalThreshold: z.number().min(0),
  maxTransactionsPerHour: z.number().int().min(1).optional(),
  currency: CurrencyEnum
}).refine(
  (l) => l.autonomousThreshold <= l.stepUpThreshold &&
         l.stepUpThreshold <= l.approvalThreshold,
  { message: 'Thresholds must be: autonomousThreshold <= stepUpThreshold <= approvalThreshold' }
);

const ScopeSchema = z.object({
  jurisdictions: z.array(z.string().length(2)).optional(),
  counterpartyMinScore: z.number().int().min(0).max(100).optional()
});

const ObligationsSchema = z.object({
  requireHumanApprovalAbove: z.number().min(0).optional(),
  toolAllowlist: z.array(z.string()).optional()
});

const ConstraintsSchema = z.object({
  duration: DurationSchema,
  limits: LimitsSchema,
  scope: ScopeSchema.optional(),
  obligations: ObligationsSchema.optional()
});

const ValiditySchema = z.object({
  issuer: z.string().startsWith('did:'),
  holderBinding: z.string().startsWith('did:'),
  issuedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  revocationEndpoint: z.string().url(),
  onChainAnchor: z.object({
    chain: z.string(),
    block: z.number().int().min(0),
    txHash: z.string()
  }).optional()
}).refine(
  (v) => new Date(v.expiresAt) > new Date(v.issuedAt),
  { message: 'expiresAt must be after issuedAt' }
);

export const AAESchema = z.object({
  mandate: MandateSchema,
  constraints: ConstraintsSchema,
  validity: ValiditySchema
});
