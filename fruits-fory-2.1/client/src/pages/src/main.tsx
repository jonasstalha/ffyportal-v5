import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Archifage from './archifage.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Archifage />
  </StrictMode>
);
