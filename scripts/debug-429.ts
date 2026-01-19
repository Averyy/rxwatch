import { config } from 'dotenv';
config({ path: '.env.local' });

const DSC_API_URL = 'https://www.healthproductshortages.ca/api/v1';

async function test() {
  const accounts = JSON.parse(process.env.DSC_ACCOUNTS || '[]');

  // Try each account
  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    console.log(`\n--- Account ${i + 1}: ${account.email} ---`);

    try {
      const loginRes = await fetch(`${DSC_API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ email: account.email, password: account.password }),
      });

      console.log('Login status:', loginRes.status);
      const token = loginRes.headers.get('auth-token');

      if (!token) {
        console.log('No token received');
        continue;
      }

      // Try search
      const searchRes = await fetch(`${DSC_API_URL}/search?limit=1`, {
        headers: { 'auth-token': token },
      });

      console.log('Search status:', searchRes.status);
      console.log('Search headers:', Object.fromEntries(searchRes.headers.entries()));

      const body = await searchRes.text();
      console.log('Search body (first 500 chars):', body.substring(0, 500));

    } catch (e: any) {
      console.log('Error:', e.message);
    }
  }
}

test();
