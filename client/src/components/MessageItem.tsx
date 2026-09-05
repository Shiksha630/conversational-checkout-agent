import React, { useState } from 'react';
import { ChatMessage, User } from '../types';
import { ConfirmCard } from './ConfirmCard';
import { FoodOrderCard } from './FoodOrderCard';
import { Bot, ChevronDown, ChevronRight, Terminal, CheckCircle, BellRing, Sparkles } from 'lucide-react';

interface MessageItemProps {
  message: ChatMessage;
  currentUser: User | null;
  onPaymentSuccess: (result: { paymentId: string; orderId: string; status: string }) => void;
  onQuickAction: (text: string) => void;
  onViewReceipt: (result: { paymentId: string; orderId: string; status: string; proposal?: any }) => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  currentUser,
  onPaymentSuccess,
  onQuickAction,
  onViewReceipt,
}) => {
  const isUser = message.role === 'user';
  const [showTools, setShowTools] = useState(false);

  // Format simple markdown (bold, lists, code)
  const formatContent = (text: string) => {
    return text.split('\n').map((line, idx) => {
      // Bolding formatting
      let formattedLine = line;
      
      return (
        <span key={idx} className="block min-h-[1.2rem]">
          {line.startsWith('• ') || line.startsWith('- ') ? (
            <span className="flex items-start gap-1.5 ml-1">
              <span className="text-rzp-accent font-bold mt-0.5">•</span>
              <span>{line.replace(/^[•-]\s*/, '')}</span>
            </span>
          ) : (
            line
          )}
        </span>
      );
    });
  };

  return (
    <div className={`flex gap-3 my-4 animate-fade-in ${isUser ? 'justify-end' : 'justify-start'}`}>
      {/* Agent Avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rzp-blue to-rzp-accent flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20 border border-rzp-accent/40">
          <Bot className="w-4 h-4 text-white" />
        </div>
      )}

      {/* Message Bubble Container */}
      <div className={`flex flex-col max-w-[85%] md:max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Tool Call Badges (Judges feature to inspect Agent tools) */}
        {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mb-2 w-full">
            <button
              onClick={() => setShowTools(!showTools)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-[11px] text-slate-400 hover:text-slate-200 border border-slate-800 transition"
            >
              <Terminal className="w-3 h-3 text-rzp-cyan" />
              <span className="font-mono">
                Claude Tool Calls ({message.toolCalls.length}):{' '}
                <strong className="text-slate-300">
                  {message.toolCalls.map((t) => t.name).join(', ')}
                </strong>
              </span>
              {showTools ? (
                <ChevronDown className="w-3 h-3 ml-1 text-slate-500" />
              ) : (
                <ChevronRight className="w-3 h-3 ml-1 text-slate-500" />
              )}
            </button>

            {showTools && (
              <div className="mt-1.5 p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 text-[11px] font-mono space-y-2 overflow-x-auto">
                {message.toolCalls.map((tool, idx) => (
                  <div key={idx} className="border-b border-slate-800/80 last:border-0 pb-1.5 last:pb-0">
                    <div className="text-rzp-cyan font-semibold flex items-center gap-1">
                      <span>⚡ tool:</span> {tool.name}
                    </div>
                    <div className="text-slate-400 mt-0.5">
                      <span className="text-slate-500">args:</span> {JSON.stringify(tool.input)}
                    </div>
                    <div className="text-emerald-400/90 mt-0.5 max-h-24 overflow-y-auto">
                      <span className="text-slate-500">result:</span> {JSON.stringify(tool.result)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bubble text */}
        <div
          className={`p-3.5 rounded-2xl text-xs md:text-sm leading-relaxed shadow-md ${
            isUser
              ? 'bg-rzp-accent text-white rounded-tr-none font-medium'
              : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none'
          }`}
        >
          {formatContent(message.content)}
        </div>

        {/* Embedded Interactive Payment Proposal Card */}
        {!isUser && message.checkoutProposal && (
          <ConfirmCard
            proposal={message.checkoutProposal}
            isPaid={Boolean(message.paymentResult || message.paymentStatus === 'paid')}
            onPaymentSuccess={(result) => onPaymentSuccess(result)}
            onModify={(text) => onQuickAction(text)}
          />
        )}

        {/* Embedded Food Order Confirmation Card */}
        {!isUser && message.foodOrderProposal && (
          <FoodOrderCard
            data={message.foodOrderProposal}
            isPaid={Boolean(message.paymentResult || message.paymentStatus === 'paid')}
            onPaymentSuccess={(result) => onPaymentSuccess(result)}
            onModify={(text) => onQuickAction(text)}
          />
        )}

        {/* Embedded Payment Receipt Badge */}
        {!isUser && message.paymentResult && (
          <div className="mt-2 flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs animate-fade-in w-full max-w-md">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="flex-1 truncate">
              <span className="font-semibold">Razorpay Payment Captured: </span>
              <code className="font-mono text-[11px] text-emerald-300">{message.paymentResult.paymentId}</code>
            </div>
            <button
              onClick={() =>
                onViewReceipt({
                  ...message.paymentResult!,
                  proposal: message.checkoutProposal,
                })
              }
              className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-semibold rounded-lg text-[11px] transition"
            >
              Receipt
            </button>
          </div>
        )}

        {/* Embedded Proactive Reminder Badge */}
        {!isUser && message.reminderDetails && (
          <div className="mt-2 flex items-center gap-2 p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/25 text-purple-300 text-xs animate-fade-in w-full max-w-md">
            <BellRing className="w-4 h-4 text-purple-400 shrink-0" />
            <div className="flex-1">
              <span className="font-semibold">Reminder Scheduled for {message.reminderDetails.remind_date}: </span>
              <span className="text-[11px] text-purple-200">{message.reminderDetails.description}</span>
            </div>
          </div>
        )}

        {/* Timestamp */}
        <span className="text-[10px] text-slate-500 mt-1 px-1">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* User Avatar */}
      {isUser && (
        <img
          src={currentUser?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=60'}
          alt={currentUser?.name || 'User'}
          className="w-8 h-8 rounded-xl object-cover border border-blue-500/30 shrink-0 shadow"
        />
      )}
    </div>
  );
};
