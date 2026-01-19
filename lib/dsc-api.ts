/**
 * Drug Shortages Canada API Client
 *
 * Features:
 * - 60s timeout for slow API
 * - Account rotation on rate limit (429) or auth failure (401/403)
 * - Typed responses
 *
 * API Docs: https://www.healthproductshortages.ca/blog/52
 */

const DSC_API_URL = process.env.DSC_API_URL || 'https://www.healthproductshortages.ca/api/v1';
const TIMEOUT_MS = 60000; // 60 second timeout
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

/**
 * Sleep with exponential backoff + jitter
 */
async function backoff(attempt: number): Promise<void> {
  const delay = Math.min(BASE_DELAY_MS * Math.pow(2, attempt), 30000) + Math.random() * 1000;
  await new Promise(r => setTimeout(r, delay));
}

/**
 * Check if error is retryable (network issues, 5xx, rate limits)
 */
function isRetryableError(error: unknown, response?: Response): boolean {
  if (response) {
    return response.status >= 500 || response.status === 429;
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return error.name === 'AbortError' ||
           msg.includes('fetch') ||
           msg.includes('network') ||
           msg.includes('eai_again') ||
           msg.includes('econnreset');
  }
  return false;
}

export interface DSCAccount {
  email: string;
  password: string;
}

export interface DSCSearchParams {
  term?: string;
  din?: string;
  report_id?: string;
  limit?: number;
  offset?: number;
  orderby?: 'id' | 'company_name' | 'brand_name' | 'status' | 'type' | 'updated_date';
  order?: 'asc' | 'desc';
  filter_status?: string; // active_confirmed, anticipated_shortage, etc.
}

export interface DSCSearchResponse {
  data: DSCReport[];
  total: number;
  limit: number;
  offset: number;
}

