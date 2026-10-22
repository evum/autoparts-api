const API_URL = 'https://api.favorit-parts.ru/hs/hsprice/';

const apiErrors = {
  'Empty key!': 'Не настроен API-ключ сервиса.',
  'Invalid key client!': 'API-ключ не принят сервисом. Проверьте настройки.',
  'Empty number goods!': 'Введите артикул детали.',
  'Request quota exceeded!': 'Превышен лимит запросов. Попробуйте позже.',
};

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

export function createManufacturersHandler({ apiKey, fetchImpl = fetch, timeoutMs = 12000 } = {}) {
  return async (req, res, next) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname !== '/api/manufacturers') return next();

    const reply = (status, body) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify(body));
    };

    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return reply(405, { error: 'Метод не поддерживается.' });
    }

    const number = url.searchParams.get('number')?.trim();
    if (!number) return reply(400, { error: 'Введите артикул детали.' });
    if (number.length > 100) return reply(400, { error: 'Артикул должен быть не длиннее 100 символов.' });
    if (!apiKey?.trim()) {
      return reply(503, { error: 'Не настроен доступ к API. Укажите FAVORIT_API_KEY в .env и перезапустите сервер.' });
    }

    const upstreamUrl = new URL(API_URL);
    upstreamUrl.search = new URLSearchParams({ key: apiKey.trim(), number }).toString();

    try {
      const response = await fetchImpl(upstreamUrl, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'error',
      });
      const payload = await response.json().catch(() => null);
      if (payload?.error) {
        const description = String(payload.error);
        const message = Object.entries(apiErrors).find(([key]) => description.includes(key))?.[1];
        return reply(502, { error: message || 'Сервис автозапчастей вернул ошибку. Повторите запрос позже.' });
      }
      if (!response.ok) {
        return reply(response.status === 429 ? 429 : 502, {
          error: response.status === 429
            ? 'Превышен лимит запросов. Попробуйте позже.'
            : 'Сервис автозапчастей временно недоступен. Повторите запрос.',
        });
      }

      return reply(200, { manufacturers: extractManufacturers(payload) });
    } catch (error) {
      const timeout = error.name === 'TimeoutError' || error.name === 'AbortError';
      return reply(timeout ? 504 : 502, {
        error: timeout
          ? 'Сервис не ответил вовремя. Повторите запрос.'
          : 'Не удалось получить данные от сервиса автозапчастей. Повторите запрос.',
      });
    }
  };
}
