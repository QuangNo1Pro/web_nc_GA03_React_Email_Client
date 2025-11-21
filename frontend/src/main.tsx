import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { Providers } from './Providers';

const container = document.getElementById('root');
if (!container) {
  console.error(
    'Root element not found: ensure index.html contains <div id="root"></div>',
  );
} else {
  createRoot(container).render(
    <Providers>
      <App />
    </Providers>,
  );
}