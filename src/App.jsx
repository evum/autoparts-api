import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { articleChanged, brandSelected, fetchManufacturers } from './store/manufacturersSlice.js';
import Loader from './components/Loader.jsx';
import Offers from './components/Offers.jsx';

export default function App() {
  const dispatch = useDispatch();
  const { article, items, selectedBrand, status, error } = useSelector((state) => state.manufacturers);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const number = article.trim();
    if (!number) return;

    let request;
    const timer = setTimeout(() => {
      request = dispatch(fetchManufacturers(number));
    }, 500);

    return () => {
      clearTimeout(timer);
      request?.abort();
    };
  }, [article, dispatch, retry]);

  const busy = status === 'loading' || status === 'waiting';

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="container page-width d-flex align-items-center gap-3">
          <span className="brand-mark" aria-hidden="true">A</span>
          <span className="fw-semibold">AUTOPARTS<span className="brand-dot">.</span></span>
          <span className="ms-auto small text-secondary">Поиск автозапчастей</span>
        </div>
      </header>

      <main className="container page-width py-5">
        <div className="step-label mb-3">ЭТАП 1 ИЗ 2 · ПОИСК ПРОИЗВОДИТЕЛЯ</div>
        <h1 className="fw-bold mb-3">Начните с артикула</h1>
        <p className="text-secondary intro-text mb-4">
          Введите номер детали — найдём производителей, у которых есть этот артикул.
        </p>

        <section className="search-panel p-4 p-md-5" aria-labelledby="search-title">
          <h2 id="search-title" className="h5 fw-semibold mb-4">Номер детали</h2>
          <label htmlFor="article" className="form-label">Артикул</label>
          <input
            id="article"
            className="form-control form-control-lg"
            value={article}
            onChange={(event) => dispatch(articleChanged(event.target.value))}
            placeholder="Например, 7160500039S"
            maxLength={100}
            autoComplete="off"
            spellCheck={false}
            aria-describedby="article-help"
            type="text"
          />
          <div id="article-help" className="form-text mt-2">
            Поиск начнётся автоматически после ввода.
          </div>

          <div className="results mt-4 pt-4" aria-busy={busy}>
            {status === 'idle' && (
              <p className="text-secondary mb-0">Здесь появятся доступные производители.</p>
            )}
            {busy && <Loader>Ищем производителей…</Loader>}
            {status === 'failed' && (
              <div className="alert alert-danger mb-0" role="alert">
                <p className="mb-3">{error}</p>
                <button className="btn btn-outline-danger btn-sm" onClick={() => setRetry((value) => value + 1)}>
                  Повторить запрос
                </button>
              </div>
            )}
            {status === 'succeeded' && (
              <>
                <h2 className="h5 mb-3" aria-live="polite">
                  {items.length ? <>Выберите производителя <span className="badge text-bg-light ms-1">{items.length}</span></> : 'Производители не найдены'}
                </h2>
                {items.length === 0 ? (
                  <p className="text-secondary mb-0">По артикулу «{article.trim()}» нет результатов. Проверьте номер детали.</p>
                ) : (
                  <div className="manufacturer-list d-grid gap-2" role="group" aria-label="Производители">
                    {items.map(({ brand }) => (
                      <button
                        key={brand}
                        className={`manufacturer-button btn d-flex align-items-center justify-content-between text-start ${selectedBrand === brand ? 'selected' : ''}`}
                        onClick={() => { if (selectedBrand !== brand) dispatch(brandSelected(brand)); }}
                        aria-pressed={selectedBrand === brand}
                      >
                        <span className="fw-semibold">{brand}</span>
                        <span className="selection-indicator" aria-hidden="true">{selectedBrand === brand ? '✓' : '→'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          {selectedBrand && (
            <p className="selection-message mt-4 mb-0" role="status">
              Выбран производитель: <strong>{selectedBrand}</strong>. Артикул: <strong>{article.trim()}</strong>.
            </p>
          )}
        </section>
        {selectedBrand && <Offers article={article} brand={selectedBrand} />}
        <p className="small text-secondary mt-3">Данные сервиса «Фаворит»</p>
      </main>
    </div>
  );
}
