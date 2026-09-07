import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/app.css';
import './styles/print.css';

const root = document.getElementById('app');
if (!root) throw new Error('#app が見つかりません');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
