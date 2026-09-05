import React, { useState } from 'react';
import {
  Utensils, Star, MapPin, Clock, Truck, CheckCircle2,
  Shield, ArrowRight, Loader2, CreditCard, Smartphone,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export interface FoodOrderData {
  restaurantId: string;
  restaurantName: string;
  restaurantCuisine: string;
  restaurantRating: number;
  restaurantAddress: string;
  itemId: string;
  itemName: string;
  itemDescription: string;
  itemPrice: number;
  deliveryFee: number;
  totalAmount: number;
  etaMinutes: number;
  razorpayOrderId: string;
  razorpayAmountPaise: number;
  razorpayKeyId: string;
  paymentMethod: string;
  isMock: boolean;
  foodOrderId: string;
  user?: { name?: string; email?: string; phone?: string };
}

interface FoodOrderCardProps {
  data: FoodOrderData;
  isPaid: boolean;
  onPaymentSuccess: (result: { paymentId: string; orderId: string; status: string }) => void;
  onModify: (text: string) => void;
}

const TRACKING_STEPS = ['CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED'];
const stepLabel: Record<string, string> = {
  CONFIRMED: '✅ Order Confirmed',
  PREPARING: '👨‍🍳 Preparing your food',
  OUT_FOR_DELIVERY: '🛵 Out for Delivery',
  DELIVERED: '🎉 Delivered!',
};

export const FoodOrderCard: React.FC<FoodOrderCardProps> = ({ data, isPaid, onPaymentSuccess, onModify }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showMockModal, setShowMockModal] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [trackingStatus, setTrackingStatus] = useState('CONFIRMED');

  const triggerConfetti = () => {
    confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 }, colors: ['#f97316', '#10b981', '#facc15', '#ffffff'] });
  };

  const simulateTracking = () => {
    let i = 0;
    const tick = () => { if (i < TRACKING_STEPS.length) { setTrackingStatus(TRACKING_STEPS[i]); i++; setTimeout(tick, 3000); } };
    tick();
  };

  const handlePay = () => {
    setIsProcessing(true);
    if (typeof (window as any).Razorpay !== 'undefined' && !data.isMock && data.razorpayKeyId && !data.razorpayKeyId.includes('mock')) {
      try {
        const rzp = new (window as any).Razorpay({
          key: data.razorpayKeyId, amount: data.razorpayAmountPaise, currency: 'INR',
          name: data.restaurantName, description: `${data.itemName} from ${data.restaurantName}`,
          order_id: data.razorpayOrderId,
          handler: (response: any) => { setIsProcessing(false); triggerConfetti(); setOrderPlaced(true); simulateTracking(); onPaymentSuccess({ paymentId: response.razorpay_payment_id, orderId: response.razorpay_order_id, status: 'captured' }); },
          prefill: { name: data.user?.name || 'Customer', email: data.user?.email || 'customer@example.com', contact: data.user?.phone || '+919876543210' },
          theme: { color: '#f97316' }, modal: { ondismiss: () => setIsProcessing(false) },
        });
        rzp.open(); return;
      } catch (_) {}
    }
    setTimeout(() => { setIsProcessing(false); setShowMockModal(true); }, 400);
  };

  const handleSimulateCapture = (_method: string) => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false); setShowMockModal(false); triggerConfetti(); setOrderPlaced(true); simulateTracking();
      onPaymentSuccess({ paymentId: `pay_food_${Math.random().toString(36).substr(2, 9)}`, orderId: data.razorpayOrderId, status: 'captured' });
    }, 700);
  };

  return (
    <div className="mt-3 w-full max-w-md rounded-2xl bg-gradient-to-b from-slate-900 to-rzp-dark border border-orange-500/30 shadow-xl shadow-orange-500/10 overflow-hidden animate-slide-up">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600/80 to-slate-900 px-4 py-3 border-b border-orange-500/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-orange-500/20 flex items-center justify-center border border-orange-500/30">
            <Utensils className="w-3.5 h-3.5 text-orange-400" />
          </div>
          <span className="text-xs font-semibold text-white tracking-wide uppercase">Food Order</span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono border border-emerald-500/20">Razorpay Test Mode</span>
      </div>

      <div className="p-4 space-y-3.5">
        {/* Restaurant */}
        <div className="flex items-start gap-3 bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
          <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center border border-orange-500/30 shrink-0">
            <Utensils className="w-5 h-5 text-orange-400" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-white">{data.restaurantName}</div>
            <div className="text-[11px] text-slate-400">{data.restaurantCuisine}</div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="flex items-center gap-0.5 text-[11px] text-yellow-400"><Star className="w-3 h-3 fill-yellow-400" /> {data.restaurantRating}</span>
              <span className="flex items-center gap-0.5 text-[11px] text-slate-400 truncate"><MapPin className="w-3 h-3 shrink-0" /> {data.restaurantAddress}</span>
            </div>
          </div>
        </div>

        {/* Item */}
        <div>
          <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Your Order</h4>
          <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80">
            <div className="text-sm font-semibold text-white">{data.itemName}</div>
            {data.itemDescription && <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">{data.itemDescription}</div>}
          </div>
        </div>

        {/* Pricing */}
        <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80 space-y-1.5">
          <div className="flex justify-between text-xs text-slate-300"><span>Item price</span><span>₹{data.itemPrice}</span></div>
          <div className="flex justify-between text-xs text-slate-300">
            <span className="flex items-center gap-1"><Truck className="w-3 h-3 text-slate-500" /> Delivery fee</span>
            <span>₹{data.deliveryFee}</span>
          </div>
          <div className="border-t border-slate-700 pt-1.5 flex justify-between">
            <span className="text-xs font-semibold text-white">Total</span>
            <span className="text-lg font-bold text-emerald-400">₹{data.totalAmount}</span>
          </div>
        </div>

        {/* ETA */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> ~{data.etaMinutes} mins estimated delivery</span>
          <span className="flex items-center gap-1 text-emerald-400 font-medium"><Shield className="w-3 h-3" /> Secure</span>
        </div>

        {/* Tracking (post-payment) */}
        {orderPlaced && (
          <div className="bg-slate-800/50 rounded-xl p-3 border border-orange-500/20 space-y-2 animate-fade-in">
            <div className="text-[11px] font-semibold text-orange-400 uppercase tracking-wider">Live Order Tracking</div>
            <div className="flex items-center gap-1.5">
              {TRACKING_STEPS.map((step, idx) => {
                const currentIdx = TRACKING_STEPS.indexOf(trackingStatus);
                const done = idx <= currentIdx;
                return (
                  <React.Fragment key={step}>
                    <div className={`w-2.5 h-2.5 rounded-full border-2 transition-all duration-700 ${done ? 'bg-orange-500 border-orange-500' : 'bg-slate-700 border-slate-600'}`} />
                    {idx < TRACKING_STEPS.length - 1 && <div className={`flex-1 h-0.5 transition-all duration-700 ${done && idx < currentIdx ? 'bg-orange-500' : 'bg-slate-700'}`} />}
                  </React.Fragment>
                );
              })}
            </div>
            <div className="text-xs text-white font-medium">{stepLabel[trackingStatus]}</div>
            <div className="text-[10px] font-mono text-slate-400">Order ID: {data.foodOrderId}</div>
          </div>
        )}

        {/* Pay / Paid */}
        {(isPaid || orderPlaced) ? (
          <div className="flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4" /><span>Payment Captured — Enjoy your meal! 🍽️</span>
          </div>
        ) : (
          <div className="space-y-2 pt-1">
            <button onClick={handlePay} disabled={isProcessing}
              className="w-full relative group overflow-hidden bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white font-semibold py-2.5 px-4 rounded-xl text-xs tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 transition-all active:scale-[0.98] disabled:opacity-50">
              {isProcessing ? (<><Loader2 className="w-4 h-4 animate-spin" /><span>Initiating Razorpay...</span></>) : (<><span>Pay ₹{data.totalAmount} &amp; Place Order</span><ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" /></>)}
            </button>
            <button onClick={() => onModify('Cancel this food order')} className="w-full text-center text-[11px] text-slate-400 hover:text-slate-200 py-1 transition">Cancel</button>
          </div>
        )}
      </div>

      {/* Razorpay Mock Modal */}
      {showMockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="bg-orange-600/90 p-4 flex items-center justify-between border-b border-slate-700">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center font-bold text-white text-xs">R</div>
                <div><h4 className="text-xs font-bold text-white">Razorpay Checkout</h4><p className="text-[10px] text-orange-100">Food Order · Test Mode</p></div>
              </div>
              <span className="text-xs font-bold text-white">₹{data.totalAmount}</span>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-slate-300">{data.itemName} from {data.restaurantName}</p>
              <div className="space-y-2">
                <button onClick={() => handleSimulateCapture('UPI')} className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-left transition group">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center"><Smartphone className="w-4 h-4 text-emerald-400" /></div>
                    <div><div className="text-xs font-semibold text-white">Pay via UPI</div><div className="text-[10px] text-slate-400">{data.paymentMethod || 'Auto-routing'}</div></div>
                  </div>
                  <span className="text-xs text-orange-400 font-semibold group-hover:translate-x-0.5 transition">Pay →</span>
                </button>
                <button onClick={() => handleSimulateCapture('Card')} className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-left transition group">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center"><CreditCard className="w-4 h-4 text-blue-400" /></div>
                    <div><div className="text-xs font-semibold text-white">Test Card</div><div className="text-[10px] text-slate-400">4111 •••• •••• 1111</div></div>
                  </div>
                  <span className="text-xs text-orange-400 font-semibold group-hover:translate-x-0.5 transition">Pay →</span>
                </button>
              </div>
              <button onClick={() => setShowMockModal(false)} className="w-full text-center text-xs text-slate-400 hover:text-slate-200 py-1.5">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
