import test from 'node:test';
import assert from 'node:assert/strict';
import { configureStore } from '@reduxjs/toolkit';
import { createOffersHandler, extractOffers } from '../server/offers.js';
import offers, { fetchOffers } from '../src/store/offersSlice.js';
import manufacturers, { articleChanged, brandSelected } from '../src/store/manufacturersSlice.js';

async function callApi(options, url = '/api/offers?number=01089&brand=FEBI') {
  const res = { setHeader() {}, end(body) { this.body = JSON.parse(body); } };
  await createOffersHandler(options)({ method: 'GET', url }, res, () => { assert.fail('Route must be handled'); });
  return { status: res.statusCode, body: res.body };
}

const product = {
  goodsID: 'original', brand: 'FEBI', number: '01089', name: 'Исходная деталь',
  price: 99999, count: 99,
  warehouses: [{ id: 'a', code: 'МСК', price: 1082, stock: 3 }, { id: 'b', code: 'СПБ', price: 1125.73, stock: 5 }],
  analogues: [{
    goodsID: 'analogue', brand: 'TEST', number: '123', name: 'Аналог', price: 88888, count: 55,
    warehouses: [{ id: 'c', price: 100, stock: 2 }],
  }],
};

test('returns original and nested analogues with each warehouse price and stock, never legacy totals', () => {
  const result = extractOffers({ goods: [product] });
  assert.equal(result.length, 3);
  assert.deepEqual(result.map(({ price, stock, isAnalogue }) => ({ price, stock, isAnalogue })), [
    { price: 1082, stock: 3, isAnalogue: false },
    { price: 1125.73, stock: 5, isAnalogue: false },
    { price: 100, stock: 2, isAnalogue: true },
  ]);
  assert.equal(result[0].warehouse, 'МСК');
  assert.equal(result[2].warehouse, 'c');
  assert.equal(result[2].brand, 'TEST');
  assert.equal(result[2].number, '123');
});

test('keeps zero stock and unknown prices distinct, including products without warehouses', () => {
  const result = extractOffers({ goods: [
    { brand: 'A', number: '1', count: 0, price: 100, warehouses: [] },
    { brand: 'A', number: '2', count: 9, price: 200 },
    { brand: 'A', number: '3', warehouses: [{ price: 0, stock: 0 }] },
    { brand: 'A', number: '4', warehouses: [{ price: null, stock: '' }] },
    { brand: 'A', number: '5', warehouses: [{ price: '12.50', stock: '3' }] },
  ] });
  assert.deepEqual(result.map(({ price, stock }) => [price, stock]), [
    [null, 0], [null, null], [0, 0], [null, null], [12.5, 3],
  ]);
  assert.equal(result[0].warehouse, null);
  assert.equal(result[2].warehouse, 'Склад не указан');
});

test('deduplicates identical offers but keeps different warehouse prices and deliveries', () => {
  const warehouse = product.warehouses[0];
  const result = extractOffers({ goods: [{
    ...product, analogues: [], warehouses: [
      warehouse, warehouse, { ...warehouse, price: 50 },
      { ...warehouse, shipmentDate: '2026-10-24' },
      { ...warehouse, warehouseShipping: 'other' },
    ],
  }] });
  assert.equal(result.length, 4);
  assert.equal(new Set(result.map(({ id }) => id)).size, 4);
});

test('treats empty structures as no results, malformed response as failure, and keeps analogues of an empty parent', () => {
  assert.deepEqual(extractOffers({ goods: [null, {}, { brand: '' }] }), []);
  assert.deepEqual(extractOffers({ goods: [] }), []);
  assert.throws(() => extractOffers({ unexpected: [] }), /Invalid API response/);
  assert.equal(extractOffers({ goods: [{ analogues: [product] }] }).length, 2);
});

