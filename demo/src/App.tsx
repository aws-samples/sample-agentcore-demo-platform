import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './ThemeContext';
import Home from './pages/Home';
import Detail from './pages/Detail';
import Architecture from './pages/Architecture';

export default function App() {
  return (
    <ThemeProvider>
      <div className="grid-bg" />
      <div className="glow-overlay" />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/demo/:id" element={<Detail />} />
        <Route path="/architecture" element={<Architecture />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ThemeProvider>
  );
}
