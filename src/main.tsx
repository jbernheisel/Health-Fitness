import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { initStore } from './lib/store';

void initStore();
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

// Offline support: only registers on HTTPS (or localhost), as browsers require.
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost') && !navigator.webdriver) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('Service worker not registered', e));
  });
}
