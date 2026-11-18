import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { LocationProvider } from './context/LocationContext.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  try {
    registerSW({
      immediate: true,
      onRegisterError(error) {
        console.warn('PWA service worker registration warning:', error);
      },
    });
  } catch {}
}

// Remoção suave da tela inicial de carregamento nativa
const removeInitialLoader = () => {
  const loader = document.getElementById('app-initial-loader');
  if (loader) {
    loader.style.transition = 'opacity 0.3s ease';
    loader.style.opacity = '0';
    loader.style.pointerEvents = 'none';
    setTimeout(() => {
      try {
        if (loader.parentNode) {
          loader.parentNode.removeChild(loader);
        }
      } catch {}
    }, 300);
  }
};

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <AuthProvider>
          <LocationProvider>
            <App />
          </LocationProvider>
        </AuthProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
  // Garante a remoção da tela de carregamento após a renderização
  requestAnimationFrame(removeInitialLoader);
}

