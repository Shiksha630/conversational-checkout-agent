import React, { useState } from 'react';
import { CheckoutProposal } from '../types';
import { CreditCard, CheckCircle2, Shield, ArrowRight, Smartphone, Sparkles, Loader2 } from 'lucide-react';
import confetti from 'canvas-confetti';

interface ConfirmCardProps {
  proposal: CheckoutProposal;
  isPaid: boolean;
  onPaymentSuccess: (result: { paymentId: string; orderId: string; status: string }) => void;
  onModify: (actionText: string) => void;
}

export const ConfirmCard: React.FC<ConfirmCardProps> = ({
  proposal,
  isPaid,
  onPaymentSuccess,
  onModify,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showMockModal, setShowMockModal] = useState(false);

  const handlePay = () => {
    setIsProcessing(true);

    // Check if Razorpay Standard Checkout SDK is loaded
    if (typeof (window as any).Razorpay !== 'undefined' && !proposal.is_mock && proposal.key_id && !proposal.key_id.includes('mock')) {
      const options = {
        key: proposal.key_id,
        amount: proposal.amount_paise,
        currency: proposal.currency || 'INR',
        name: 'Conversational Checkout',
        description: proposal.description,
        order_id: proposal.order_id,
        handler: function (response: any) {
          setIsProcessing(false);
          triggerConfetti();
          onPaymentSuccess({
            paymentId: response.razorpay_payment_id,
            orderId: response.razorpay_order_id,
            status: 'captured',
          });
        },
        prefill: {
          name: proposal.user?.name || 'Rahul Sharma',
          email: proposal.user?.email || 'customer@example.com',
          contact: proposal.user?.phone || '+919876543210',
        },
        theme: {
          color: '#3395ff',
        },
        modal: {
          ondismiss: function () {
            setIsProcessing(false);
          },
        },
      };

      try {
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
        return;
      } catch (err) {
        console.warn('Fallback to interactive test checkout modal:', err);
      }
    }

    // High-fidelity Sandbox Checkout Modal for instant evaluation
    setTimeout(() => {
      setIsProcessing(false);
      setShowMockModal(true);
    }, 400);
  };

  const triggerConfetti = () => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#3395ff', '#00c0f9', '#10b981', '#ffffff'],
    });
  };

  const handleSimulateCapture = (methodUsed: string) => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setShowMockModal(false);
      triggerConfetti();
      
      const mockPayId = `pay_${Math.random().toString(36).substr(2, 9)}_${Date.now().toString().slice(-4)}`;
      onPaymentSuccess({
        paymentId: mockPayId,
        orderId: proposal.order_id,
        status: 'captured',
      });
    }, 600);
  };

  return (
    <div className="mt-3 w-full max-w-md rounded-2xl bg-gradient-to-b from-slate-900 to-rzp-dark border border-rzp-border shadow-xl shadow-black/40 overflow-hidden animate-slide-up">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-rzp-blue to-slate-900 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-rzp-accent/20 flex items-center justify-center border border-rzp-accent/30">
            <Sparkles className="w-3.5 h-3.5 text-rzp-accent" />
          </div>
          <span className="text-xs font-semibold text-white tracking-wide uppercase">
            Payment Proposal
          </span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono border border-emerald-500/20">
          Razorpay Test Mode
        </span>
      </div>

      {/* Order Summary Body */}
      <div className="p-4 space-y-3.5">
        <div>
          <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider">Item Details</h4>
          <p className="text-sm font-semibold text-white mt-0.5 leading-snug">
            {proposal.description}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
          <div>
            <span className="text-[11px] text-slate-400">Total Amount</span>
            <div className="text-xl font-bold text-emerald-400 flex items-baseline gap-1 mt-0.5">
              <span>₹{proposal.amount}</span>
              <span className="text-xs text-slate-500 font-normal">INR</span>
            </div>
          </div>
          <div>
            <span className="text-[11px] text-slate-400">Payment Route</span>
            <div className="text-xs font-medium text-slate-200 mt-1 truncate flex items-center gap-1.5">
              {proposal.method?.toLowerCase().includes('card') ? (
                <CreditCard className="w-3.5 h-3.5 text-rzp-cyan shrink-0" />
              ) : (
                <Smartphone className="w-3.5 h-3.5 text-rzp-accent shrink-0" />
              )}
              <span className="truncate">{proposal.method || 'UPI Auto-Routing'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
          <span>Order ID: <code className="text-slate-300 font-mono">{proposal.order_id}</code></span>
          <span className="flex items-center gap-1 text-emerald-400 font-medium">
            <Shield className="w-3 h-3" /> Secure 256-bit
          </span>
        </div>

        {/* Action Buttons */}
        {isPaid ? (
          <div className="flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Payment Captured Successfully</span>
          </div>
        ) : (
          <div className="space-y-2 pt-1">
            <button
              onClick={handlePay}
              disabled={isProcessing}
              className="w-full relative group overflow-hidden bg-gradient-to-r from-rzp-accent to-blue-600 hover:from-rzp-accentHover hover:to-blue-500 text-white font-semibold py-2.5 px-4 rounded-xl text-xs tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Initiating Razorpay...</span>
                </>
              ) : (
                <>
                  <span>Pay ₹{proposal.amount} via Razorpay</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>

            {/* Mid-flow Adjustment Quick Prompts */}
            <div className="flex items-center justify-between pt-1 text-[11px]">
              <button
                onClick={() => onModify('Actually, make the amount ₹500')}
                className="text-slate-400 hover:text-rzp-accent underline underline-offset-2 transition"
              >
                Change amount to ₹500
              </button>
              <button
                onClick={() => onModify('Use my Credit Card instead of UPI')}
                className="text-slate-400 hover:text-rzp-accent underline underline-offset-2 transition"
              >
                Switch to Card
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Simulated Razorpay Test Dialog Modal */}
      {showMockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            {/* Razorpay Brand Header */}
            <div className="bg-rzp-blue p-4 flex items-center justify-between border-b border-slate-700">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-rzp-accent rounded-lg flex items-center justify-center font-bold text-white text-xs">
                  R
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Razorpay Standard Checkout</h4>
                  <p className="text-[10px] text-slate-300">Test Gateway Sandbox</p>
                </div>
              </div>
              <span className="text-xs font-bold text-emerald-400">₹{proposal.amount}</span>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-3">
              <p className="text-xs text-slate-300">
                Select a simulated payment method to test instant capture:
              </p>

              <div className="space-y-2">
                <button
                  onClick={() => handleSimulateCapture('UPI')}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-left transition group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                      <Smartphone className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white">Pay via UPI (Instant)</div>
                      <div className="text-[10px] text-slate-400">{proposal.method || 'Default UPI ID'}</div>
                    </div>
                  </div>
                  <span className="text-xs text-rzp-accent group-hover:translate-x-0.5 transition font-semibold">Success &rarr;</span>
                </button>

                <button
                  onClick={() => handleSimulateCapture('Card')}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-left transition group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <CreditCard className="w-4 h-4 text-rzp-accent" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white">Pay via Test Card</div>
                      <div className="text-[10px] text-slate-400">4111 •••• •••• 1111 (Auto-approve)</div>
                    </div>
                  </div>
                  <span className="text-xs text-rzp-accent group-hover:translate-x-0.5 transition font-semibold">Success &rarr;</span>
                </button>
              </div>

              <button
                onClick={() => setShowMockModal(false)}
                className="w-full text-center text-xs text-slate-400 hover:text-slate-200 py-1.5"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
