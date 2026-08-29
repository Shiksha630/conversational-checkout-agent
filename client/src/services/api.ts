import { User, PurchaseHistoryItem, Transaction, Reminder, ChatMessage, ArchitectureEvent } from '../types';

const API_BASE = '/api';

export const api = {
  async checkHealth(): Promise<{ status: string; razorpay_mode: string; anthropic_configured: boolean }> {
    const res = await fetch(`${API_BASE}/health`);
    return await res.json();
  },

  async getUsers(): Promise<User[]> {
    const res = await fetch(`${API_BASE}/users`);
    if (!res.ok) throw new Error('Failed to fetch users');
    return await res.json();
  },

  async getUserDetails(userId: string): Promise<{
    user: User;
    history: PurchaseHistoryItem[];
    transactions: Transaction[];
    reminders: Reminder[];
  }> {
    const res = await fetch(`${API_BASE}/users/${userId}`);
    if (!res.ok) throw new Error('Failed to fetch user details');
    return await res.json();
  },

  async sendChatMessage(
    userId: string,
    message: string,
    history: Array<{ role: string; content: string }>
  ): Promise<{
    message: string;
    toolCalls: any[];
    checkoutProposal?: any;
    reminderDetails?: any;
    suggestedPrompts?: string[];
  }> {
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, message, history }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to send message to agent');
    }
    return await res.json();
  },

  async verifyPayment(payload: {
    orderId: string;
    paymentId: string;
    signature?: string;
    userId: string;
    amount: number;
    method?: string;
    description?: string;
  }): Promise<{ verified: boolean; payment_id: string; order_id: string; status: string }> {
    const res = await fetch(`${API_BASE}/payment/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Payment verification failed');
    return await res.json();
  },

  async getEvents(): Promise<ArchitectureEvent[]> {
    const res = await fetch(`${API_BASE}/events`);
    if (!res.ok) return [];
    return await res.json();
  },

  async resetSeed(): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/seed`, { method: 'POST' });
    return await res.json();
  },
};
