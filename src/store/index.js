import { configureStore } from '@reduxjs/toolkit';
import manufacturers from './manufacturersSlice.js';
import offers from './offersSlice.js';

export const store = configureStore({ reducer: { manufacturers, offers } });
