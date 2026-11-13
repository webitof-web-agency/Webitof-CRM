import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { beginLoadingPhase } from './lib/loadingProgress';

// The first screen (session check, settings, the page itself) is one load, continuing the boot loader.
beginLoadingPhase({ initialPercent: Number(window.__webitofBootPercent || 0) });

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
