export type Purpose =
  | 'commerce'
  | 'data_read'
  | 'data_write'
  | 'communication'
  | 'delegation'
  | 'administration'
  | 'general';

export type Currency = 'USDC' | 'EUR' | 'CHF' | 'USD';

export type SigningAlgorithm = 'Ed25519' | 'ML-DSA-65';

export interface Delegation {
  allowed: boolean;
  maxSubAgents: number;
  maxDepth: number;        // MUST NOT exceed 8
  attenuationOnly: boolean;
}

export interface Mandate {
  purpose: Purpose[];
  allowedActions: string[];   // URI patterns, default-deny
  deniedActions?: string[];   // takes precedence over allowedActions
  resources?: string[];       // ABAC object layer (URI patterns)
  delegation?: Delegation;
}

export interface Duration {
  ttl: number;                // seconds, max 86400 autonomous / 604800 supervised
  maxSessionDuration?: number;
  allowedDays?: number[];     // 1=Mon..7=Sun (ISO 8601)
  allowedHours?: { start: number; end: number };
  timezone?: string;          // IANA timezone, required if allowedDays/Hours present
}

export interface Limits {
  autonomousThreshold: number;
  stepUpThreshold: number;
  approvalThreshold: number;
  maxTransactionsPerHour?: number;
  currency: Currency;
}

export interface Scope {
  jurisdictions?: string[];   // ISO 3166-1 alpha-2, empty = unrestricted
  counterpartyMinScore?: number; // 0-100
}

export interface Obligations {
  requireHumanApprovalAbove?: number;
  toolAllowlist?: string[];   // URI patterns
}

export interface Constraints {
  duration: Duration;
  limits: Limits;
  scope?: Scope;
  obligations?: Obligations;
}

export interface OnChainAnchor {
  chain: string;
  block: number;
  txHash: string;
}

export interface Validity {
  issuer: string;             // DID
  holderBinding: string;      // DID
  issuedAt: string;           // ISO 8601
  expiresAt: string;          // ISO 8601
  revocationEndpoint: string; // URL
  signingAlgorithm?: SigningAlgorithm; // default: Ed25519, future: ML-DSA-65
  onChainAnchor?: OnChainAnchor;
}

export interface AAE {
  mandate: Mandate;
  constraints: Constraints;
  validity: Validity;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface EvaluationContext {
  action: string;             // URI of the action being attempted
  resource?: string;          // URI of the target resource
  amount?: number;            // transaction amount
  currency?: Currency;
  jurisdiction?: string;      // ISO 3166-1 alpha-2
  counterpartyScore?: number; // 0-100
  timestamp?: string;         // ISO 8601, defaults to now
}

export interface EvaluationResult {
  allowed: boolean;
  reason: string;
  requiresStepUp?: boolean;
  requiresHumanApproval?: boolean;
}
