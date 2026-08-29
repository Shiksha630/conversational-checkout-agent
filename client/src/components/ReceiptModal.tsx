import React from 'react';
import { CheckCircle2, Download, X, Shield, Bell, ArrowRight } from 'lucide-react';
import { User } from '../types';

interface ReceiptModalProps {
  receiptData: {
    paymentId: string;
    orderId: string;
    status: string;
    proposal?: any;
  } | null;
  currentUser: User | null;
  onClose: () => void;
  onSetReminder: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  receiptData,
  currentUser,
  onClose,
  onSetReminder,
}) => {
  if (!receiptData) return null;

  const { paymentId, orderId, proposal } = receiptData;
  const amount = proposal?.amount || 399;
  const description = proposal?.description || 'Conversational Checkout Payment';
  const method = proposal?.method || 'UPI';

  const handleDownload = () => {
    const textContent = `===========================================
RAZORPAY CONVERSATIONAL CHECKOUT RECEIPT
===========================================
Status: PAYMENT CAPTURED
Payment ID: ${paymentId}
Order ID: ${orderId}
Amount: INR ${amount}.00
Date: ${new Date().toLocaleString()}
Customer: ${currentUser?.name || 'Customer'} (${currentUser?.phone || '+91 9876543210'})
Description: ${description}
Payment Route: ${method}
===========================================
Thank you for using Razorpay Agentic Commerce!`;

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `receipt_${paymentId}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="bg-gradient-to-r from-rzp-blue to-slate-900 p-5 border-b border-slate-800 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Payment Confirmed</h3>
              <p className="text-xs text-slate-400">Razorpay Gateway Test Mode</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Receipt Content */}
        <div className="p-6 space-y-4">
          <div className="text-center py-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Amount Paid</span>
            <div className="text-3xl font-extrabold text-emerald-400 mt-1">₹{amount}</div>
            <p className="text-xs text-slate-400 mt-0.5">{description}</p>
          </div>

          <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800/80 space-y-2.5 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-slate-500 font-sans">Payment ID:</span>
              <span className="text-slate-200 font-bold">{paymentId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-sans">Order ID:</span>
              <span className="text-slate-300">{orderId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-sans">Customer:</span>
              <span className="text-slate-300">{currentUser?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-sans">Payment Route:</span>
              <span className="text-rzp-accent">{method}</span>
            </div>
            <div className="flex justify-between border-t border-slate-800/80 pt-2 font-sans">
              <span className="text-slate-500">Security:</span>
              <span className="text-emerald-400 flex items-center gap-1">
                <Shield className="w-3 h-3" /> Razorpay Verified
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2.5 pt-2">
            <button
              onClick={() => {
                onClose();
                onSetReminder();
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 font-semibold rounded-xl text-xs border border-purple-500/30 transition"
            >
              <Bell className="w-4 h-4 text-purple-400" />
              <span>Set Proactive Renewal Reminder</span>
            </button>

            <button
              onClick={handleDownload}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs border border-slate-700 transition"
            >
              <Download className="w-4 h-4" />
              <span>Download Digital Receipt</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
