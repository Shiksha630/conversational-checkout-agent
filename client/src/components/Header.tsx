import React from 'react';
import { User } from '../types';
import { Sparkles, Activity, UserCheck, RefreshCw, Layers, ShieldCheck } from 'lucide-react';

interface HeaderProps {
  users: User[];
  currentUser: User | null;
  onSelectUser: (user: User) => void;
  onToggleEvents: () => void;
  onToggleProfile: () => void;
  eventCount: number;
  razorpayMode: string;
  onResetSeed: () => void;
  isResetting: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  users,
  currentUser,
  onSelectUser,
  onToggleEvents,
  onToggleProfile,
  eventCount,
  razorpayMode,
  onResetSeed,
  isResetting,
}) => {
  return (
    <header className="sticky top-0 z-30 w-full bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Brand & Track */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-rzp-accent to-rzp-cyan flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Sparkles className="w-5 h-5 text-white animate-pulse-subtle" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white tracking-tight">
                  Razorpay <span className="text-rzp-accent">Conversational Checkout</span>
                </h1>
                <span className="hidden sm:inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-rzp-accent border border-blue-500/20">
                  Agentic Commerce
                </span>
              </div>
              <p className="text-xs text-slate-400">
                AI Checkout Agent powered by Claude Agent SDK & Razorpay Gateway
              </p>
            </div>
          </div>

          {/* Mobile quick events count */}
          <button
            onClick={onToggleEvents}
            className="md:hidden flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 text-xs text-slate-300 border border-slate-700"
          >
            <Activity className="w-3.5 h-3.5 text-rzp-cyan" />
            <span>{eventCount}</span>
          </button>
        </div>

        {/* Persona Selector & Actions */}
        <div className="flex items-center flex-wrap gap-2.5 w-full md:w-auto justify-end">
          {/* Persona Switcher */}
          <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800">
            <span className="text-xs font-medium text-slate-400 px-2 flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-rzp-accent" />
              <span className="hidden lg:inline">Persona:</span>
            </span>
            <div className="flex items-center gap-1">
              {users.map((user) => {
                const isSelected = currentUser?.id === user.id;
                return (
                  <button
                    key={user.id}
                    onClick={() => onSelectUser(user)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-rzp-accent text-white shadow-md shadow-blue-500/20'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <img
                      src={user.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=60'}
                      alt={user.name}
                      className="w-4 h-4 rounded-full object-cover border border-white/20"
                    />
                    <span>{user.name.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* User History Button */}
          <button
            onClick={onToggleProfile}
            title="View User Purchase History & Database Records"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition"
          >
            <Layers className="w-3.5 h-3.5 text-rzp-cyan" />
            <span className="hidden sm:inline">DB History</span>
          </button>

          {/* Architecture Events Trigger */}
          <button
            onClick={onToggleEvents}
            title="Inspect Live Architecture Event Bus (Kafka/EventEmitter Stream)"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition relative"
          >
            <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="hidden sm:inline">Live Events</span>
            {eventCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                {eventCount}
              </span>
            )}
          </button>

          {/* Reset Seed Button */}
          <button
            onClick={onResetSeed}
            disabled={isResetting}
            title="Reset Database to Initial State"
            className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
    </header>
  );
};
