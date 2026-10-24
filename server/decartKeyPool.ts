import { createDecartClient as createVtonClient } from '@decartai/sdk';

/**
 * Supported credential eligibility states.
 */
export type CredentialEligibility =
  | 'healthy'
  | 'in_cooldown'
  | 'exhausted'
  | 'invalid'
  | 'rate_limited';

/**
 * Standardized error categories for Decart provider responses.
 */
export type ErrorCategory =
  | 'INSUFFICIENT_CREDITS'
  | 'INVALID_API_KEY'
  | 'RATE_LIMITED'
  | 'CONCURRENT_SESSION_LIMIT'
  | 'TEMPORARY_CAPACITY'
  | 'NETWORK_FAILURE'
  | 'TOKEN_EXPIRED'
  | 'UNSUPPORTED_REQUEST'
  | 'UNKNOWN';

export interface ClassifiedError {
  category: ErrorCategory;
  message: string;
  statusCode: number;
  retryable: boolean;
  cooldownMs: number;
  quarantine: boolean;
}

export interface CredentialConfig {
  id?: string;
  apiKey: string;
  quotaGroup?: string;
  priority?: number;
  enabled?: boolean;
}

export interface DecartCredential {
  id: string;
  apiKey: string;
  maskedKey: string;
  quotaGroup: string;
  enabled: boolean;
  priority: number;
  eligibility: CredentialEligibility;
  cooldownUntil: number | null;
  consecutiveFailures: number;
  lastErrorCategory: ErrorCategory | null;
  lastErrorMessage: string | null;
  lastSelectedAt: number | null;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  successCount: number;
  failureCount: number;
  tokensMinted: number;
  client: any;
}

export interface SanitizedCredentialStatus {
  id: string;
  maskedKey: string;
  quotaGroup: string;
  enabled: boolean;
  priority: number;
  eligibility: CredentialEligibility;
  cooldownUntil: string | null;
  consecutiveFailures: number;
  lastErrorCategory: ErrorCategory | null;
  lastErrorMessage: string | null;
  lastSelectedAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  successCount: number;
  failureCount: number;
  tokensMinted: number;
}

export interface PoolStatusReport {
  rotationPolicy: string;
  totalCredentials: number;
  healthyCount: number;
  inCooldownCount: number;
  exhaustedCount: number;
  invalidCount: number;
  totalTokensMinted: number;
  quotaGroups: Record<string, { exhausted: boolean; cooldownUntil: string | null }>;
  credentials: SanitizedCredentialStatus[];
}

export interface TokenMintOptions {
  expiresIn?: number;
  allowedModels?: string[];
  maxSessionDuration?: number;
  userId?: string;
  origin?: string;
}

/**
 * Safely masks a permanent API key so it can be logged or displayed to admins
 * without revealing the secret value.
 */
export function maskApiKey(key: string): string {
  if (!key || typeof key !== 'string') return '***';
  const clean = key.trim();
  if (clean.length <= 10) return '***...***';
  const prefix = clean.slice(0, 4);
  const suffix = clean.slice(-4);
  return `${prefix}...${suffix}`;
}

/**
 * Classifies Decart API responses and errors based on official HTTP status codes,
 * SDK error objects, and response message patterns.
 */
