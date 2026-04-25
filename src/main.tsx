import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import './core/i18n'
import './index.css'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'

// Register the PWA service worker automatically
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <Suspense fallback={<div className="agro-bg min-h-screen" />}>
          <App />
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
)
