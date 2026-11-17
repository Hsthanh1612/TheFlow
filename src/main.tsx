import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import './styles/app.css';
import { App } from './App';
import { AuthProvider } from './state/auth';
import { ToastProvider } from './state/toast';

// HashRouter: GitHub Pages không có rewrite phía máy chủ nên không dùng đường dẫn lịch sử.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <AuthProvider>
        <HashRouter>
          <App />
        </HashRouter>
      </AuthProvider>
    </ToastProvider>
  </StrictMode>,
);
