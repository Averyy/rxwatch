import { config } from 'dotenv';
config({ path: '.env.local' });

const DSC_API_URL = 'https://www.healthproductshortages.ca/api/v1';

async function test() {
  const accounts = JSON.parse(process.env.DSC_ACCOUNTS || '[]');
  const account = accounts[1]; // Try second account

  console.log('Logging in as', account.email);
  const loginRes = await fetch(`${DSC_API_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email: account.email, password: account.password }),
  });
  const token = loginRes.headers.get('auth-token');
  console.log('Got token:', token ? 'yes' : 'no');

  console.log('Fetching first page (limit=10)...');
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    console.log('Aborting due to timeout...');
    controller.abort();
  }, 120000);

  try {
    const start = Date.now();
    const res = await fetch(`${DSC_API_URL}/search?limit=10&offset=0&orderby=id&order=asc`, {
      headers: { 'auth-token': token! },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`Status: ${res.status} (took ${elapsed}s)`);

    const data = await res.json();
    console.log('Reports in response:', data.data?.length);
    console.log('Total available:', data.total);
    if (data.data?.[0]) {
      console.log('First report ID:', data.data[0].id);
    }
  } catch (e: any) {
    clearTimeout(timeout);
    console.error('Fetch error:', e.message);
    if (e.cause) console.error('Cause:', e.cause);
  }
}

test();
