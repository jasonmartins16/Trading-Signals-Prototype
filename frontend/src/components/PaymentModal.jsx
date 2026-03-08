export default function PaymentModal({ isOpen, onClose, userEmail, onSuccess }) {
  if (!isOpen) return null;

  const handleSimulatePayment = async () => {
    try {
      const token = localStorage.getItem('token');
      // Use the environment variable instead of localhost
      const apiUrl = import.meta.env.VITE_API_URL;

      // 1. Create Checkout Session
      const checkoutRes = await fetch(`${apiUrl}/billing/create-checkout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!checkoutRes.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { session_id } = await checkoutRes.json();

      // 2. Simulate Stripe Webhook Callback
      const webhookRes = await fetch(`${apiUrl}/billing/simulate-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'checkout.session.completed',
          data: {
            session_id: session_id
          }
        })
      });

      if (webhookRes.ok) {
        onSuccess();
      } else {
        alert('Payment simulation webhook failed');
      }
    } catch (err) {
      console.error(err);
      alert('Error simulating payment');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-slate-100 bg-slate-50">
          <h3 className="text-xl font-bold text-slate-800">Upgrade to Premium</h3>
          <p className="text-sm text-slate-500 mt-1">Get full access to all trading signals</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex justify-between items-center py-2 border-b border-slate-100">
            <span className="text-slate-600">Trading Signals Pro</span>
            <span className="font-semibold text-slate-800">₹499 / lifetime</span>
          </div>

          <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm leading-relaxed border border-blue-100">
            This is a mock checkout. Clicking "Simulate Payment" will fire a webhook to our backend, update your status, and instantly upgrade your account.
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3 justify-end items-center">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSimulatePayment}
            className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-lg shadow-md shadow-blue-500/20 transition-all hover:shadow-lg hover:shadow-blue-500/40"
          >
            Simulate Payment
          </button>
        </div>
      </div>
    </div>
  );
}
