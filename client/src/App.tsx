import React, { useState, useEffect, useRef } from 'react';
import { User, PurchaseHistoryItem, Transaction, Reminder, ChatMessage, ArchitectureEvent } from './types';
import { api } from './services/api';
import { Header } from './components/Header';
import { MessageItem } from './components/MessageItem';
import { PromptPills } from './components/PromptPills';
import { ReceiptModal } from './components/ReceiptModal';
import { EventDrawer } from './components/EventDrawer';
import { PersonaDrawer } from './components/PersonaDrawer';
import { Send, Sparkles, Loader2, RefreshCcw, ShieldCheck, Zap, MessageSquare } from 'lucide-react';

export const App: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userDetails, setUserDetails] = useState<{
    history: PurchaseHistoryItem[];
    transactions: Transaction[];
    reminders: Reminder[];
  }>({ history: [], transactions: [], reminders: [] });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatusText, setLoadingStatusText] = useState('Agent is processing...');

  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([
    'Recharge my phone',
    'Renew my gym membership',
    'Reorder my usual coffee order',
  ]);

  const [events, setEvents] = useState<ArchitectureEvent[]>([]);
  const [isEventsOpen, setIsEventsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [razorpayMode, setRazorpayMode] = useState('mock_sandbox');

  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // 1. Initial Load & Setup
  useEffect(() => {
    async function initApp() {
      try {
        const health = await api.checkHealth();
        setRazorpayMode(health.razorpay_mode);

        const fetchedUsers = await api.getUsers();
        setUsers(fetchedUsers);

        if (fetchedUsers.length > 0) {
          const firstUser = fetchedUsers[0];
          setCurrentUser(firstUser);
          await loadUserData(firstUser.id);
          resetConversationForUser(firstUser);
        }

        const initialEvents = await api.getEvents();
        setEvents(initialEvents);
      } catch (err) {
        console.error('Initialization error:', err);
      }
    }
    initApp();
  }, []);

  // 2. Real-time Architecture Events Stream (SSE)
  useEffect(() => {
    const eventSource = new EventSource('/api/events/stream');

    eventSource.onmessage = (event) => {
      try {
        const newEvt: ArchitectureEvent = JSON.parse(event.data);
        setEvents((prev) => [newEvt, ...prev.slice(0, 49)]);
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const loadUserData = async (userId: string) => {
    try {
      const data = await api.getUserDetails(userId);
      setUserDetails({
        history: data.history,
        transactions: data.transactions,
        reminders: data.reminders,
      });
    } catch (err) {
      console.error('Failed to load user data:', err);
    }
  };

  const resetConversationForUser = (user: User) => {
    const welcomeMessage: ChatMessage = {
      id: `msg_welcome_${Date.now()}`,
      role: 'assistant',
      content: `Hello **${user.name.split(' ')[0]}**! 👋 I'm your Razorpay Conversational Checkout Agent.\n\nI can fulfill your usual mobile recharges, gym/streaming subscriptions, or food reorders instantly without navigating menus.\n\nWhat would you like to purchase today?`,
      timestamp: new Date().toISOString(),
      suggestedPrompts: getPromptsForUser(user.id),
    };
    setMessages([welcomeMessage]);
    setSuggestedPrompts(getPromptsForUser(user.id));
  };

  const getPromptsForUser = (userId: string): string[] => {
    if (userId === 'usr_rahul') {
      return ['Recharge my phone', 'Renew my Netflix subscription', 'Actually make it ₹500'];
    } else if (userId === 'usr_priya') {
      return ['Renew my gym membership', 'Reorder Blue Tokai Coffee', 'Pay with HDFC Card'];
    } else if (userId === 'usr_ananya') {
      return ['Reorder my usual coffee order', 'Recharge my Jio phone', 'Pay via UPI'];
    }
    return ['Recharge my phone', 'Renew my gym membership', 'Reorder my usual coffee'];
  };

  const handleSelectUser = async (user: User) => {
    setCurrentUser(user);
    await loadUserData(user.id);
    resetConversationForUser(user);
  };

  // 3. Send message to Agent
  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim() || !currentUser || isLoading) return;

    setInputText('');

    // Add user message to state
    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    setLoadingStatusText('Agent analyzing intent & executing tool suite...');

    try {
      // Build conversation history format for Claude
      const historyPayload = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await api.sendChatMessage(currentUser.id, text.trim(), historyPayload);

      const assistantMsg: ChatMessage = {
        id: `ast_${Date.now()}`,
        role: 'assistant',
        content: response.message,
        timestamp: new Date().toISOString(),
        toolCalls: response.toolCalls,
        checkoutProposal: response.checkoutProposal,
        foodOrderProposal: response.foodOrderProposal,
        reminderDetails: response.reminderDetails,
        suggestedPrompts: response.suggestedPrompts || ['Confirm & Pay', 'Actually make it ₹500'],
      };

      setMessages((prev) => [...prev, assistantMsg]);
      if (response.suggestedPrompts) {
        setSuggestedPrompts(response.suggestedPrompts);
      }

      // Refresh DB history/transactions in background
      await loadUserData(currentUser.id);
    } catch (err: any) {
      console.error('Chat error:', err);
      const errorMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: `⚠️ Error: ${err.message || 'Unable to communicate with the checkout agent.'}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Handle Payment Success
  const handlePaymentSuccess = async (result: {
    paymentId: string;
    orderId: string;
    status: string;
  }) => {
    if (!currentUser) return;

    // Find message containing the order proposal
    const matchingProposalMsg = messages.find(
      (m) => m.checkoutProposal?.order_id === result.orderId
    );
    const proposal = matchingProposalMsg?.checkoutProposal;

    // Verify payment on backend
    try {
      await api.verifyPayment({
        orderId: result.orderId,
        paymentId: result.paymentId,
        userId: currentUser.id,
        amount: proposal?.amount || 0,
        method: proposal?.method || currentUser.preferred_payment_method,
        description: proposal?.description || 'Conversational Checkout Order',
      });

      // Update message status in state
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.checkoutProposal?.order_id === result.orderId) {
            return {
              ...msg,
              paymentStatus: 'paid',
              paymentResult: result,
            };
          }
          return msg;
        })
      );

      // Refresh DB state
      await loadUserData(currentUser.id);

      // Open Receipt Modal
      setReceiptData({
        ...result,
        proposal,
      });

      // Follow-up confirmation from agent
      setTimeout(() => {
        const confirmMsg: ChatMessage = {
          id: `ast_confirm_${Date.now()}`,
          role: 'assistant',
          content: `🎉 **Payment Verified & Captured!**\n\nYour payment of **₹${proposal?.amount || 399}** has been processed via Razorpay (Payment ID: \`${result.paymentId}\`).\n\nWould you like me to set a proactive reminder for your next renewal/recharge?`,
          timestamp: new Date().toISOString(),
          suggestedPrompts: [
            'Yes, remind me before next renewal',
            'Download payment receipt',
            'Reorder something else',
          ],
        };
        setMessages((prev) => [...prev, confirmMsg]);
        setSuggestedPrompts([
          'Yes, remind me before next renewal',
          'Show my recent transactions',
        ]);
      }, 500);
    } catch (err) {
      console.error('Error verifying payment:', err);
    }
  };

  const handleResetSeed = async () => {
    setIsResetting(true);
    try {
      await api.resetSeed();
      if (currentUser) {
        await loadUserData(currentUser.id);
        resetConversationForUser(currentUser);
      }
    } catch (err) {
      console.error('Reset error:', err);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Navigation Header */}
      <Header
        users={users}
        currentUser={currentUser}
        onSelectUser={handleSelectUser}
        onToggleEvents={() => setIsEventsOpen(!isEventsOpen)}
        onToggleProfile={() => setIsProfileOpen(!isProfileOpen)}
        eventCount={events.length}
        razorpayMode={razorpayMode}
        onResetSeed={handleResetSeed}
        isResetting={isResetting}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto flex flex-col overflow-hidden px-3 md:px-4 pb-2">
        {/* Banner Pill */}
        <div className="py-1.5 flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-900 px-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Agent Active</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-300">Customer: <strong className="text-white">{currentUser?.name}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-slate-500">Autonomous Tool-Calling Protocol</span>
            <span className="px-2 py-0.5 rounded-full bg-rzp-accent/10 text-rzp-accent font-semibold border border-rzp-accent/20">
              Razorpay Agent Studio
            </span>
          </div>
        </div>

        {/* Scrollable Chat Area */}
        <div className="flex-1 overflow-y-auto py-4 px-1 space-y-2">
          {messages.map((message) => (
            <MessageItem
              key={message.id}
              message={message}
              currentUser={currentUser}
              onPaymentSuccess={handlePaymentSuccess}
              onQuickAction={(text) => handleSendMessage(text)}
              onViewReceipt={(receipt) => setReceiptData(receipt)}
            />
          ))}

          {/* Typing Indicator */}
          {isLoading && (
            <div className="flex items-center gap-3 my-4 animate-fade-in">
              <div className="w-8 h-8 rounded-xl bg-rzp-blue flex items-center justify-center border border-rzp-accent/40 shadow">
                <Loader2 className="w-4 h-4 text-rzp-accent animate-spin" />
              </div>
              <div className="p-3 rounded-2xl rounded-tl-none bg-slate-900 border border-slate-800 text-xs text-slate-300 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rzp-accent animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-rzp-accent animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-rzp-accent animate-bounce [animation-delay:0.4s]" />
                <span className="ml-1 text-slate-400 font-medium">{loadingStatusText}</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Dynamic Prompt Suggestion Pills */}
        <div className="shrink-0 pt-1">
          <PromptPills
            prompts={suggestedPrompts}
            onSelectPrompt={(prompt) => handleSendMessage(prompt)}
            disabled={isLoading}
          />
        </div>

        {/* Input Bar */}
        <div className="shrink-0 pt-2 pb-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="relative flex items-center bg-slate-900/90 rounded-2xl border border-slate-800 focus-within:border-rzp-accent shadow-xl focus-within:ring-2 focus-within:ring-rzp-accent/20 transition-all p-1.5"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Ask to recharge, renew, reorder, or modify amount (e.g. "recharge my phone")...`}
              disabled={isLoading}
              className="flex-1 bg-transparent px-3 py-2 text-xs md:text-sm text-white placeholder-slate-500 focus:outline-none disabled:opacity-50"
            />

            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="px-3.5 py-2 rounded-xl bg-rzp-accent hover:bg-rzp-accentHover text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 shrink-0"
            >
              <span>Send</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </main>

      {/* Slide-over Drawers & Modals */}
      <EventDrawer
        isOpen={isEventsOpen}
        onClose={() => setIsEventsOpen(false)}
        events={events}
        onClear={() => setEvents([])}
      />

      <PersonaDrawer
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={currentUser}
        history={userDetails.history}
        transactions={userDetails.transactions}
        reminders={userDetails.reminders}
      />

      <ReceiptModal
        receiptData={receiptData}
        currentUser={currentUser}
        onClose={() => setReceiptData(null)}
        onSetReminder={() => handleSendMessage('Yes, remind me before next renewal')}
      />
    </div>
  );
};

export default App;
