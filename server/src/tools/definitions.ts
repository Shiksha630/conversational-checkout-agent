import { Tool } from '@anthropic-ai/sdk/resources/messages';

export const agentTools: Tool[] = [
  {
    name: 'get_user_history',
    description: 'Look up the user profile, previous orders, recharges, recurring subscriptions, and preferred payment methods from the database.',
    input_schema: {
      type: 'object',
      properties: {
        user_id: {
          type: 'string',
          description: 'The unique identifier of the user (e.g. "usr_rahul", "usr_priya", "usr_ananya").',
        },
      },
      required: ['user_id'],
    },
  },
  {
    name: 'create_payment_order',
    description: 'Create a new Razorpay payment gateway order in test mode for a recharge, reorder, or subscription renewal.',
    input_schema: {
      type: 'object',
      properties: {
        amount: {
          type: 'number',
          description: 'The total payment amount in Indian Rupees (INR), e.g. 399 or 1499.',
        },
        method: {
          type: 'string',
          description: 'The selected payment method or route, e.g. "UPI (rahul@okhdfcbank)", "Credit Card", "UPI", "Net Banking".',
        },
        description: {
          type: 'string',
          description: 'Clear itemized description of the purchase (e.g. "Airtel 5G Unlimited Prepaid - 28 Days", "Cultpass ELITE Gym Monthly", "Third Wave Coffee - Oat Milk Latte + Croissant").',
        },
        user_id: {
          type: 'string',
          description: 'The unique identifier of the customer.',
        },
      },
      required: ['amount', 'method', 'description', 'user_id'],
    },
  },
  {
    name: 'verify_payment',
    description: 'Verify payment capture with Razorpay gateway upon receiving the client-side checkout callback.',
    input_schema: {
      type: 'object',
      properties: {
        payment_id: {
          type: 'string',
          description: 'The Razorpay payment ID (e.g. "pay_xyz123").',
        },
        order_id: {
          type: 'string',
          description: 'The Razorpay order ID (e.g. "order_abc789").',
        },
        signature: {
          type: 'string',
          description: 'Optional signature string received from Razorpay Checkout.',
        },
      },
      required: ['payment_id', 'order_id'],
    },
  },
  {
    name: 'log_transaction',
    description: 'Record a successfully completed or attempted checkout transaction into the database.',
    input_schema: {
      type: 'object',
      properties: {
        user_id: {
          type: 'string',
          description: 'The unique identifier of the user.',
        },
        order_id: {
          type: 'string',
          description: 'The Razorpay order ID associated with this transaction.',
        },
        payment_id: {
          type: 'string',
          description: 'The Razorpay payment ID.',
        },
        amount: {
          type: 'number',
          description: 'The amount in INR.',
        },
        status: {
          type: 'string',
          enum: ['SUCCESS', 'PENDING', 'FAILED'],
          description: 'The final status of the transaction.',
        },
        payment_method: {
          type: 'string',
          description: 'Payment method utilized (e.g. UPI, Card, NetBanking).',
        },
        description: {
          type: 'string',
          description: 'Brief summary of what was paid for.',
        },
      },
      required: ['user_id', 'order_id', 'amount', 'status'],
    },
  },
  {
    name: 'schedule_reminder',
    description: 'Schedule a proactive reminder for future subscription renewal or next mobile recharge.',
    input_schema: {
      type: 'object',
      properties: {
        user_id: {
          type: 'string',
          description: 'The user ID.',
        },
        remind_date: {
          type: 'string',
          description: 'The target date for the reminder (YYYY-MM-DD or formatted relative string like "in 28 days").',
        },
        description: {
          type: 'string',
          description: 'What the user is being reminded of (e.g. "Airtel 5G plan expires in 2 days", "Cultpass Elite Gym renewal").',
        },
      },
      required: ['user_id', 'remind_date', 'description'],
    },
  },
];
