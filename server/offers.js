import { createApiHandler } from './favoritApi.js';

const text = (value) => typeof value === 'string' ? value.trim() : '';
const numeric = (value) => {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null;
  const result = Number(value);
  return Number.isFinite(result) && result >= 0 ? result : null;
};

export function extractOffers(payload) {
  if (!payload || !Array.isArray(payload.goods)) throw new Error('Invalid API response');

  const goods = payload.goods.map((item) => ({ item, isAnalogue: false }));
  const analogues = payload.goods.flatMap((item) => (
    Array.isArray(item?.analogues) ? item.analogues.map((analogue) => ({ item: analogue, isAnalogue: true })) : []
  ));
  const offers = new Map();

  for (const { item, isAnalogue } of [...goods, ...analogues]) {
    const brand = text(item?.brand);
    const number = text(item?.number);
    if (!brand || !number) continue;
    const warehouses = Array.isArray(item.warehouses) ? item.warehouses.filter((warehouse) => warehouse && typeof warehouse === 'object') : [];

    for (const warehouse of warehouses.length ? warehouses : [null]) {
      const price = numeric(warehouse?.price);
      const stock = warehouse ? numeric(warehouse.stock) : numeric(item.count) === 0 ? 0 : null;
      const warehouseName = text(warehouse?.code) || text(warehouse?.id) || null;
      const id = JSON.stringify([
        text(item.goodsID) || `${brand}:${number}`, warehouse?.id, warehouse?.code,
        warehouse?.warehouseShipping, warehouse?.shipmentDate, price, stock,
      ]);
      if (!offers.has(id)) {
        offers.set(id, {
          id, brand, number, name: text(item.name) || 'Название не указано',
          isAnalogue, warehouse: warehouse ? warehouseName || 'Склад не указан' : null, price, stock,
        });
      }
    }
  }
  return [...offers.values()];
}

export function createOffersHandler(options = {}) {
  return createApiHandler({
    ...options,
    path: '/api/offers',
    withBrand: true,
    extract: (payload) => ({ offers: extractOffers(payload) }),
  });
}
