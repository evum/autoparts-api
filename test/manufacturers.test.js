import test from 'node:test';
import assert from 'node:assert/strict';
import { createManufacturersHandler, extractManufacturers } from '../server/manufacturers.js';
import reducer, { articleChanged, brandSelected, fetchManufacturers } from '../src/store/manufacturersSlice.js';
import { configureStore } from '@reduxjs/toolkit';

async function callApi(options, url = '/api/manufacturers?number=01089', method = 'GET') {
  const headers = {};
  const res = {
    setHeader: (name, value) => { headers[name] = value; },
    end: (body) => { res.body = JSON.parse(body); },
  };
  let passedThrough = false;
  await createManufacturersHandler(options)({ url, method }, res, () => { passedThrough = true; });
  return { status: res.statusCode, body: res.body, headers, passedThrough };
}

test('removes duplicates and blank brands, including the documented empty structure', () => {
  assert.deepEqual(extractManufacturers({ goods: [
    {}, null, { brand: '' }, { brand: ' ' }, { brand: 12 },
    { brand: ' ZEN ' }, { brand: 'zen' }, { brand: 'CAFFARO' },
  ] }), [{ brand: 'CAFFARO' }, { brand: 'ZEN' }]);
  assert.deepEqual(extractManufacturers({ goods: [{}] }), []);
  assert.deepEqual(extractManufacturers({ goods: [] }), []);
  assert.throws(() => extractManufacturers({}), /Invalid API response/);
});

test('first-stage upstream request encodes article and omits brand and analogues', async () => {
  let upstream;
  const result = await callApi({
    apiKey: 'test-key',
    fetchImpl: async (url) => {
      upstream = url;
      return Response.json({ goods: [{ brand: 'MEYLE' }] });
    },
  }, `/api/manufacturers?${new URLSearchParams({ number: ' #A&B/+ ' })}`);
  assert.equal(upstream.protocol, 'https:');
  assert.equal(upstream.searchParams.get('number'), '#A&B/+');
  assert.equal(upstream.searchParams.get('key'), 'test-key');
  assert.equal(upstream.searchParams.has('brand'), false);
  assert.equal(upstream.searchParams.has('analogues'), false);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { manufacturers: [{ brand: 'MEYLE' }] });
  assert.equal(result.headers['Cache-Control'], 'no-store');
  assert.equal(JSON.stringify(result.body).includes('test-key'), false);
});

test('validates input and key without contacting upstream', async () => {
  const options = { fetchImpl: () => { assert.fail('Must not call external API'); } };
  assert.equal((await callApi(options)).status, 503);
  assert.equal((await callApi(options, '/api/manufacturers?number=%20')).status, 400);
  assert.equal((await callApi(options, `/api/manufacturers?number=${'A'.repeat(101)}`)).status, 400);
  assert.equal((await callApi(options, '/api/manufacturers', 'POST')).status, 405);
  assert.equal((await callApi(options, '/src/main.jsx')).passedThrough, true);
});

test('handles documented API errors and never forwards unknown messages containing secrets', async () => {
  for (const [error, expected] of [
    ['Invalid key client!', 'API-ключ не принят'],
    ['Request quota exceeded!', 'Превышен лимит'],
    ['Internal failure with test-key', 'Сервис автозапчастей вернул ошибку'],
  ]) {
    const result = await callApi({ apiKey: 'test-key', fetchImpl: async () => Response.json({ error }) });
    assert.equal(result.status, 502);
    assert.ok(result.body.error.includes(expected));
    assert.equal(result.body.error.includes('test-key'), false);
  }
  const forbidden = await callApi({
    apiKey: 'test-key',
    fetchImpl: async () => Response.json({ error: 'Invalid key client!' }, { status: 403 }),
  });
  assert.ok(forbidden.body.error.includes('API-ключ не принят'));
});

test('distinguishes empty results from malformed, HTTP, network and timeout failures', async () => {
  for (const [fetchImpl, status] of [
    [async () => Response.json({ goods: [{}] }), 200],
    [async () => Response.json({ unexpected: [] }), 502],
    [async () => new Response('<html>Unavailable</html>'), 502],
    [async () => new Response('', { status: 500 }), 502],
    [async () => new Response('', { status: 429 }), 429],
    [async () => { throw new TypeError('Network error'); }, 502],
    [async () => { throw new DOMException('Timeout', 'TimeoutError'); }, 504],
  ]) {
    assert.equal((await callApi({ apiKey: 'test-key', fetchImpl })).status, status);
  }
});

test('changing article clears selection and ignores a late response to the old article', () => {
  let state = reducer(undefined, articleChanged('old'));
  state = reducer(state, fetchManufacturers.pending('old-request', 'old'));
  state = reducer(state, articleChanged('new'));
  state = reducer(state, fetchManufacturers.fulfilled([{ brand: 'OLD' }], 'old-request', 'old'));
  assert.equal(state.article, 'new');
  assert.equal(state.status, 'waiting');
  assert.deepEqual(state.items, []);

  state = reducer(state, fetchManufacturers.pending('new-request', 'new'));
  state = reducer(state, fetchManufacturers.rejected(new Error('Old error'), 'old-request', 'old'));
  assert.equal(state.status, 'loading');
  state = reducer(state, fetchManufacturers.fulfilled([{ brand: 'MEYLE' }], 'new-request', 'new'));
  state = reducer(state, brandSelected('UNKNOWN'));
  assert.equal(state.selectedBrand, null);
  state = reducer(state, brandSelected('MEYLE'));
  assert.equal(state.selectedBrand, 'MEYLE');
  state = reducer(state, articleChanged(' '));
  assert.equal(state.selectedBrand, null);
  assert.deepEqual(state.items, []);
  assert.equal(state.status, 'idle');
});

test('client thunk sends article and stores results or a recoverable server error', async (t) => {
  const store = configureStore({ reducer: { manufacturers: reducer } });
  let requested;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requested = url;
    assert.ok(options.signal instanceof AbortSignal);
    return Response.json({ manufacturers: [{ brand: 'MEYLE' }] });
  });
  await store.dispatch(fetchManufacturers('A&B'));
  assert.equal(new URL(requested, 'http://localhost').searchParams.get('number'), 'A&B');
  assert.equal(store.getState().manufacturers.status, 'succeeded');
  assert.deepEqual(store.getState().manufacturers.items, [{ brand: 'MEYLE' }]);
  globalThis.fetch.mock.mockImplementation(async () => Response.json({ error: 'Не настроен API-ключ' }, { status: 503 }));
  await store.dispatch(fetchManufacturers('A&B'));
  assert.equal(store.getState().manufacturers.status, 'failed');
  assert.equal(store.getState().manufacturers.error, 'Не настроен API-ключ');
});

test('aborted client request does not become an error', async (t) => {
  const store = configureStore({ reducer: { manufacturers: reducer } });
  t.mock.method(globalThis, 'fetch', (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  }));
  const request = store.dispatch(fetchManufacturers('old'));
  request.abort();
  await request;
  assert.equal(store.getState().manufacturers.status, 'idle');
  assert.equal(store.getState().manufacturers.error, null);
});
