import { configureStore } from '@reduxjs/toolkit';
import manufacturers from './manufacturersSlice.js';

export const store = configureStore({ reducer: { manufacturers } });
