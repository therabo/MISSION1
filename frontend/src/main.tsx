import { createRoot } from 'react-dom/client';
import { Credit, CreditDisplay } from 'cesium';
import App from './App';
import './styles.css';

// Direct NASA/local content needs no ion logo; retain all provider credits.
// See docs/frontend/cesium-attribution-audit/README.md before changing providers.
CreditDisplay.cesiumCredit = new Credit('');

const container = document.getElementById('root');
if (!container) throw new Error('Application root is missing');
createRoot(container).render(<App />);
