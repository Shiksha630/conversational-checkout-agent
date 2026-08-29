import React, { useState } from 'react';
import { ArchitectureEvent } from '../types';
import { Activity, X, ChevronDown, ChevronRight, CheckCircle, Database, Bell, Shield, Layers } from 'lucide-react';

interface EventDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  events: ArchitectureEvent[];
  onClear: () => void;
}

export const EventDrawer: React.FC<EventDrawerProps> = ({
  isOpen,
  onClose,
  events,
  onClear,
}) => {
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('ALL');

  if (!isOpen) return null;

  const getEventBadge = (type: ArchitectureEvent['type']) => {
    switch (type) {
      case 'USER_INTENT_PARSED':
        return { color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: Activity, label: 'Intent Parsed' };
      case 'USER_HISTORY_RETRIEVED':
        return { color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20', icon: Database, label: 'DB Query' };
      case 'PAYMENT_ORDER_INITIATED':
        return { color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: Shield, label: 'Order Init' };
      case 'AGENT_PROPOSAL_DISPATCHED':
        return { color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20', icon: Layers, label: 'Proposal' };
      case 'PAYMENT_CAPTURED':
        return { color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: CheckCircle, label: 'Payment Captured' };
      case 'TRANSACTION_COMMITTED':
        return { color: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20', icon: Database, label: 'DB Committed' };
      case 'REMINDER_SCHEDULED':
        return { color: 'bg-purple-500/10 text-purple-400 border-purple-500/20', icon: Bell, label: 'Reminder' };
      default:
        return { color: 'bg-slate-500/10 text-slate-400 border-slate-500/20', icon: Activity, label: 'System' };
    }
  };

  const filteredEvents = events.filter((e) => {
    if (filter === 'ALL') return true;
    if (filter === 'PAYMENT') return e.type.includes('PAYMENT') || e.type.includes('TRANSACTION');
    if (filter === 'DB') return e.type.includes('HISTORY') || e.type.includes('TRANSACTION') || e.type.includes('REMINDER');
    if (filter === 'AGENT') return e.type.includes('INTENT') || e.type.includes('PROPOSAL');
    return true;
  });

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md bg-slate-950 border-l border-slate-800 shadow-2xl flex flex-col animate-slide-up">
      {/* Header */}
      <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
            <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Architecture Event Stream
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono">
                LIVE
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Discrete event lifecycle: Intent → Proposal → Order → Capture → DB
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="px-4 py-2 bg-slate-900/60 border-b border-slate-800/80 flex items-center gap-1.5 overflow-x-auto text-xs">
        {['ALL', 'AGENT', 'PAYMENT', 'DB'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2.5 py-1 rounded-lg font-medium transition ${
              filter === f
                ? 'bg-rzp-accent text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Events List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs">
            No events recorded yet. Interact with the chat to watch the architecture pipeline in action!
          </div>
        ) : (
          filteredEvents.map((evt) => {
            const badge = getEventBadge(evt.type);
            const Icon = badge.icon;
            const isExpanded = expandedEventId === evt.id;

            return (
              <div
                key={evt.id}
                className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border flex items-center gap-1 ${badge.color}`}>
                      <Icon className="w-2.5 h-2.5" />
                      {badge.label}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>

                <h5 className="text-xs font-semibold text-slate-200 mt-1.5">{evt.title}</h5>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{evt.description}</p>

                {evt.metadata && (
                  <div className="mt-2">
                    <button
                      onClick={() => setExpandedEventId(isExpanded ? null : evt.id)}
                      className="text-[10px] text-slate-500 hover:text-rzp-accent flex items-center gap-1 font-mono transition"
                    >
                      {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      <span>{isExpanded ? 'Hide Payload' : 'View Payload JSON'}</span>
                    </button>

                    {isExpanded && (
                      <pre className="mt-1.5 p-2 rounded-lg bg-slate-950 text-[10px] font-mono text-emerald-300 overflow-x-auto border border-slate-800">
                        {JSON.stringify(evt.metadata, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
