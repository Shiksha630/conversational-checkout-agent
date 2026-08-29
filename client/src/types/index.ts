export interface User {
  id: string;
  name: string;
  phone: string;
  email: string;
  preferred_payment_method: string;
  avatar_url?: string;
  created_at?: string;
}

export interface PurchaseHistoryItem {
  id: string;
  user_id: string;
  type: 'recharge' | 'subscription' | 'reorder';
  amount: number;
  currency: string;
  description: string;
  metadata_json?: string;
  date: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  razorpay_order_id: string;
  razorpay_payment_id?: string;
  amount: number;
  currency: string;
  status: string;
  payment_method?: string;
  description?: string;
  created_at: string;
}

export interface Reminder {
  id: string;
  user_id: string;
  remind_date: string;
  description: string;
  status: string;
  created_at: string;
}

export interface CheckoutProposal {
  order_id: string;
  amount: number;
  amount_paise: number;
  currency: string;
  key_id: string;
  method: string;
  description: string;
  is_mock: boolean;
  user?: {
    name?: string;
    email?: string;
    phone?: string;
  };
}

export interface ToolExecution {
  name: string;
  input: any;
  result: any;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolCalls?: ToolExecution[];
  checkoutProposal?: CheckoutProposal;
  suggestedPrompts?: string[];
  paymentStatus?: 'unpaid' | 'paying' | 'paid' | 'failed';
  paymentResult?: {
    paymentId: string;
    orderId: string;
    status: string;
  };
  reminderDetails?: {
    id: string;
    remind_date: string;
    description: string;
  };
}

export interface ArchitectureEvent {
  id: string;
  type:
    | 'USER_INTENT_PARSED'
    | 'USER_HISTORY_RETRIEVED'
    | 'PAYMENT_ORDER_INITIATED'
    | 'AGENT_PROPOSAL_DISPATCHED'
    | 'PAYMENT_CAPTURED'
    | 'TRANSACTION_COMMITTED'
    | 'REMINDER_SCHEDULED'
    | 'SYSTEM_LOG';
  title: string;
  description: string;
  metadata?: Record<string, any>;
  timestamp: string;
}
