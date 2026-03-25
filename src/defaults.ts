import type { AAE } from './types';

export function defaultAAE(
  issuerDid: string,
  holderDid: string,
  revocationEndpoint: string,
  ttlSeconds = 86400
): AAE {
  const now = new Date();
  const expires = new Date(now.getTime() + ttlSeconds * 1000);

  return {
    mandate: {
      purpose: ['general'],
      allowedActions: ['*'],
      delegation: {
        allowed: false,
        maxSubAgents: 0,
        maxDepth: 0,
        attenuationOnly: true
      }
    },
    constraints: {
      duration: { ttl: ttlSeconds },
      limits: {
        autonomousThreshold: 100,
        stepUpThreshold: 1000,
        approvalThreshold: 10000,
        currency: 'USDC'
      }
    },
    validity: {
      issuer: issuerDid,
      holderBinding: holderDid,
      issuedAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      revocationEndpoint
    }
  };
}
