import { Component, useState, useEffect } from 'react';
import DesktopApp from './components/DesktopApp';
import MobileApp from './components/mobile/MobileApp';
import './App.css';

// Error boundary: catch render crashes so the whole app doesn't go blank
class ErrorBoundary extends Component<{ children: React.ReactNode }, { error: string | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error: error.message || String(error) };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100%', background: 'var(--bg)', color: 'var(--fg)',
          fontFamily: 'var(--font)', padding: 32, textAlign: 'center',
        }}>
          <div>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>界面渲染异常</h2>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16, maxWidth: 420 }}>
              {this.state.error}
            </p>
            <button onClick={() => { this.setState({ error: null }); window.location.reload(); }}
              style={{
                padding: '8px 24px', borderRadius: 8, border: 'none',
                background: 'var(--accent)', color: '#fff', fontSize: 14,
                fontWeight: 600, cursor: 'pointer',
              }}>
              重新加载
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <ErrorBoundary>
      {isMobile ? <MobileApp /> : <DesktopApp />}
    </ErrorBoundary>
  );
}

export default App;
