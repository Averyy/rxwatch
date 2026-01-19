/**
 * Fetch all historical reports from Drug Shortages Canada API
 *
 * Simple sequential fetch with one account to avoid rate limits.
 * Saves raw JSON responses to history/ folder as monthly chunks.
 *
 * Usage: npx tsx scripts/fetch-history.ts
 */

import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

config({ path: '.env.local' });

const DSC_API_URL = process.env.DSC_API_URL || 'https://healthproductshortages.ca/api/v1';
const TIMEOUT_MS = 120000; // 2 min timeout
const PAGE_SIZE = 100;
const DELAY_BETWEEN_PAGES_MS = 500; // Be nice to the API
const HISTORY_DIR = path.join(process.cwd(), 'history');
const PROGRESS_FILE = path.join(process.cwd(), '.fetch-progress.json');

interface DSCAccount {
  email: string;
  password: string;
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, retries = 5): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);
      return response;
    } catch (e: any) {
      clearTimeout(timeout);
      const isRetryable =
        e.cause?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
        e.cause?.code === 'UND_ERR_SOCKET' ||
        e.cause?.code === 'ECONNRESET' ||
        e.name === 'AbortError' ||
        e.message?.includes('fetch failed');

      if (isRetryable && attempt < retries) {
        const waitSec = attempt * 5;
        console.log(`  Network error (${e.cause?.code || e.message}), retry ${attempt}/${retries} in ${waitSec}s...`);
        await new Promise((r) => setTimeout(r, waitSec * 1000));
        continue;
      }
      throw e;
    }
  }
  throw new Error('Unexpected: exhausted retries');
}

async function login(account: DSCAccount): Promise<string> {
  console.log(`Logging in as ${account.email}...`);
  const response = await fetchWithTimeout(`${DSC_API_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email: account.email, password: account.password }),
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.status}`);
  }

  const authToken = response.headers.get('auth-token');
  if (!authToken) {
    throw new Error('No auth-token received');
  }

  console.log('Login successful\n');
  return authToken;
}

async function fetchPage(
  authToken: string,
  offset: number
): Promise<{ data: Record<string, unknown>[]; total: number }> {
  const url = new URL(`${DSC_API_URL}/search`);
  url.searchParams.set('limit', String(PAGE_SIZE));
  url.searchParams.set('offset', String(offset));
  url.searchParams.set('orderby', 'id');
  url.searchParams.set('order', 'asc');

  const response = await fetchWithTimeout(url.toString(), {
    headers: { 'auth-token': authToken },
  });

  if (response.status === 429) {
    // Rate limited - wait until reset time + 1 second
    const resetTimestamp = response.headers.get('x-ratelimit-reset');
    const resetTime = resetTimestamp ? parseInt(resetTimestamp) * 1000 : Date.now() + 60000;
    const waitMs = Math.max(resetTime - Date.now() + 1000, 1000); // At least 1s
    const waitMins = (waitMs / 60000).toFixed(1);

    console.log(`  Rate limited! Waiting ${waitMins} min until ${new Date(resetTime).toLocaleTimeString()}...`);
    await new Promise((r) => setTimeout(r, waitMs));
    return fetchPage(authToken, offset);
  }

  if (response.status === 503 || response.status === 502 || response.status === 500) {
    // Server error - wait and retry
    console.log(`  Server error (${response.status}), waiting 10s and retrying...`);
    await new Promise((r) => setTimeout(r, 10000));
    return fetchPage(authToken, offset);
  }

  if (!response.ok) {
    throw new Error(`Search failed: ${response.status}`);
  }

  return response.json();
}

interface Progress {
  offset: number;
  reports: Record<string, unknown>[];
  total: number;
}

function saveProgress(progress: Progress): void {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress));
}

function loadProgress(): Progress | null {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    }
  } catch {
    // ignore
  }
  return null;
}

