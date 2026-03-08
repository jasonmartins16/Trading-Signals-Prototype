import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Wallet, LogOut, ArrowUpRight, ArrowDownRight, Clock, ShieldCheck, Briefcase } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [topupAmount, setTopupAmount] = useState(10000);
  const [isTopupLoading, setIsTopupLoading] = useState(false);
  const [tradeMessage, setTradeMessage] = useState({ show: false, text: '', isError: false });
  
  const navigate = useNavigate();

  const fetchProfileData = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      const profileRes = await axios.get(`${API_URL}/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProfile(profileRes.data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      if (err.response && err.response.status === 401) {
        localStorage.removeItem('token');
        navigate('/login');
      }
    }
  };

  useEffect(() => {
    fetchProfileData();
  }, [navigate]);

  const handleTopup = async () => {
    setIsTopupLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_URL}/wallet/topup`, 
        { amount: Number(topupAmount) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setTopupAmount(10000); // reset
      setTradeMessage({ show: true, text: `Successfully added ₹${topupAmount} to wallet!`, isError: false });
      setTimeout(() => setTradeMessage({ show: false, text: '', isError: false }), 3000);
      fetchProfileData(); // refresh
    } catch (err) {
      setTradeMessage({ show: true, text: 'Top up failed', isError: true });
      setTimeout(() => setTradeMessage({ show: false, text: '', isError: false }), 3000);
    } finally {
      setIsTopupLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="w-full flex flex-col gap-6 max-w-4xl mx-auto">
      
      {tradeMessage.show && (
        <div className={`fixed top-4 right-4 p-4 rounded-xl shadow-lg transform transition-all flex items-center gap-3 z-50 animate-in slide-in-from-right-8 ${
          tradeMessage.isError ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-green-50 border border-green-200 text-green-700'
        }`}>
          <span className="font-medium text-sm">{tradeMessage.text}</span>
        </div>
      )}

      {/* Header Profile Card */}
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-2xl">
            {profile.user.email.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">My Profile</h2>
            <p className="text-slate-500">{profile.user.email}</p>
            <div className="mt-2 flex items-center gap-2">
               {profile.user.is_paid ? (
                 <span className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200"><ShieldCheck className="w-3 h-3"/> Premium Plan</span>
               ) : (
                 <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded border border-slate-200">Free Plan</span>
               )}
            </div>
          </div>
        </div>
        
        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-700 px-4 py-2 rounded-xl hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>

      {/* Wallet Section */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-lg overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="p-8 relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
          
          <div className="text-white w-full md:w-auto">
            <div className="flex items-center gap-2 text-slate-400 mb-2">
              <Wallet className="w-5 h-5" />
              <span className="font-medium uppercase tracking-wider text-sm">Trading Wallet balance</span>
            </div>
            <div className="text-5xl font-black tabular-nums tracking-tight">
              ₹{profile.user.wallet_balance.toLocaleString('en-IN')}
            </div>
          </div>

          <div className="bg-white/10 p-6 rounded-xl backdrop-blur-md border border-white/20 w-full md:w-auto flex flex-col gap-3 shrink-0">
            <label className="text-white/80 text-sm font-medium">Quick Top-Up</label>
            <div className="flex gap-2">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">₹</span>
                <input 
                  type="number" 
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                  className="pl-8 pr-4 py-2.5 w-32 rounded-lg bg-white border-0 text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                  min="100"
                />
              </div>
              <button 
                onClick={handleTopup}
                disabled={isTopupLoading || topupAmount < 100}
                className="px-6 py-2.5 bg-blue-500 hover:bg-blue-400 text-white font-bold rounded-lg transition-colors disabled:opacity-50"
              >
                {isTopupLoading ? 'Processing...' : 'Add Funds'}
              </button>
            </div>
          </div>

        </div>
      </div>
      
      {/* Portfolio Section */}
      {profile.portfolio && profile.portfolio.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Briefcase className="text-blue-600 w-5 h-5" />
              <h3 className="text-lg font-bold text-slate-800">My Portfolio Assets</h3>
            </div>
            <span className="text-sm text-slate-500 font-medium bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
              {profile.portfolio.length} Assets
            </span>
          </div>
          
          <div className="p-6 pt-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {profile.portfolio.map((item) => (
                <div key={item.id} className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-3 text-lg font-bold text-slate-700 border border-slate-100">
                    {item.symbol.charAt(0)}
                  </div>
                  <h4 className="font-bold text-slate-800">{item.symbol}</h4>
                  <div className="mt-1 text-sm font-medium text-slate-500">
                    Owned: <span className="text-blue-600 font-bold">{item.quantity}</span> Units
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Trade History Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="text-blue-600 w-5 h-5" />
            <h3 className="text-lg font-bold text-slate-800">Trade History</h3>
          </div>
          <span className="text-sm text-slate-500 font-medium bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
            {profile.trades.length} Total Trades
          </span>
        </div>
        
        {profile.trades.length === 0 ? (
          <div className="p-10 text-center text-slate-500 flex flex-col items-center">
             <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-3">
               <ArrowUpRight className="w-6 h-6 text-slate-300" />
             </div>
             <p className="font-medium">No trades executed yet.</p>
             <p className="text-sm mt-1">Go to the Dashboard and buy/sell some signals!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider">
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium">Symbol</th>
                  <th className="px-6 py-4 font-medium">Action</th>
                  <th className="px-6 py-4 font-medium text-right">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {profile.trades.map((trade) => {
                  const isBuy = trade.action === 'BUY';
                  const tradeDate = new Date(trade.timestamp).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  });
                  
                  return (
                    <tr key={trade.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-slate-500 text-sm">{tradeDate}</td>
                      <td className="px-6 py-4 font-bold text-slate-800">{trade.symbol}</td>
                      <td className="px-6 py-4">
                        <span className={`flex w-fit items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold ${
                          isBuy ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {isBuy ? <ArrowDownRight className="w-3 h-3"/> : <ArrowUpRight className="w-3 h-3"/>}
                          {trade.action}
                        </span>
                      </td>
                      <td className={`px-6 py-4 text-right font-bold tabular-nums ${isBuy ? 'text-slate-800' : 'text-green-600'}`}>
                        {isBuy ? '-' : '+'}₹{(trade.price * trade.quantity).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
