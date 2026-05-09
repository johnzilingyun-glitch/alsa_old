import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { ErrorBoundary } from 'react-error-boundary';
import './i18n';
import App from './App.tsx';
import './index.css';

function fallbackRender({ error }: { error: any }) {
  return (
    <div role="alert" style={{ padding: 20 }}>
      <p>Something went wrong:</p>
      <pre style={{ color: "red", whiteSpace: 'pre-wrap' }}>{error.message}</pre>
      <pre style={{ fontSize: 12, marginTop: 10 }}>{error.stack}</pre>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fallbackRender={fallbackRender}>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
