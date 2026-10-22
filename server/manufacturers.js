import { createApiHandler } from './favoritApi.js';

export function extractManufacturers(payload) {
  if (!payload || !Array.isArray(payload.goods)) {
    throw new Error('Invalid API response');
  }

  const brands = new Map();
  for (const item of payload.goods) {
    const brand = typeof item?.brand === 'string' ? item.brand.trim() : '';
    if (brand && !brands.has(brand.toLocaleUpperCase('ru'))) {
      brands.set(brand.toLocaleUpperCase('ru'), { brand });
    }
  }
  return [...brands.values()].sort((a, b) => a.brand.localeCompare(b.brand, 'ru'));
}

export function createManufacturersHandler(options = {}) {
  return createApiHandler({
    ...options,
    path: '/api/manufacturers',
    extract: (payload) => ({ manufacturers: extractManufacturers(payload) }),
  });
}