export function classifyDecartError(error: any): ClassifiedError {
  const status = error?.status || error?.statusCode || error?.response?.status || error?.cause?.status || 0;
  const rawMessage = String(
    error?.message ||
    error?.response?.data?.error ||
    error?.response?.data?.message ||
    error?.data?.message ||
    error ||
    ''
  );
  const lowerMsg = rawMessage.toLowerCase();

  // 1. Credit exhaustion (HTTP 402 or explicit balance/credit exhaustion text)
  if (
    status === 402 ||
    lowerMsg.includes('insufficient_credits') ||
    lowerMsg.includes('insufficient credits') ||
    lowerMsg.includes('credit balance') ||
    lowerMsg.includes('out of credits') ||
    lowerMsg.includes('credit limit') ||
    lowerMsg.includes('quota exceeded') ||
    lowerMsg.includes('payment required') ||
    lowerMsg.includes('insufficient funds') ||
    lowerMsg.includes('no remaining credits') ||
    lowerMsg.includes('billing account')
  ) {
    return {
      category: 'INSUFFICIENT_CREDITS',
      message: 'Provider account quota or credits exhausted.',
      statusCode: 402,
      retryable: true,
      cooldownMs: 60 * 60 * 1000, // 1 hour cooldown for the exhausted quota group
      quarantine: false
    };
  }

  // 2. Authentication failure (HTTP 401 or invalid key)
  if (
    status === 401 ||
    lowerMsg.includes('invalid api key') ||
    lowerMsg.includes('invalid_api_key') ||
    lowerMsg.includes('unauthorized') ||
    lowerMsg.includes('authentication failed') ||
    lowerMsg.includes('api key not found') ||
    lowerMsg.includes('bad api key')
  ) {
    return {
      category: 'INVALID_API_KEY',
      message: 'Invalid API key or unauthorized request.',
      statusCode: 401,
      retryable: true,
      cooldownMs: 24 * 60 * 60 * 1000, // Quarantined until administrative review
      quarantine: true
    };
  }

  // 3. Rate limiting (HTTP 429 without credit messages)
  if (
    status === 429 ||
    lowerMsg.includes('rate limit') ||
    lowerMsg.includes('too many requests') ||
    lowerMsg.includes('rate_limit_exceeded')
  ) {
    return {
      category: 'RATE_LIMITED',
      message: 'Provider rate limit exceeded. Please wait a moment.',
      statusCode: 429,
      retryable: true,
      cooldownMs: 45 * 1000, // 45 seconds cooldown
      quarantine: false
    };
  }

  // 4. Concurrent session limit (close code 1013 or session limit messages)
  if (
    lowerMsg.includes('session limit reached') ||
    lowerMsg.includes('concurrent session limit') ||
    lowerMsg.includes('concurrent_session_limit') ||
    lowerMsg.includes('1013 session limit')
  ) {
    return {
      category: 'CONCURRENT_SESSION_LIMIT',
      message: 'Provider concurrent session limit reached. Backing off briefly.',
      statusCode: 429,
      retryable: true,
      cooldownMs: 20 * 1000, // 20 seconds cooldown
      quarantine: false
    };
  }

  // 5. Temporary provider capacity (capacity exceeded, Try Again Later)
  if (
    lowerMsg.includes('capacity_exceeded') ||
    lowerMsg.includes('try again later') ||
    lowerMsg.includes('capacity refusal') ||
    status === 503
  ) {
    return {
      category: 'TEMPORARY_CAPACITY',
      message: 'Provider is temporarily at capacity. Please retry shortly.',
      statusCode: 503,
      retryable: true,
      cooldownMs: 15 * 1000, // 15 seconds cooldown
      quarantine: false
    };
  }

  // 6. Network / handshake failure
  if (
    lowerMsg.includes('fetch failed') ||
    lowerMsg.includes('econnrefused') ||
    lowerMsg.includes('etimedout') ||
    lowerMsg.includes('enotfound') ||
    lowerMsg.includes('socket hang up') ||
    lowerMsg.includes('unable to verify the first certificate') ||
    lowerMsg.includes('tls')
  ) {
    return {
      category: 'NETWORK_FAILURE',
      message: 'Network connection handshake with provider failed.',
      statusCode: 502,
      retryable: true,
      cooldownMs: 5 * 1000, // 5 seconds cooldown
      quarantine: false
    };
  }

  // 7. Token expired
  if (lowerMsg.includes('token_expired') || lowerMsg.includes('token expired')) {
    return {
      category: 'TOKEN_EXPIRED',
      message: 'Decart client token expired.',
      statusCode: 401,
      retryable: true,
      cooldownMs: 0,
      quarantine: false
    };
  }

  // 8. Unsupported request or model
  if (status === 400 || lowerMsg.includes('invalid_options') || lowerMsg.includes('model_not_found')) {
    return {
      category: 'UNSUPPORTED_REQUEST',
      message: 'Unsupported try-on model or request options.',
      statusCode: 400,
      retryable: false,
      cooldownMs: 0,
      quarantine: false
    };
  }

  // 9. Unknown / unclassified error
  return {
    category: 'UNKNOWN',
    message: rawMessage || 'An unexpected provider error occurred.',
    statusCode: status >= 400 && status < 600 ? status : 500,
    retryable: false,
    cooldownMs: 10 * 1000,
    quarantine: false
  };
}

