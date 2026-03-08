import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { LogOut, TrendingUp, Lock, Crown, CheckCircle2 } from 'lucide-react';
import PaymentModal from './PaymentModal';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [signals, setSignals] = useState([]);
  const [isPremiumUnlocked, setIsPremiumUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [walletBalance, setWalletBalance] = useState(0);
  const [portfolio, setPortfolio] = useState([]);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [tradeMessage, setTradeMessage] = useState({ show: false, text: '', isError: false });
  const [quantities, setQuantities] = useState({});
  
  const navigate = useNavigate();

  const fetchDashboardData = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      const userRes = await axios.get(`${API_URL}/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(userRes.data.user);
      setWalletBalance(userRes.data.user.wallet_balance);
      setPortfolio(userRes.data.portfolio || []);

      const signalsRes = await axios.get(`${API_URL}/signals`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSignals(signalsRes.data.data);
      setIsPremiumUnlocked(signalsRes.data.is_premium_unlocked);
      
      setLoading(false);
    } catch (err) {
      console.error(err);
      localStorage.removeItem('token');
      navigate('/login');
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const handlePaymentSuccess = () => {
    setIsPaymentModalOpen(false);
    // Refresh data to show premium signals
    fetchDashboardData();
  };

  const handleQuantityChange = (signalId, val) => {
    setQuantities(prev => ({ ...prev, [signalId]: Number(val) }));
  };

  const executeTrade = async (signalId, action) => {
    const qty = quantities[signalId] || 1;
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_URL}/signals/${signalId}/trade`, 
        { action, quantity: qty },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setTradeMessage({ show: true, text: response.data.message, isError: false });
      setTimeout(() => setTradeMessage({ show: false, text: '', isError: false }), 3000);
      fetchDashboardData(); // Refresh wallet balance
    } catch (err) {
      setTradeMessage({ 
        show: true, 
        text: err.response?.data?.detail || 'Trade execution failed', 
        isError: true 
      });
      setTimeout(() => setTradeMessage({ show: false, text: '', isError: false }), 3000);
    }
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="w-full flex flex-col gap-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Dashboard</h2>
          <p className="text-slate-500">Logged in as <span className="font-medium text-slate-700">{user.email}</span></p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden md:flex flex-col items-end mr-4">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Wallet</span>
            <span className="text-lg font-black text-slate-800 tabular-nums leading-none mt-0.5">₹{walletBalance.toLocaleString('en-IN')}</span>
          </div>
          
          {user.is_paid ? (
            <div className="flex items-center gap-2 bg-amber-50 text-amber-700 px-4 py-2 rounded-full font-medium border border-amber-200">
              <Crown className="w-5 h-5" />
              Premium Active
            </div>
          ) : (
            <button 
              onClick={() => setIsPaymentModalOpen(true)}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-medium px-5 py-2 rounded-full shadow-md shadow-amber-500/20 transition-all flex items-center gap-2"
            >
              <Crown className="w-5 h-5" />
              Subscribe for ₹499
            </button>
          )}
          <button 
            onClick={handleLogout}
            className="text-slate-500 hover:text-slate-700 p-2 rounded-full hover:bg-slate-100 transition-colors"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {tradeMessage.show && (
        <div className={`fixed top-4 right-4 p-4 rounded-xl shadow-lg transform transition-all flex items-center gap-3 z-50 animate-in slide-in-from-right-8 ${
          tradeMessage.isError ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-green-50 border border-green-200 text-green-700'
        }`}>
          {tradeMessage.isError ? <TrendingUp className="w-5 h-5 rotate-180" /> : <CheckCircle2 className="w-5 h-5" />}
          <span className="font-medium text-sm">{tradeMessage.text}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-2">
          <TrendingUp className="text-blue-600 w-5 h-5" />
          <h3 className="text-lg font-bold text-slate-800">Latest Live Signals</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider">
                <th className="px-6 py-4 font-medium">Symbol</th>
                <th className="px-6 py-4 font-medium">Action</th>
                <th className="px-6 py-4 font-medium text-right">Live Price</th>
                <th className="px-6 py-4 font-medium text-right">Execute</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {signals.map((signal) => {
                const ownedQty = portfolio.find(p => p.symbol === signal.symbol)?.quantity || 0;
                const qty = quantities[signal.id] || 1;
                
                return (
                <tr key={signal.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-800">{signal.symbol}</div>
                    {ownedQty > 0 && <div className="text-xs font-bold text-blue-600 mt-0.5">Owned: {ownedQty}</div>}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      signal.action === 'BUY' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {signal.action}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="font-bold text-slate-800 tabular-nums">₹{signal.live_price.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                    <div className="text-xs text-slate-500 mt-0.5">T: {signal.target} | SL: {signal.stop_loss}</div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-medium text-slate-500">Qty:</label>
                        <input 
                          type="number" 
                          min="1" 
                          value={qty}
                          onChange={(e) => handleQuantityChange(signal.id, e.target.value)}
                          className="w-16 px-2 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => executeTrade(signal.id, 'BUY')}
                          className="px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 font-medium text-xs rounded-lg border border-green-200 transition-colors"
                        >
                          Buy
                        </button>
                        <button 
                          onClick={() => executeTrade(signal.id, 'SELL')}
                          disabled={ownedQty < qty}
                          className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 font-medium text-xs rounded-lg border border-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Sell
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>

        {!isPremiumUnlocked && (
          <div className="bg-slate-50/80 backdrop-blur-sm border-t border-slate-200 p-10 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
              <Lock className="w-8 h-8 text-slate-400" />
            </div>
            <h4 className="text-xl font-bold text-slate-800 mb-2">Unlock 8 More Signals</h4>
            <p className="text-slate-500 max-w-md mb-6">Free users can only see the first 2 signals. Upgrade to Premium to access our full daily list and start trading profitably.</p>
            <button 
              onClick={() => setIsPaymentModalOpen(true)}
              className="bg-slate-900 hover:bg-slate-800 text-white font-medium px-8 py-3 rounded-xl shadow-lg transition-all"
            >
              Subscribe Now
            </button>
          </div>
        )}
        
        {isPremiumUnlocked && (
          <div className="bg-green-50 border-t border-green-100 p-4 flex items-center justify-center gap-2 text-green-700 text-sm font-medium">
            <CheckCircle2 className="w-5 h-5" />
            Showing all 10 premium signals
          </div>
        )}
      </div>

      <PaymentModal 
        isOpen={isPaymentModalOpen} 
        onClose={() => setIsPaymentModalOpen(false)} 
        userEmail={user.email}
        onSuccess={handlePaymentSuccess} 
      />
    </div>
  );
}
