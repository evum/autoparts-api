import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { articleChanged, brandSelected, fetchManufacturers } from './manufacturersSlice.js';

export const fetchOffers = createAsyncThunk(
  'offers/fetch',
  async ({ number, brand }, { signal, rejectWithValue }) => {
    try {
      const query = new URLSearchParams({ number, brand });
      const response = await fetch(`/api/offers?${query}`, { signal });
      const payload = await response.json();
      if (!response.ok) return rejectWithValue(payload.error || 'Не удалось загрузить предложения.');
      if (!Array.isArray(payload.offers)) throw new Error('Invalid response');
      return payload.offers;
    } catch (error) {
      if (signal.aborted) throw error;
      return rejectWithValue('Не удалось загрузить предложения. Проверьте подключение и повторите запрос.');
    }
  },
);

const initialState = { items: [], status: 'idle', error: null, requestId: null };

const offersSlice = createSlice({
  name: 'offers',
  initialState,
  reducers: {},
  extraReducers: (builder) => builder
    .addCase(articleChanged, () => initialState)
    .addCase(brandSelected, () => initialState)
    .addCase(fetchManufacturers.pending, () => initialState)
    .addCase(fetchOffers.pending, (state, action) => {
      state.status = 'loading';
      state.error = null;
      state.items = [];
      state.requestId = action.meta.requestId;
    })
    .addCase(fetchOffers.fulfilled, (state, action) => {
      if (state.requestId !== action.meta.requestId) return;
      state.status = 'succeeded';
      state.items = action.payload;
      state.requestId = null;
    })
    .addCase(fetchOffers.rejected, (state, action) => {
      if (state.requestId !== action.meta.requestId) return;
      state.status = action.meta.aborted ? 'idle' : 'failed';
      state.error = action.meta.aborted ? null : action.payload || 'Не удалось загрузить предложения.';
      state.requestId = null;
    }),
});

export default offersSlice.reducer;