/**
 * Manages an in-memory pool of Decart API credentials with quota tracking,
 * health status, atomic global round-robin selection, and bounded fallback.
 */
export class DecartKeyPool {
  private credentials: Map<string, DecartCredential> = new Map();
  private quotaGroupStates: Map<string, { exhausted: boolean; cooldownUntil: number | null; reason: string | null }> = new Map();
  private roundRobinIndex: number = 0;
  private rotationPolicy: string = 'global_round_robin';

  constructor(initialConfigs?: CredentialConfig[]) {
    if (initialConfigs && initialConfigs.length > 0) {
      this.loadFromConfigs(initialConfigs);
    } else {
      this.loadFromEnvironment();
    }
  }

  /**
   * Discovers and loads credentials from server environment variables.
   * Supports:
   * - DECART_API_KEY_1, DECART_API_KEY_2, ... up to DECART_KEY_POOL_SIZE / 50
   * - VTON_API_KEY_1, VTON_API_KEY_2, ...
   * - DECART_API_KEY / VTON_API_KEY (backward compatible single key)
   * - DECART_API_KEYS / VTON_API_KEYS (JSON array or comma-separated list)
   * - DECART_ROTATION_POLICY (defaults to 'global_round_robin')
   */
  public loadFromEnvironment(): void {
    const configs: CredentialConfig[] = [];
    const discoveredKeys = new Set<string>();

    this.rotationPolicy = (process.env.DECART_ROTATION_POLICY || 'global_round_robin').toLowerCase().trim();

    const configuredPoolSize =
      process.env.DECART_KEY_POOL_SIZE || process.env.VTON_KEY_POOL_SIZE
        ? parseInt(process.env.DECART_KEY_POOL_SIZE || process.env.VTON_KEY_POOL_SIZE || '', 10)
        : undefined;

    const maxScanSlots = Math.max(50, configuredPoolSize || 20);

    const defaultQuotaGroup =
      process.env.DECART_QUOTA_GROUP ||
      process.env.VTON_QUOTA_GROUP ||
      'default-quota-group';

    const isPlaceholder = (val: string) => {
      const lower = val.toLowerCase().trim();
      return (
        lower.startsWith('paste_') ||
        lower.startsWith('your_') ||
        lower.includes('placeholder') ||
        lower === 'replace_me'
      );
    };

    const addKey = (key: string, explicitId?: string, quotaGroup?: string, priority?: number) => {
      if (!key) return;
      const cleanKey = key.trim();
      if (!cleanKey || isPlaceholder(cleanKey) || discoveredKeys.has(cleanKey)) return;
      discoveredKeys.add(cleanKey);

      const id = explicitId || `decart-key-${configs.length + 1}`;
      configs.push({
        id,
        apiKey: cleanKey,
        quotaGroup: quotaGroup || defaultQuotaGroup,
        priority: priority ?? 1,
        enabled: true
      });
    };

    // 1. Check numbered variables: DECART_API_KEY_1 .. DECART_API_KEY_50
    for (let i = 1; i <= maxScanSlots; i++) {
      const key = process.env[`DECART_API_KEY_${i}`] || process.env[`VTON_API_KEY_${i}`];
      if (key) {
        const quotaGroup =
          process.env[`DECART_QUOTA_GROUP_${i}`] ||
          process.env[`VTON_QUOTA_GROUP_${i}`] ||
          defaultQuotaGroup;
        const priorityStr = process.env[`DECART_PRIORITY_${i}`] || process.env[`VTON_PRIORITY_${i}`];
        const priority = priorityStr ? Number(priorityStr) : 1;
        addKey(key, `decart-key-${i}`, quotaGroup, priority);
      }
    }

    // 2. Check for JSON or comma-delimited pool in DECART_API_KEYS / VTON_API_KEYS
    const multiKeyVar = process.env.DECART_API_KEYS || process.env.VTON_API_KEYS;
    if (multiKeyVar) {
      const trimmed = multiKeyVar.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            parsed.forEach((item, index) => {
              if (typeof item === 'string') {
                addKey(item, `pool-key-${index + 1}`);
              } else if (item && typeof item === 'object' && item.apiKey) {
                addKey(item.apiKey, item.id || `pool-key-${index + 1}`, item.quotaGroup, item.priority);
              }
            });
          }
        } catch (e: any) {
          console.warn('[DecartKeyPool] Failed to parse DECART_API_KEYS as JSON, falling back to delimiter:', e?.message);
        }
      }

      if (configs.length === 0) {
        trimmed.split(/[,;\n]/).forEach((entry, idx) => {
          const cleaned = entry.trim();
          if (cleaned) addKey(cleaned, `pool-key-${idx + 1}`);
        });
      }
    }

    // 3. Fallback to existing single key for 100% backward compatibility
    const singleKey = process.env.DECART_API_KEY || process.env.VTON_API_KEY;
    if (singleKey) {
      addKey(singleKey, 'primary-key', process.env.DECART_QUOTA_GROUP || process.env.VTON_QUOTA_GROUP || 'primary-account', 10);
    }

    const activeConfigs =
      configuredPoolSize && configuredPoolSize > 0 && configs.length > configuredPoolSize
        ? configs.slice(0, configuredPoolSize)
        : configs;

    this.loadFromConfigs(activeConfigs);
  }

  /**
   * Initializes or updates the credential registry from clean configurations.
   */
  public loadFromConfigs(configs: CredentialConfig[]): void {
    const existing = new Map(this.credentials);
    this.credentials.clear();

    configs.forEach((cfg, index) => {
      const apiKey = cfg.apiKey.trim();
      if (!apiKey) return;

      const id = cfg.id || `decart-key-${index + 1}`;
      const quotaGroup = cfg.quotaGroup || `account-${index + 1}`;
      const priority = typeof cfg.priority === 'number' ? cfg.priority : 1;
      const enabled = cfg.enabled !== false;

      // Preserve existing health stats if the key was already registered
      const prev = existing.get(id);

      const client = createVtonClient({ apiKey });

      this.credentials.set(id, {
        id,
        apiKey,
        maskedKey: maskApiKey(apiKey),
        quotaGroup,
        enabled,
        priority,
        eligibility: prev?.eligibility || 'healthy',
        cooldownUntil: prev?.cooldownUntil || null,
        consecutiveFailures: prev?.consecutiveFailures || 0,
        lastErrorCategory: prev?.lastErrorCategory || null,
        lastErrorMessage: prev?.lastErrorMessage || null,
        lastSelectedAt: prev?.lastSelectedAt || null,
        lastSuccessAt: prev?.lastSuccessAt || null,
        lastFailureAt: prev?.lastFailureAt || null,
        successCount: prev?.successCount || 0,
        failureCount: prev?.failureCount || 0,
        tokensMinted: prev?.tokensMinted || 0,
        client
      });

      if (!this.quotaGroupStates.has(quotaGroup)) {
        this.quotaGroupStates.set(quotaGroup, {
          exhausted: false,
          cooldownUntil: null,
          reason: null
        });
      }
    });

    console.log(`[DecartKeyPool] Initialized pool with ${this.credentials.size} credentials across ${this.quotaGroupStates.size} quota groups. Rotation Policy: ${this.rotationPolicy}`);
  }

  /**
   * Evaluates expired cooldowns and updates eligibility.
   */
  private refreshCooldowns(now = Date.now()): void {
    // 1. Refresh quota groups
    for (const [groupName, state] of this.quotaGroupStates.entries()) {
      if (state.exhausted && state.cooldownUntil && now >= state.cooldownUntil) {
        state.exhausted = false;
        state.cooldownUntil = null;
        state.reason = null;
      }
    }

    // 2. Refresh individual credentials
    for (const cred of this.credentials.values()) {
      if (cred.eligibility === 'invalid') {
        // Invalid keys remain quarantined
        continue;
      }

      const groupExhausted = this.quotaGroupStates.get(cred.quotaGroup)?.exhausted;

      if (cred.cooldownUntil && now >= cred.cooldownUntil) {
        cred.cooldownUntil = null;
        if (!groupExhausted) {
          cred.eligibility = 'healthy';
        }
      }

      if (groupExhausted) {
        cred.eligibility = 'exhausted';
      } else if (cred.eligibility === 'exhausted' && !groupExhausted && !cred.cooldownUntil) {
        cred.eligibility = 'healthy';
      }
    }
  }

  /**
   * Returns the count of credentials currently eligible for selection.
   */
  public getEligibleCredentialsCount(): number {
    this.refreshCooldowns();
    let count = 0;
    for (const cred of this.credentials.values()) {
      const groupExhausted = this.quotaGroupStates.get(cred.quotaGroup)?.exhausted;
      if (cred.enabled && cred.eligibility === 'healthy' && !groupExhausted) {
        count++;
      }
    }
    return count;
  }

  /**
   * Atomically selects the next eligible credential using a priority-aware,
   * quota-group-aware GLOBAL round-robin strategy shared by all users.
   */
  public selectEligibleCredential(excludeQuotaGroups: Set<string> = new Set()): DecartCredential | null {
    this.refreshCooldowns();

    const candidates: DecartCredential[] = [];

    for (const cred of this.credentials.values()) {
      const groupExhausted = this.quotaGroupStates.get(cred.quotaGroup)?.exhausted;
      const isExcluded = excludeQuotaGroups.has(cred.quotaGroup);

      if (
        cred.enabled &&
        cred.eligibility === 'healthy' &&
        !groupExhausted &&
        !isExcluded
      ) {
        candidates.push(cred);
      }
    }

    if (candidates.length === 0) {
      return null;
    }

    // Find highest priority among candidates
    let highestPriority = -Infinity;
    for (const c of candidates) {
      if (c.priority > highestPriority) {
        highestPriority = c.priority;
      }
    }

    const topTier = candidates.filter((c) => c.priority === highestPriority);

    // Synchronous, atomic global round-robin pointer advancement for all incoming user requests
    const selected = topTier[this.roundRobinIndex % topTier.length];
    this.roundRobinIndex = (this.roundRobinIndex + 1) % 1000000;
    selected.lastSelectedAt = Date.now();

    return selected;
  }

  /**
   * Marks a provider quota group as exhausted (e.g. following HTTP 402 or terminal credit error).
   */
  public setQuotaGroupExhausted(quotaGroup: string, cooldownMs: number, reason: string): void {
    const now = Date.now();
    const cooldownUntil = now + cooldownMs;

    this.quotaGroupStates.set(quotaGroup, {
      exhausted: true,
      cooldownUntil,
      reason
    });

    for (const cred of this.credentials.values()) {
      if (cred.quotaGroup === quotaGroup && cred.eligibility !== 'invalid') {
        cred.eligibility = 'exhausted';
        cred.cooldownUntil = cooldownUntil;
        cred.lastErrorCategory = 'INSUFFICIENT_CREDITS';
        cred.lastErrorMessage = reason;
      }
    }

    console.warn(`[DecartKeyPool] Quota group "${quotaGroup}" marked EXHAUSTED for ${Math.round(cooldownMs / 60000)} minutes. Reason: ${reason}`);
  }

  /**
   * Generates a short-lived Decart client token with bounded automatic fallback
   * across independent provider credentials/quota groups.
   */
  public async generateClientToken(options: TokenMintOptions = {}): Promise<{
    token: any;
    credentialId: string;
    quotaGroup: string;
    fallbackCount: number;
  }> {
    if (this.credentials.size === 0) {
      throw new Error('No Decart credentials configured on the server. Please configure DECART_API_KEY_1 or VTON_API_KEY.');
    }

    const attemptedQuotaGroups = new Set<string>();
    let fallbackCount = 0;
    let lastError: any = null;
    let lastClassified: ClassifiedError | null = null;

    // Bounded attempts: up to available healthy credentials or max 4 attempts
    const maxAttempts = Math.max(1, Math.min(this.credentials.size, 4));

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const cred = this.selectEligibleCredential(attemptedQuotaGroups);

      if (!cred) {
        // No remaining eligible credentials in unattempted quota groups
        break;
      }

      try {
        const mintPayload: any = {
          expiresIn: options.expiresIn || 3600,
          allowedModels: options.allowedModels || ['lucy-vton-latest'],
        };

        if (options.maxSessionDuration) {
          mintPayload.constraints = {
            realtime: {
              maxSessionDuration: options.maxSessionDuration,
            },
          };
        }

        if (options.userId || options.origin) {
          mintPayload.metadata = {
            ...(options.userId ? { userId: options.userId } : {}),
            ...(options.origin ? { origin: options.origin } : {}),
            mintedAt: new Date().toISOString()
          };
        }

        const token = await cred.client.tokens.create(mintPayload);

        if (!token || (!token.apiKey && !token.token)) {
          throw new Error('Decart returned empty token response.');
        }

        // Record successful mint
        cred.eligibility = 'healthy';
        cred.consecutiveFailures = 0;
        cred.tokensMinted++;
        cred.successCount++;
        cred.lastSuccessAt = Date.now();

        return {
          token,
          credentialId: cred.id,
          quotaGroup: cred.quotaGroup,
          fallbackCount
        };
      } catch (err: any) {
        lastError = err;
        const classified = classifyDecartError(err);
        lastClassified = classified;

        cred.failureCount++;
        cred.consecutiveFailures++;
        cred.lastFailureAt = Date.now();
        cred.lastErrorCategory = classified.category;
        cred.lastErrorMessage = classified.message;

        if (classified.category === 'INSUFFICIENT_CREDITS') {
          this.setQuotaGroupExhausted(cred.quotaGroup, classified.cooldownMs, classified.message);
          attemptedQuotaGroups.add(cred.quotaGroup);
          fallbackCount++;
        } else if (classified.category === 'INVALID_API_KEY') {
          cred.eligibility = 'invalid';
          cred.cooldownUntil = Date.now() + classified.cooldownMs;
          console.error(`[DecartKeyPool] Credential "${cred.id}" (${cred.maskedKey}) REJECTED as invalid. Quarantining.`);
          fallbackCount++;
        } else if (classified.category === 'RATE_LIMITED') {
          cred.eligibility = 'rate_limited';
          cred.cooldownUntil = Date.now() + classified.cooldownMs;
          attemptedQuotaGroups.add(cred.quotaGroup);
          fallbackCount++;
        } else if (classified.category === 'CONCURRENT_SESSION_LIMIT' || classified.category === 'TEMPORARY_CAPACITY') {
          cred.eligibility = 'in_cooldown';
          cred.cooldownUntil = Date.now() + classified.cooldownMs;
          fallbackCount++;
        } else {
          // Network or unknown failure
          cred.cooldownUntil = Date.now() + classified.cooldownMs;
          if (classified.retryable) {
            fallbackCount++;
          } else {
            // Non-retryable request error (e.g. bad parameters), stop immediately
            break;
          }
        }
      }
    }

    // All attempts failed
    const userMessage = lastClassified?.category === 'INSUFFICIENT_CREDITS'
      ? 'Virtual Try-On capacity limit reached. All configured credential quotas are exhausted.'
      : (lastClassified?.message || lastError?.message || 'Failed to establish virtual try-on session.');

    const errorToThrow: any = new Error(userMessage);
    errorToThrow.status = lastClassified?.statusCode || 500;
    errorToThrow.category = lastClassified?.category || 'UNKNOWN';
    errorToThrow.fallbackCount = fallbackCount;
    throw errorToThrow;
  }

  /**
   * Processes client session feedback (e.g. terminal WebRTC disconnect reasons).
   */
  public recordSessionFeedback(credentialId: string, event: string, reason?: string): void {
    const cred = this.credentials.get(credentialId);
    if (!cred) return;

    const lowerReason = String(reason || '').toLowerCase();

    if (event === 'terminal_error' || lowerReason.includes('insufficient_credits') || lowerReason.includes('credit')) {
      this.setQuotaGroupExhausted(cred.quotaGroup, 60 * 60 * 1000, reason || 'WebRTC terminal credit exhaustion');
    } else if (lowerReason.includes('session_limit') || lowerReason.includes('concurrent session')) {
      cred.eligibility = 'in_cooldown';
      cred.cooldownUntil = Date.now() + 20 * 1000;
    }
  }

  /**
   * Resets health and cooldown timers on all credentials (for administrator use).
   */
  public resetHealth(credentialId?: string): void {
    if (credentialId) {
      const cred = this.credentials.get(credentialId);
      if (cred) {
        cred.eligibility = 'healthy';
        cred.cooldownUntil = null;
        cred.consecutiveFailures = 0;
        cred.lastErrorCategory = null;
        cred.lastErrorMessage = null;
        const groupState = this.quotaGroupStates.get(cred.quotaGroup);
        if (groupState) {
          groupState.exhausted = false;
          groupState.cooldownUntil = null;
          groupState.reason = null;
        }
      }
      return;
    }

    for (const group of this.quotaGroupStates.values()) {
      group.exhausted = false;
      group.cooldownUntil = null;
      group.reason = null;
    }

    for (const cred of this.credentials.values()) {
      cred.eligibility = 'healthy';
      cred.cooldownUntil = null;
      cred.consecutiveFailures = 0;
      cred.lastErrorCategory = null;
      cred.lastErrorMessage = null;
    }
  }

  /**
   * Sets administrative enable/disable status for a credential.
   */
  public setCredentialEnabled(id: string, enabled: boolean): boolean {
    const cred = this.credentials.get(id);
    if (!cred) return false;
    cred.enabled = enabled;
    return true;
  }

  /**
   * Produces a sanitized status report suitable for administrative inspection.
   * NEVER reveals permanent API keys.
   */
  public getStatusReport(): PoolStatusReport {
    this.refreshCooldowns();

    let healthyCount = 0;
    let inCooldownCount = 0;
    let exhaustedCount = 0;
    let invalidCount = 0;
    let totalTokensMinted = 0;

    const sanitizedList: SanitizedCredentialStatus[] = [];

    for (const cred of this.credentials.values()) {
      if (cred.eligibility === 'healthy') healthyCount++;
      else if (cred.eligibility === 'in_cooldown' || cred.eligibility === 'rate_limited') inCooldownCount++;
      else if (cred.eligibility === 'exhausted') exhaustedCount++;
      else if (cred.eligibility === 'invalid') invalidCount++;

      totalTokensMinted += cred.tokensMinted;

      sanitizedList.push({
        id: cred.id,
        maskedKey: cred.maskedKey,
        quotaGroup: cred.quotaGroup,
        enabled: cred.enabled,
        priority: cred.priority,
        eligibility: cred.eligibility,
        cooldownUntil: cred.cooldownUntil ? new Date(cred.cooldownUntil).toISOString() : null,
        consecutiveFailures: cred.consecutiveFailures,
        lastErrorCategory: cred.lastErrorCategory,
        lastErrorMessage: cred.lastErrorMessage,
        lastSelectedAt: cred.lastSelectedAt ? new Date(cred.lastSelectedAt).toISOString() : null,
        lastSuccessAt: cred.lastSuccessAt ? new Date(cred.lastSuccessAt).toISOString() : null,
        lastFailureAt: cred.lastFailureAt ? new Date(cred.lastFailureAt).toISOString() : null,
        successCount: cred.successCount,
        failureCount: cred.failureCount,
        tokensMinted: cred.tokensMinted
      });
    }

    const quotaGroups: Record<string, { exhausted: boolean; cooldownUntil: string | null }> = {};
    for (const [name, state] of this.quotaGroupStates.entries()) {
      quotaGroups[name] = {
        exhausted: state.exhausted,
        cooldownUntil: state.cooldownUntil ? new Date(state.cooldownUntil).toISOString() : null
      };
    }

    return {
      rotationPolicy: this.rotationPolicy,
      totalCredentials: this.credentials.size,
      healthyCount,
      inCooldownCount,
      exhaustedCount,
      invalidCount,
      totalTokensMinted,
      quotaGroups,
      credentials: sanitizedList
    };
  }
}

// Global singleton instance for the backend process
export const decartKeyPool = new DecartKeyPool();