test('second-stage request sends encoded number, brand and analogues=on', async () => {
  let requested;
  const query = new URLSearchParams({ number: '#A&B/+', brand: 'Meat & Doria' });
  const result = await callApi({ apiKey: 'test-key', fetchImpl: async (url) => {
    requested = url;
    return Response.json({ goods: [product] });
  } }, `/api/offers?${query}`);
  assert.equal(requested.searchParams.get('number'), '#A&B/+');
  assert.equal(requested.searchParams.get('brand'), 'Meat & Doria');
  assert.equal(requested.searchParams.get('analogues'), 'on');
  assert.equal(result.status, 200);
  assert.equal(result.body.offers.length, 3);
  assert.equal(JSON.stringify(result.body).includes('test-key'), false);
});

test('requires selected brand and handles empty results, API errors, malformed JSON and timeouts', async () => {
  const missingBrand = await callApi({ apiKey: 'test-key', fetchImpl: () => assert.fail('Must validate first') }, '/api/offers?number=01089');
  assert.equal(missingBrand.status, 400);
  for (const [fetchImpl, status] of [
    [async () => Response.json({ goods: [{}] }), 200],
    [async () => Response.json({ error: 'Invalid key client!' }, { status: 403 }), 502],
    [async () => new Response('invalid json'), 502],
    [async () => { throw new DOMException('Timeout', 'TimeoutError'); }, 504],
  ]) {
    assert.equal((await callApi({ apiKey: 'test-key', fetchImpl })).status, status);
  }
});

test('changing brand or article immediately clears offers and ignores late success or error', () => {
  let state = offers(undefined, fetchOffers.pending('old', { number: '01089', brand: 'FEBI' }));
  state = offers(state, brandSelected('TEST'));
  state = offers(state, fetchOffers.fulfilled(['stale'], 'old', {}));
  assert.deepEqual(state.items, []);
  assert.equal(state.status, 'idle');

  state = offers(state, fetchOffers.pending('new', {}));
  state = offers(state, fetchOffers.rejected(new Error('Stale error'), 'old', {}));
  assert.equal(state.status, 'loading');
  state = offers(state, fetchOffers.fulfilled(['current'], 'new', {}));
  assert.deepEqual(state.items, ['current']);
  state = offers(state, articleChanged('other'));
  assert.deepEqual(state.items, []);
  assert.equal(state.error, null);
});

test('client sends both parameters and exposes a recoverable API error', async (t) => {
  const store = configureStore({ reducer: { manufacturers, offers } });
  let requested;
  t.mock.method(globalThis, 'fetch', async (url, { signal }) => {
    requested = new URL(url, 'http://localhost');
    assert.ok(signal instanceof AbortSignal);
    return Response.json({ offers: extractOffers({ goods: [product] }) });
  });
  await store.dispatch(fetchOffers({ number: 'A&B', brand: 'Meat & Doria' }));
  assert.equal(requested.searchParams.get('number'), 'A&B');
  assert.equal(requested.searchParams.get('brand'), 'Meat & Doria');
  assert.equal(store.getState().offers.status, 'succeeded');
  assert.equal(store.getState().offers.items.length, 3);
  globalThis.fetch.mock.mockImplementation(async () => Response.json({ error: 'Повторите запрос' }, { status: 502 }));
  await store.dispatch(fetchOffers({ number: 'A&B', brand: 'Meat & Doria' }));
  assert.equal(store.getState().offers.status, 'failed');
  assert.equal(store.getState().offers.error, 'Повторите запрос');
});

test('cancels in-flight offers when a new selection replaces them without showing an error', async (t) => {
  const store = configureStore({ reducer: { offers } });
  t.mock.method(globalThis, 'fetch', (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  }));
  const request = store.dispatch(fetchOffers({ number: '01089', brand: 'FEBI' }));
  store.dispatch(articleChanged('new'));
  request.abort();
  await request;
  assert.equal(store.getState().offers.status, 'idle');
  assert.equal(store.getState().offers.error, null);
  assert.deepEqual(store.getState().offers.items, []);
});