// Simplified report type - full structure is in rawJson
export interface DSCReport {
  id: number;
  din: string;
  type: { id: number; label: 'shortage' | 'discontinuance' };
  status: string;
  company_name: string;
  created_date: string;
  updated_date: string;
  en_drug_brand_name: string;
  fr_drug_brand_name: string;
  en_drug_common_name: string;
  fr_drug_common_name: string;
  [key: string]: unknown; // Allow other fields
}

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export class DSCClient {
  private authToken: string | null = null;
  private currentAccountIndex = 0;
  private accounts: DSCAccount[];

  constructor(accounts: DSCAccount[]) {
    if (!accounts.length) {
      throw new Error('At least one DSC account is required');
    }
    this.accounts = accounts;
  }

  /**
   * Create client from environment variable
   */
  static fromEnv(): DSCClient {
    const accountsJson = process.env.DSC_ACCOUNTS;
    if (!accountsJson) {
      throw new Error('DSC_ACCOUNTS environment variable is required');
    }
    const accounts = JSON.parse(accountsJson) as DSCAccount[];
    return new DSCClient(accounts);
  }

  /**
   * Try to login with a single account (with retries for transient errors)
   */
  private async tryLoginAccount(accountIndex: number): Promise<string | null> {
    const account = this.accounts[accountIndex];
    if (!account) return null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await fetchWithTimeout(`${DSC_API_URL}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ email: account.email, password: account.password }),
        });

        if (!response.ok) {
          if (isRetryableError(null, response) && attempt < MAX_RETRIES - 1) {
            console.warn(`  Login attempt ${attempt + 1}/${MAX_RETRIES} for ${account.email} failed (${response.status}), retrying...`);
            await backoff(attempt);
            continue;
          }
          // Non-retryable error or exhausted retries - try next account
          console.warn(`  Login failed for ${account.email}: ${response.status}`);
          return null;
        }

        const authToken = response.headers.get('auth-token');
        if (!authToken) {
          console.warn(`  No auth-token received for ${account.email}`);
          return null;
        }

        return authToken;
      } catch (e) {
        const error = e instanceof Error ? e : new Error(String(e));

        if (isRetryableError(e) && attempt < MAX_RETRIES - 1) {
          console.warn(`  Login attempt ${attempt + 1}/${MAX_RETRIES} for ${account.email} failed (${error.message}), retrying...`);
          await backoff(attempt);
          continue;
        }
        // Exhausted retries - try next account
        console.warn(`  Login failed for ${account.email}: ${error.message}`);
        return null;
      }
    }

    return null;
  }

  /**
   * Login and get auth token - tries all accounts with retries
   */
  async login(accountIndex?: number): Promise<string> {
    const startIndex = accountIndex ?? this.currentAccountIndex;
    const accountCount = this.accounts.length;

    // Try each account starting from the specified/current index
    for (let i = 0; i < accountCount; i++) {
      const index = (startIndex + i) % accountCount;
      const account = this.accounts[index];

      console.log(`  Trying account ${index + 1}/${accountCount}: ${account.email}`);

      const authToken = await this.tryLoginAccount(index);
      if (authToken) {
        this.authToken = authToken;
        this.currentAccountIndex = index;
        return authToken;
      }
    }

    throw new Error(`All ${accountCount} DSC accounts failed to authenticate`);
  }

  /**
   * Rotate to next account (on rate limit or auth failure)
   */
  async rotateAccount(): Promise<string> {
    const nextIndex = (this.currentAccountIndex + 1) % this.accounts.length;
    if (nextIndex === 0 && this.currentAccountIndex !== 0) {
      throw new Error('All accounts exhausted');
    }
    return this.login(nextIndex);
  }

  /**
   * Make authenticated GET request with auto-retry on errors
   */
  private async apiGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    if (!this.authToken) {
      await this.login();
    }

    const url = new URL(`${DSC_API_URL}/${path}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await fetchWithTimeout(url.toString(), {
          headers: { 'auth-token': this.authToken! },
        });

        // Rotate account on auth/rate limit errors
        if (response.status === 401 || response.status === 403 || response.status === 429) {
          await this.rotateAccount();
          // Retry immediately with new token
          continue;
        }

        // Retry with backoff on 5xx errors
        if (isRetryableError(null, response) && attempt < MAX_RETRIES - 1) {
          console.warn(`  API request ${path} failed (${response.status}), retrying...`);
          await backoff(attempt);
          continue;
        }

        if (!response.ok) {
          throw new Error(`API request failed: ${path} - ${response.status}`);
        }

        // Handle JSON parse errors
        const text = await response.text();
        try {
          return JSON.parse(text) as T;
        } catch (parseError) {
          throw new Error(`JSON parse error for ${path}: ${(parseError as Error).message}`);
        }
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));

        if (isRetryableError(e) && attempt < MAX_RETRIES - 1) {
          console.warn(`  API request ${path} failed (${lastError.message}), retrying...`);
          await backoff(attempt);
          continue;
        }
        throw lastError;
      }
    }

    throw lastError || new Error(`Request failed after ${MAX_RETRIES} attempts`);
  }

  /**
   * Search reports with pagination
   */
  async search(params: DSCSearchParams = {}): Promise<DSCSearchResponse> {
    const queryParams: Record<string, string> = {};

    if (params.term) queryParams.term = params.term;
    if (params.din) queryParams.din = params.din;
    if (params.report_id) queryParams.report_id = params.report_id;
    if (params.limit) queryParams.limit = String(params.limit);
    if (params.offset) queryParams.offset = String(params.offset);
    if (params.orderby) queryParams.orderby = params.orderby;
    if (params.order) queryParams.order = params.order;
    if (params.filter_status) queryParams.filter_status = params.filter_status;

    return this.apiGet<DSCSearchResponse>('search', queryParams);
  }

  /**
   * Get shortage report details
   */
  async getShortage(id: number): Promise<DSCReport> {
    return this.apiGet<DSCReport>(`shortages/${id}`);
  }

  /**
   * Get discontinuance report details
   */
  async getDiscontinuance(id: number): Promise<DSCReport> {
    return this.apiGet<DSCReport>(`discontinuances/${id}`);
  }

  /**
   * Get report details (auto-detects type)
   */
  async getReport(id: number, type: 'shortage' | 'discontinuance'): Promise<DSCReport> {
    if (type === 'shortage') {
      return this.getShortage(id);
    }
    return this.getDiscontinuance(id);
  }

  /**
   * Get current account email (for logging)
   */
  getCurrentAccount(): string {
    return this.accounts[this.currentAccountIndex]?.email ?? 'unknown';
  }

  /**
   * Get total account count
   */
  getAccountCount(): number {
    return this.accounts.length;
  }
}
