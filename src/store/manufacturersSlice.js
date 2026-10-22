import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

export const fetchManufacturers = createAsyncThunk(
  'manufacturers/fetch',
  async (number, { signal, rejectWithValue }) => {
    try {
      const query = new URLSearchParams({ number });
      const response = await fetch(`/api/manufacturers?${query}`, { signal });
      const payload = await response.json();
      if (!response.ok) {
        return rejectWithValue(payload.error || 'Не удалось загрузить производителей.');
      }
      if (!Array.isArray(payload.manufacturers)) throw new Error('Invalid response');
      return payload.manufacturers;
    } catch (error) {
      if (signal.aborted) throw error;
      return rejectWithValue('Не удалось загрузить производителей. Проверьте подключение и повторите запрос.');
    }
  },
);

const manufacturersSlice = createSlice({
  name: 'manufacturers',
  initialState: {
    article: '',
    items: [],
    selectedBrand: null,
    status: 'idle',
    error: null,
    requestId: null,
  },
  reducers: {
    articleChanged(state, { payload }) {
      state.article = payload;
      state.items = [];
      state.selectedBrand = null;
      state.error = null;
      state.requestId = null;
      state.status = payload.trim() ? 'waiting' : 'idle';
    },
    brandSelected(state, { payload }) {
      if (state.items.some(({ brand }) => brand === payload)) state.selectedBrand = payload;
    },
  },
  extraReducers: (builder) => builder
    .addCase(fetchManufacturers.pending, (state, action) => {
      state.status = 'loading';
      state.error = null;
      state.selectedBrand = null;
      state.items = [];
      state.requestId = action.meta.requestId;
    })
    .addCase(fetchManufacturers.fulfilled, (state, action) => {
      if (state.requestId !== action.meta.requestId) return;
      state.status = 'succeeded';
      state.items = action.payload;
      state.requestId = null;
    })
    .addCase(fetchManufacturers.rejected, (state, action) => {
      if (state.requestId !== action.meta.requestId) return;
      state.status = action.meta.aborted ? 'idle' : 'failed';
      state.error = action.meta.aborted ? null : action.payload || 'Не удалось загрузить производителей.';
      state.requestId = null;
    }),
});

export const { articleChanged, brandSelected } = manufacturersSlice.actions;
export default manufacturersSlice.reducer;
