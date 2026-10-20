import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AboutPage } from './ui/AboutPage.tsx';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AboutPage />
  </StrictMode>,
);
