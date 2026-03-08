import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import AuthForm from './components/AuthForm';
import Dashboard from './components/Dashboard';
import Profile from './components/Profile';

function HeaderNavigation() {
  const location = useLocation();
  const showNav = ['/dashboard', '/profile'].includes(location.pathname);

  if (!showNav) return null;

  return (
    <nav className="flex items-center gap-6 text-sm font-medium">
      <Link 
        to="/dashboard" 
        className={`${location.pathname === '/dashboard' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-800'} py-2 transition-colors`}
      >
        Dashboard
      </Link>
      <Link 
        to="/profile" 
        className={`${location.pathname === '/profile' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-800'} py-2 transition-colors`}
      >
        My Profile
      </Link>
    </nav>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="bg-white border-b border-slate-200 px-6 py-3 sticky top-0 z-40">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mr-8">
              TradingSignals Pro
            </h1>
            <HeaderNavigation />
          </div>
        </header>
        
        <main className="flex-1 flex flex-col relative w-full h-full max-w-6xl mx-auto py-8 px-6">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<AuthForm type="login" />} />
            <Route path="/signup" element={<AuthForm type="signup" />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>

        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
