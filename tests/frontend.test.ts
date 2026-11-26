import assert from 'node:assert/strict';
import test from 'node:test';
import { CITIES, CITY_MAP } from '../src/data/cities.ts';
import {
  apiRequest,
  loginUser,
  logoutUser,
  signupUser,
} from '../src/services/api.ts';
import {
  getCategoryFromAqi,
  getCategoryFromPm25,
  getCategoryRangeLabel,
  getHealthGuidance,
} from '../src/utils/aqi.ts';

test('getCategoryFromAqi maps CPCB breakpoints accurately', () => {
  assert.equal(getCategoryFromAqi(25), 'Good');
  assert.equal(getCategoryFromAqi(50), 'Good');
  assert.equal(getCategoryFromAqi(51), 'Satisfactory');
  assert.equal(getCategoryFromAqi(100), 'Satisfactory');
  assert.equal(getCategoryFromAqi(150), 'Moderate');
  assert.equal(getCategoryFromAqi(250), 'Poor');
  assert.equal(getCategoryFromAqi(350), 'Very Poor');
  assert.equal(getCategoryFromAqi(450), 'Severe');
});

test('getCategoryFromPm25 maps PM2.5 thresholds accurately', () => {
  assert.equal(getCategoryFromPm25(18), 'Good');
  assert.equal(getCategoryFromPm25(45), 'Satisfactory');
  assert.equal(getCategoryFromPm25(75), 'Moderate');
  assert.equal(getCategoryFromPm25(110), 'Poor');
  assert.equal(getCategoryFromPm25(190), 'Very Poor');
  assert.equal(getCategoryFromPm25(300), 'Severe');
});

test('getCategoryRangeLabel and getHealthGuidance return non-empty strings for all categories', () => {
  const categories = [
    'Good',
    'Satisfactory',
    'Moderate',
    'Poor',
    'Very Poor',
    'Severe',
  ] as const;

  for (const cat of categories) {
    assert.ok(getCategoryRangeLabel(cat).includes('AQI'));
    assert.ok(getHealthGuidance(cat).length > 20);
  }
});

test('CITY_MAP covers all six Indian cities cleanly', () => {
  assert.equal(CITIES.length, 6);
  for (const city of CITIES) {
    assert.equal(CITY_MAP[city.id].name, city.name);
    assert.equal(city.coordinates.length, 2);
  }
});

test('API client uses credentials include and parses errors safely', async () => {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    if (String(input) === '/api/auth/login') {
      return new Response(
        JSON.stringify({
          user: {
            id: 1,
            fullName: 'Test User',
            email: 'test@example.com',
            preferredCity: 'chennai',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (String(input) === '/api/auth/signup') {
      return new Response(
        JSON.stringify({ detail: 'An account with this email already exists.' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;

  try {
    const loginRes = await loginUser({
      email: 'test@example.com',
      password: 'Password123',
    });
    assert.equal(loginRes.user.email, 'test@example.com');
    assert.equal(calls[0].init?.credentials, 'include');
    const hdrs = calls[0].init?.headers as Record<string, string>;
    assert.equal(hdrs['X-Requested-With'], 'XMLHttpRequest');

    await assert.rejects(
      () =>
        signupUser({
          fullName: 'Test User',
          email: 'test@example.com',
          password: 'Password123',
          preferredCity: 'chennai',
        }),
      /already exists/
    );

    await logoutUser();
    assert.equal(calls[2].url, '/api/auth/logout');
    assert.equal(calls[2].init?.credentials, 'include');

    const health = await apiRequest<{ ok: boolean }>('/api/health');
    assert.equal(health.ok, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
