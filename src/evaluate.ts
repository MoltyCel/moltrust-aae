import type { AAE, EvaluationContext, EvaluationResult } from './types';
import { isActive } from './validate';

function matchesPattern(pattern: string, value: string): boolean {
  // Convert URI pattern with * and ** wildcards to regex
  // ** matches any characters (including /), * matches a single path segment
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  const withWildcards = escaped
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\{\{GLOBSTAR\}\}/g, '.*');
  const regex = new RegExp('^' + withWildcards + '$');
  return regex.test(value);
}

function matchesAnyPattern(patterns: string[], value: string): boolean {
  return patterns.some(p => matchesPattern(p, value));
}

export function evaluate(aae: AAE, ctx: EvaluationContext): EvaluationResult {
  const now = ctx.timestamp ? new Date(ctx.timestamp) : new Date();

  // 1. Check validity
  if (!isActive(aae)) {
    return { allowed: false, reason: 'credential_expired_or_not_yet_valid' };
  }

  // 2. Check allowed actions (default-deny)
  if (!matchesAnyPattern(aae.mandate.allowedActions, ctx.action)) {
    return { allowed: false, reason: 'action_not_in_allowedActions' };
  }

  // 3. Check denied actions (takes precedence)
  if (aae.mandate.deniedActions &&
      matchesAnyPattern(aae.mandate.deniedActions, ctx.action)) {
    return { allowed: false, reason: 'action_in_deniedActions' };
  }

  // 4. Check resources (ABAC object layer)
  if (ctx.resource && aae.mandate.resources) {
    if (!matchesAnyPattern(aae.mandate.resources, ctx.resource)) {
      return { allowed: false, reason: 'resource_not_in_scope' };
    }
  }

  // 5. Check jurisdiction
  if (ctx.jurisdiction && aae.constraints.scope?.jurisdictions?.length) {
    if (!aae.constraints.scope.jurisdictions.includes(ctx.jurisdiction)) {
      return { allowed: false, reason: 'jurisdiction_not_permitted' };
    }
  }

  // 6. Check counterparty score
  if (ctx.counterpartyScore !== undefined &&
      aae.constraints.scope?.counterpartyMinScore !== undefined) {
    if (ctx.counterpartyScore < aae.constraints.scope.counterpartyMinScore) {
      return { allowed: false, reason: 'counterparty_score_below_minimum' };
    }
  }

  // 7. Check time window
  const { duration } = aae.constraints;
  if (duration.allowedDays) {
    const day = now.getDay() || 7; // Convert 0=Sun to 7
    if (!duration.allowedDays.includes(day)) {
      return { allowed: false, reason: 'outside_allowed_days' };
    }
  }
  if (duration.allowedHours) {
    const hour = now.getHours();
    if (hour < duration.allowedHours.start || hour >= duration.allowedHours.end) {
      return { allowed: false, reason: 'outside_allowed_hours' };
    }
  }

  // 8. Check tool allowlist
  if (aae.constraints.obligations?.toolAllowlist?.length) {
    if (!matchesAnyPattern(aae.constraints.obligations.toolAllowlist, ctx.action)) {
      return { allowed: false, reason: 'tool_not_in_allowlist' };
    }
  }

  // 9. Check financial thresholds
  if (ctx.amount !== undefined) {
    const { limits } = aae.constraints;
    const obligations = aae.constraints.obligations;

    if (obligations?.requireHumanApprovalAbove !== undefined &&
        ctx.amount > obligations.requireHumanApprovalAbove) {
      return {
        allowed: true,
        reason: 'allowed_pending_human_approval',
        requiresHumanApproval: true
      };
    }
    if (ctx.amount > limits.approvalThreshold) {
      return {
        allowed: true,
        reason: 'allowed_pending_human_approval',
        requiresHumanApproval: true
      };
    }
    if (ctx.amount > limits.stepUpThreshold) {
      return {
        allowed: true,
        reason: 'allowed_with_step_up',
        requiresStepUp: true
      };
    }
  }

  return { allowed: true, reason: 'permitted' };
}
