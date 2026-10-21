import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import { beforeSend } from './analytics.ts';
import { AboutPage } from './ui/AboutPage.tsx';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AboutPage />
    {/* Production only: in dev the package fetches a debug script from Vercel's CDN, e2e included. */}
    {import.meta.env.PROD && <Analytics beforeSend={beforeSend} />}
  </StrictMode>,
);