function clearProgress(): void {
  if (fs.existsSync(PROGRESS_FILE)) {
    fs.unlinkSync(PROGRESS_FILE);
  }
}

function groupByMonth(reports: Record<string, unknown>[]): Map<string, Record<string, unknown>[]> {
  const byMonth = new Map<string, Record<string, unknown>[]>();

  for (const report of reports) {
    const createdDate = report.created_date as string;
    const month = createdDate ? createdDate.substring(0, 7) : 'unknown';
    if (!byMonth.has(month)) byMonth.set(month, []);
    byMonth.get(month)!.push(report);
  }

  return byMonth;
}

function saveToHistory(reports: Record<string, unknown>[]): void {
  if (!fs.existsSync(HISTORY_DIR)) {
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
  }

  const byMonth = groupByMonth(reports);
  const months = Array.from(byMonth.keys()).sort();

  console.log(`\nSaving ${reports.length} reports to ${months.length} monthly files...`);

  for (const month of months) {
    const monthReports = byMonth.get(month)!;
    const filePath = path.join(HISTORY_DIR, `${month}.json`);
    monthReports.sort((a, b) => (a.id as number) - (b.id as number));
    fs.writeFileSync(filePath, JSON.stringify(monthReports, null, 2));
    console.log(`  ${month}.json: ${monthReports.length} reports`);
  }
}

async function main() {
  console.log('=== Drug Shortages Canada History Fetch ===\n');

  // Get first account
  const accounts: DSCAccount[] = JSON.parse(process.env.DSC_ACCOUNTS || '[]');
  if (accounts.length === 0) {
    console.error('No DSC_ACCOUNTS configured');
    process.exit(1);
  }

  const authToken = await login(accounts[0]);

  // Check for existing progress
  let progress = loadProgress();
  let allReports: Record<string, unknown>[];
  let offset: number;
  let total: number;

  if (progress && progress.reports.length > 0) {
    console.log(`Resuming from previous progress: ${progress.reports.length}/${progress.total} reports\n`);
    allReports = progress.reports;
    offset = progress.offset;
    total = progress.total;
  } else {
    // Get total count
    console.log('Getting total count...');
    const firstPage = await fetchPage(authToken, 0);
    total = firstPage.total;
    console.log(`Total reports: ${total}\n`);
    allReports = [...firstPage.data];
    offset = PAGE_SIZE;
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const startTime = Date.now();
  let page = Math.floor(offset / PAGE_SIZE) + 1;

  console.log(`Page ${page}/${totalPages}: ${allReports.length}/${total} reports`);
  console.log(`Estimated time: ~${Math.ceil((totalPages - page) * 2.5 / 60)} minutes remaining\n`);

  while (offset < total) {
    await new Promise((r) => setTimeout(r, DELAY_BETWEEN_PAGES_MS));

    const result = await fetchPage(authToken, offset);

    if (result.data.length === 0) {
      console.log('No more data');
      break;
    }

    allReports.push(...result.data);
    offset += result.data.length;
    page++;

    // Progress with ETA
    const elapsed = (Date.now() - startTime) / 1000;
    const pagesPerSec = Math.max(1, page - Math.floor(progress?.offset || 0) / PAGE_SIZE) / elapsed;
    const remainingPages = totalPages - page;
    const etaSeconds = remainingPages / pagesPerSec;
    const etaMin = Math.ceil(etaSeconds / 60);

    console.log(`Page ${page}/${totalPages}: ${allReports.length}/${total} reports (ETA: ${etaMin}m)`);

    // Save progress every 25 pages
    if (page % 25 === 0) {
      saveProgress({ offset, reports: allReports, total });
      console.log('  [progress saved]');
    }
  }

  console.log(`\nFetch complete: ${allReports.length} reports`);

  // Save to history folder
  saveToHistory(allReports);

  // Clear progress file on success
  clearProgress();

  console.log('\n=== Done! ===');
  console.log(`History saved to: ${HISTORY_DIR}/`);
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
