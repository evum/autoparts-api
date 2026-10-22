import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchOffers } from '../store/offersSlice.js';
import Loader from './Loader.jsx';

const PAGE_SIZE = 25;
const priceFormat = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const stockFormat = new Intl.NumberFormat('ru-RU');

export default function Offers({ article, brand }) {
  const dispatch = useDispatch();
  const { items, status, error } = useSelector((state) => state.offers);
  const [retry, setRetry] = useState(0);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
    const request = dispatch(fetchOffers({ number: article.trim(), brand }));
    return () => request.abort();
  }, [article, brand, dispatch, retry]);

  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * PAGE_SIZE;
  const busy = status === 'idle' || status === 'loading';

  return (
    <section className="search-panel p-4 p-md-5 mt-4" aria-labelledby="offers-title" aria-busy={busy}>
      <div className="step-label mb-3">ЭТАП 2 ИЗ 2 · АНАЛОГИ И ПРЕДЛОЖЕНИЯ</div>
      <h2 id="offers-title" className="h4 fw-semibold mb-2">Предложения для {brand}</h2>
      <p className="text-secondary mb-4">Артикул: <strong>{article.trim()}</strong></p>

      {busy && <Loader>Ищем аналоги и предложения…</Loader>}
      {status === 'failed' && (
        <div className="alert alert-danger mb-0" role="alert">
          <p className="mb-3">{error}</p>
          <button className="btn btn-outline-danger btn-sm" onClick={() => setRetry((value) => value + 1)}>
            Повторить поиск предложений
          </button>
        </div>
      )}
      {status === 'succeeded' && (items.length === 0 ? (
        <p className="text-secondary mb-0" role="status">Деталь и аналоги не найдены. Попробуйте выбрать другого производителя.</p>
      ) : (
        <>
          <p className="small text-secondary" role="status">Найдено позиций: {items.length}. Каждая строка соответствует предложению отдельного склада; позиции без предложений отмечены отдельно.</p>
          <div className="table-responsive">
            <table className="table align-middle offers-table">
              <caption className="visually-hidden">Исходная деталь и аналоги: производитель, название, артикул, склад, цена в рублях и остаток</caption>
              <thead>
                <tr>
                  <th scope="col">Деталь</th>
                  <th scope="col">Производитель</th>
                  <th scope="col">Склад</th>
                  <th scope="col" className="text-end text-nowrap">Цена, ₽</th>
                  <th scope="col" className="text-end">Остаток</th>
                </tr>
              </thead>
              <tbody>
                {items.slice(start, start + PAGE_SIZE).map((offer) => (
                  <tr key={offer.id}>
                    <td className="offer-detail">
                      <div className="fw-semibold">{offer.name}</div>
                      <div className="small text-secondary mt-1">{offer.number}</div>
                      <span className={`badge mt-2 ${offer.isAnalogue ? 'text-bg-light' : 'original-badge'}`}>
                        {offer.isAnalogue ? 'Аналог' : 'Исходная деталь'}
                      </span>
                    </td>
                    <td data-label="Производитель">{offer.brand}</td>
                    <td data-label="Склад" className="small text-secondary">{offer.warehouse || 'Нет предложений'}</td>
                    <td data-label="Цена, ₽" className="text-end text-nowrap fw-semibold">{offer.price === null ? 'Не указана' : priceFormat.format(offer.price)}</td>
                    <td data-label="Остаток" className={`text-end text-nowrap ${offer.stock === 0 ? 'text-secondary' : ''}`}>
                      {offer.stock === null ? 'Нет данных' : `${stockFormat.format(offer.stock)} шт.`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pageCount > 1 && (
            <nav className="d-flex align-items-center justify-content-between gap-3 flex-wrap mt-3" aria-label="Страницы предложений">
              <span className="small text-secondary" role="status">Страница {currentPage} из {pageCount} · {start + 1}–{Math.min(start + PAGE_SIZE, items.length)} из {items.length}</span>
              <div className="d-flex gap-2">
                <button className="btn btn-outline-secondary btn-sm" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Назад</button>
                <button className="btn btn-outline-secondary btn-sm" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Далее</button>
              </div>
            </nav>
          )}
        </>
      ))}
    </section>
  );
}
