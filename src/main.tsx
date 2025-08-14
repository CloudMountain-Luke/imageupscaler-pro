import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { AuthProvider } from './contexts/AuthContext';
import { ImageProcessingProvider } from './contexts/ImageProcessingContext';
import ErrorBoundary from './components/ErrorBoundary';
import { logAsyncErrors } from './dev/logAsyncErrors';

// Log async errors in development
if (import.meta.env.DEV) {
  logAsyncErrors();
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <ImageProcessingProvider>
          <App />
        </ImageProcessingProvider>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);