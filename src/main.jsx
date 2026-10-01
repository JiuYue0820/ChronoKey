import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/controls.css';
import './styles/overlay.css';
import './styles/panes.css';
import './styles/screens.css';
import App from './App.jsx';

async function boot() {
  // 浏览器预览(非 Electron)时注入内存模拟 API,仅用于 UI 开发
  if (!window.ck) {
    const { installMock } = await import('./mock.js');
    installMock();
  }
  createRoot(document.getElementById('root')).render(<App />);
}

boot();
