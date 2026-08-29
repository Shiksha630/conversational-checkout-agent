import React from 'react';
import { User, PurchaseHistoryItem, Transaction, Reminder } from '../types';
import { X, Layers, CreditCard, History, Bell, Calendar, CheckCircle2, Clock } from 'lucide-react';

interface PersonaDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  history: PurchaseHistoryItem[];
  transactions: Transaction[];
  reminders: Reminder[];
}

export const PersonaDrawer: React.FC<PersonaDrawerProps> = ({
  isOpen,
  onClose,
  user,
  history,
  transactions,
  reminders,
}) => {
  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-y-0 left-0 z-40 w-full max-w-md bg-slate-950 border-r border-slate-800 shadow-2xl flex flex-col animate-slide-up">
      {/* Header */}
      <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src={user.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=60'}
            alt={user.name}
            className="w-10 h-10 rounded-full object-cover border border-rzp-accent/40"
          />
          <div>
            <h3 className="text-sm font-bold text-white">{user.name}</h3>
            <p className="text-[11px] text-slate-400">{user.phone} • {user.email}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Preferred Route */}
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
            Preferred Payment Route
          </span>
          <div className="flex items-center gap-2 mt-1 text-xs font-semibold text-rzp-cyan">
            <CreditCard className="w-4 h-4 text-rzp-accent" />
            <span>{user.preferred_payment_method}</span>
          </div>
        </div>

        {/* Purchase History (Baseline Context) */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <History className="w-4 h-4 text-rzp-accent" />
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Purchase History (Context)
            </h4>
          </div>
          <div className="space-y-2">
            {history.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs space-y-1"
              >
                <div className="flex justify-between items-start gap-2">
                  <span className="font-semibold text-slate-200">{item.description}</span>
                  <span className="font-bold text-emerald-400 shrink-0">₹{item.amount}</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span className="capitalize px-1.5 py-0.2 bg-slate-800 rounded text-[10px] text-slate-400">
                    {item.type}
                  </span>
                  <span>{new Date(item.date).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Transactions Log */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Executed Transactions ({transactions.length})
            </h4>
          </div>
          <div className="space-y-2">
            {transactions.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-3 bg-slate-900/50 rounded-xl border border-slate-800">
                No checkout transactions executed yet in this session.
              </p>
            ) : (
              transactions.map((txn) => (
                <div
                  key={txn.id}
                  className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-xs space-y-1"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-emerald-400">₹{txn.amount}</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold">
                      {txn.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">{txn.description || 'Order Checkout'}</div>
                  <div className="text-[10px] text-slate-500 font-mono flex justify-between pt-1">
                    <span>Order: {txn.razorpay_order_id}</span>
                    <span>{new Date(txn.created_at).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Proactive Reminders */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Bell className="w-4 h-4 text-purple-400" />
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Scheduled Reminders ({reminders.length})
            </h4>
          </div>
          <div className="space-y-2">
            {reminders.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-3 bg-slate-900/50 rounded-xl border border-slate-800">
                No reminders scheduled yet.
              </p>
            ) : (
              reminders.map((rem) => (
                <div
                  key={rem.id}
                  className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/20 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between text-purple-300 font-semibold">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> {rem.remind_date}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-200">
                      {rem.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300">{rem.description}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
