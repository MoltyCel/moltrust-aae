import { validate, evaluate, defaultAAE, isExpired, isActive } from './index';
import type { AAE } from './types';

const validAAE: AAE = {
  mandate: {
    purpose: ['commerce'],
    allowedActions: ['https://api.moltrust.ch/shopping/*'],
    deniedActions: ['https://api.moltrust.ch/shopping/admin/*'],
    resources: ['https://api.example.com/products/*'],
    delegation: { allowed: false, maxSubAgents: 0, maxDepth: 0, attenuationOnly: true }
  },
  constraints: {
    duration: { ttl: 3600 },
    limits: {
      autonomousThreshold: 100,
      stepUpThreshold: 500,
      approvalThreshold: 10000,
      currency: 'USDC'
    },
    scope: { jurisdictions: ['CH', 'DE'], counterpartyMinScore: 40 },
    obligations: { requireHumanApprovalAbove: 5000 }
  },
  validity: {
    issuer: 'did:moltrust:issuer001',
    holderBinding: 'did:moltrust:agent042',
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    revocationEndpoint: 'https://api.moltrust.ch/revocation'
  }
};

describe('validate()', () => {
  test('valid AAE passes', () => {
    expect(validate(validAAE).valid).toBe(true);
  });
  test('missing mandate fails', () => {
    const bad = { ...validAAE, mandate: undefined };
    expect(validate(bad).valid).toBe(false);
  });
  test('threshold order enforced', () => {
    const bad = { ...validAAE, constraints: { ...validAAE.constraints, limits: { ...validAAE.constraints.limits, autonomousThreshold: 9999 } } };
    expect(validate(bad).valid).toBe(false);
  });
  test('maxDepth capped at 8', () => {
    const bad = { ...validAAE, mandate: { ...validAAE.mandate, delegation: { allowed: true, maxSubAgents: 1, maxDepth: 99, attenuationOnly: true } } };
    expect(validate(bad).valid).toBe(false);
  });
});

describe('evaluate()', () => {
  test('permitted action allowed', () => {
    const r = evaluate(validAAE, { action: 'https://api.moltrust.ch/shopping/verify' });
    expect(r.allowed).toBe(true);
  });
  test('denied action blocked', () => {
    // Use an AAE with multi-segment patterns so denied check is reachable
    const aaeWithWild: AAE = {
      ...validAAE,
      mandate: {
        ...validAAE.mandate,
        allowedActions: ['https://api.moltrust.ch/shopping/**'],
        deniedActions: ['https://api.moltrust.ch/shopping/admin/**'],
      }
    };
    const r = evaluate(aaeWithWild, { action: 'https://api.moltrust.ch/shopping/admin/delete' });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('action_in_deniedActions');
  });
  test('unknown action blocked', () => {
    const r = evaluate(validAAE, { action: 'https://api.moltrust.ch/OTHER/action' });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('action_not_in_allowedActions');
  });
  test('jurisdiction outside scope blocked', () => {
    const r = evaluate(validAAE, { action: 'https://api.moltrust.ch/shopping/verify', jurisdiction: 'US' });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('jurisdiction_not_permitted');
  });
  test('low counterparty score blocked', () => {
    const r = evaluate(validAAE, { action: 'https://api.moltrust.ch/shopping/verify', counterpartyScore: 20 });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('counterparty_score_below_minimum');
  });
  test('amount above human approval threshold', () => {
    const r = evaluate(validAAE, { action: 'https://api.moltrust.ch/shopping/verify', amount: 6000 });
    expect(r.allowed).toBe(true);
    expect(r.requiresHumanApproval).toBe(true);
  });
  test('amount above step-up threshold', () => {
    const r = evaluate(validAAE, { action: 'https://api.moltrust.ch/shopping/verify', amount: 750 });
    expect(r.allowed).toBe(true);
    expect(r.requiresStepUp).toBe(true);
  });
  test('amount within autonomous threshold', () => {
    const r = evaluate(validAAE, { action: 'https://api.moltrust.ch/shopping/verify', amount: 50 });
    expect(r.allowed).toBe(true);
    expect(r.reason).toBe('permitted');
  });
  test('resource not in scope blocked', () => {
    const r = evaluate(validAAE, { action: 'https://api.moltrust.ch/shopping/verify', resource: 'https://api.example.com/admin/users' });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('resource_not_in_scope');
  });
});

describe('defaultAAE()', () => {
  test('produces valid AAE', () => {
    const aae = defaultAAE('did:moltrust:issuer', 'did:moltrust:agent', 'https://api.moltrust.ch/revocation');
    expect(validate(aae).valid).toBe(true);
    expect(isActive(aae)).toBe(true);
    expect(isExpired(aae)).toBe(false);
  });
});
