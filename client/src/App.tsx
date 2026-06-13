import { useState, useEffect } from 'react';
import DesktopApp from './components/DesktopApp';
import MobileApp from './components/mobile/MobileApp';
import './App.css';
import './mobile.css';

function App() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return isMobile ? <MobileApp /> : <DesktopApp />;
}

export default App;
