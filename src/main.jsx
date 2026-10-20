import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LazyMotion, MotionConfig } from 'motion/react';
import App from './App.jsx';
import { StoreProvider } from './store/StoreContext.jsx';
import { UIProvider } from './components/UIContext.jsx';
import './styles/index.css';

const loadMotionFeatures = () => import('./components/anim/motionFeatures.js').then((mod) => mod.default);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <LazyMotion features={loadMotionFeatures} strict>
        <StoreProvider>
          <UIProvider>
            <App />
          </UIProvider>
        </StoreProvider>
      </LazyMotion>
    </MotionConfig>
  </StrictMode>,
);
