import Anthropic from '@anthropic-ai/sdk';
import { MessageParam, ContentBlock, ToolUseBlock } from '@anthropic-ai/sdk/resources/messages';
import { config } from '../config';
import { agentTools } from '../tools/definitions';
import { executeTool } from '../tools/handlers';
import { eventBus } from '../events/eventBus';
import { dbService } from '../db';

let anthropicClient: Anthropic | null = null;

if (config.anthropicApiKey && !config.anthropicApiKey.includes('your_anthropic')) {
  try {
    anthropicClient = new Anthropic({
      apiKey: config.anthropicApiKey,
    });
    console.log('🤖 Anthropic Claude Agent SDK initialized.');
  } catch (err) {
    console.warn('⚠️ Anthropic SDK initialization failed:', err);
    anthropicClient = null;
  }
} else {
  console.log('ℹ️ Running Agent with High-Fidelity Local Agentic Simulator (no ANTHROPIC_API_KEY provided).');
}

export interface ChatResponse {
  message: string;
  toolCalls: Array<{ name: string; input: any; result: any }>;
  checkoutProposal?: {
    order_id: string;
    amount: number;
    amount_paise: number;
    currency: string;
    key_id: string;
    method: string;
    description: string;
    is_mock: boolean;
    user?: { name?: string; email?: string; phone?: string };
  };
  suggestedPrompts?: string[];
  reminderDetails?: { id: string; remind_date: string; description: string };
}

const SYSTEM_PROMPT = `
You are the "Razorpay Conversational Checkout Agent", an ultra-fast, intelligent AI commerce agent designed to execute frictionless one-tap purchases, mobile recharges, subscription renewals, and repeat orders directly within chat.

Your Goals:
1. When a user expresses intent (e.g. "recharge my phone", "renew gym", "reorder my coffee"), ALWAYS immediately call 'get_user_history' to inspect their past purchases and preferred payment methods.
2. Formulate a crisp, proactive recommendation based on their history (e.g. "Your usual recharge is ₹399 Airtel Unlimited via UPI — want me to proceed?").
3. When the user confirms or requests a checkout, call 'create_payment_order' with the exact amount, method, and clear description.
4. If the user adjusts the amount or payment method mid-flow (e.g. "actually make it ₹500" or "use my credit card"), adapt immediately and call 'create_payment_order' with the new details without resetting context.
5. When a payment is successfully verified or the user confirms payment, celebrate the completion, mention the order/payment ID, and proactively offer a follow-up action (such as scheduling a reminder for the next renewal). If they say yes to a reminder, call 'schedule_reminder'.

Tone & Persona:
- Professional, fast, helpful, and concise (like Razorpay's trusted fintech experience).
- Do not make up fake IDs — always use the tools provided.
- Always include currency symbols (₹).
`;

export async function processChat(
  userId: string,
  rawMessages: Array<{ role: 'user' | 'assistant'; content: string | any }>,
  latestUserText: string
): Promise<ChatResponse> {
  eventBus.emitEvent(
    'USER_INTENT_PARSED',
    'User Message Received',
    `User (${userId}) said: "${latestUserText}"`,
    { userId, text: latestUserText }
  );

  const toolExecutions: Array<{ name: string; input: any; result: any }> = [];
  let checkoutProposal: ChatResponse['checkoutProposal'] = undefined;
  let reminderDetails: ChatResponse['reminderDetails'] = undefined;

  // Real Anthropic Claude Agent execution
  if (anthropicClient) {
    try {
      const messages: MessageParam[] = rawMessages.map((m) => {
        if (typeof m.content === 'string') {
          return { role: m.role, content: m.content };
        }
        return m as MessageParam;
      });

      let keepGoing = true;
      let iterations = 0;
      let finalAssistantText = '';

      while (keepGoing && iterations < 6) {
        iterations++;
        const response = await anthropicClient.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          tools: agentTools,
          messages,
        });

        const toolUses: ToolUseBlock[] = [];
        let textSegments: string[] = [];

        for (const block of response.content) {
          if (block.type === 'text') {
            textSegments.push(block.text);
          } else if (block.type === 'tool_use') {
            toolUses.push(block);
          }
        }

        if (textSegments.length > 0) {
          finalAssistantText = textSegments.join('\n');
        }

        if (response.stop_reason === 'tool_use' || toolUses.length > 0) {
          // Push assistant tool call message
          messages.push({
            role: 'assistant',
            content: response.content,
          });

          // Execute each tool call
          const toolResultsContent: ContentBlock[] = [];

          for (const toolUse of toolUses) {
            const inputObj = (toolUse.input && typeof toolUse.input === 'object') ? (toolUse.input as Record<string, any>) : {};
            console.log(`⚡ Executing Agent Tool: ${toolUse.name}`, inputObj);
            const result = await executeTool(toolUse.name, { ...inputObj, user_id: inputObj.user_id || userId });
            
            toolExecutions.push({
              name: toolUse.name,
              input: inputObj,
              result,
            });

            if (toolUse.name === 'create_payment_order' && result.success) {
              checkoutProposal = {
                order_id: result.order_id,
                amount: result.amount,
                amount_paise: result.amount_paise,
                currency: result.currency,
                key_id: result.key_id,
                method: result.method,
                description: result.description,
                is_mock: result.is_mock,
                user: result.user,
              };
            }

            if (toolUse.name === 'schedule_reminder' && result.success) {
              reminderDetails = {
                id: result.reminder_id,
                remind_date: result.remind_date,
                description: result.description,
              };
            }

            toolResultsContent.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: JSON.stringify(result),
            } as any);
          }

          messages.push({
            role: 'user',
            content: toolResultsContent as any,
          });
        } else {
          keepGoing = false;
        }
      }

      return {
        message: finalAssistantText || "I've processed your request.",
        toolCalls: toolExecutions,
        checkoutProposal,
        reminderDetails,
      };
    } catch (error: any) {
      console.error('⚠️ Anthropic Claude API error, falling back to smart simulation engine:', error?.message);
    }
  }

  // High-Fidelity Intelligent Local Agent Simulator (Rule-based Agentic Engine)
  return await runSimulatedAgent(userId, latestUserText, rawMessages);
}

async function runSimulatedAgent(
  userId: string,
  userText: string,
  rawMessages: Array<any>
): Promise<ChatResponse> {
  const toolExecutions: Array<{ name: string; input: any; result: any }> = [];
  const lower = userText.toLowerCase();

  const user = dbService.getUserById(userId);
  const history = dbService.getUserHistory(userId);

  // Tool 1: Always retrieve history if intent is a product inquiry or first turn
  const historyResult = await executeTool('get_user_history', { user_id: userId });
  toolExecutions.push({ name: 'get_user_history', input: { user_id: userId }, result: historyResult });

  // 1. Check if user is asking to set a reminder
  if (lower.includes('remind') || lower.includes('alert') || lower.includes('renewal date') || (lower.includes('yes') && rawMessages.some(m => m.content?.toString().toLowerCase().includes('remind')))) {
    const reminderResult = await executeTool('schedule_reminder', {
      user_id: userId,
      remind_date: 'in 28 days',
      description: 'Upcoming renewal for services on Razorpay Conversational Checkout',
    });
    toolExecutions.push({ name: 'schedule_reminder', input: { user_id: userId, remind_date: 'in 28 days' }, result: reminderResult });

    return {
      message: `🔔 **Reminder Set!** I've scheduled a notification for **${reminderResult.remind_date}** to renew your plan before it expires. Let me know if you need anything else!`,
      toolCalls: toolExecutions,
      reminderDetails: {
        id: reminderResult.reminder_id,
        remind_date: reminderResult.remind_date,
        description: reminderResult.description,
      },
      suggestedPrompts: ['Show my recent transactions', 'Reorder something else'],
    };
  }

  // 2. Check for mid-flow modification (e.g. "make it 500", "change to 500", "use credit card")
  const customAmountMatch = userText.match(/₹?\s*(\d{2,5})/);
  const isCustomAmount = (lower.includes('make it') || lower.includes('change') || lower.includes('actually') || lower.includes('instead')) && customAmountMatch;

  if (isCustomAmount && customAmountMatch) {
    const newAmount = parseInt(customAmountMatch[1], 10);
    const method = lower.includes('card') ? 'Credit Card (HDFC Regalia •••• 4821)' : (user?.preferred_payment_method || 'UPI');
    const description = `Custom Amount Order (₹${newAmount})`;

    const orderResult = await executeTool('create_payment_order', {
      amount: newAmount,
      method,
      description,
      user_id: userId,
    });
    toolExecutions.push({ name: 'create_payment_order', input: { amount: newAmount, method, description, user_id: userId }, result: orderResult });

    return {
      message: `Got it! I've updated the amount to **₹${newAmount}** via **${method}**. Please confirm below to initiate payment:`,
      toolCalls: toolExecutions,
      checkoutProposal: {
        order_id: orderResult.order_id,
        amount: orderResult.amount,
        amount_paise: orderResult.amount_paise,
        currency: orderResult.currency,
        key_id: orderResult.key_id,
        method: orderResult.method,
        description: orderResult.description,
        is_mock: orderResult.is_mock,
        user: orderResult.user,
      },
      suggestedPrompts: ['Pay Now', 'Change payment method to Card'],
    };
  }

  // 3. User says "Yes" / "Proceed" / "Confirm" to an existing recommendation
  const isAffirmative = lower === 'yes' || lower === 'proceed' || lower === 'confirm' || lower === 'go ahead' || lower.includes('pay now') || lower === 'y';
  
  if (isAffirmative) {
    // Find most relevant item in history
    const topItem = history[0] || { amount: 399, description: 'Quick Payment', type: 'recharge' };
    const method = user?.preferred_payment_method || 'UPI';

    const orderResult = await executeTool('create_payment_order', {
      amount: topItem.amount,
      method,
      description: topItem.description,
      user_id: userId,
    });
    toolExecutions.push({ name: 'create_payment_order', input: { amount: topItem.amount, method, description: topItem.description, user_id: userId }, result: orderResult });

    return {
      message: `Order generated! Review the transaction details below and tap **Pay via Razorpay** to complete the checkout:`,
      toolCalls: toolExecutions,
      checkoutProposal: {
        order_id: orderResult.order_id,
        amount: orderResult.amount,
        amount_paise: orderResult.amount_paise,
        currency: orderResult.currency,
        key_id: orderResult.key_id,
        method: orderResult.method,
        description: orderResult.description,
        is_mock: orderResult.is_mock,
        user: orderResult.user,
      },
      suggestedPrompts: ['Actually make it ₹500', 'Pay with another card'],
    };
  }

  // 4. Intent detection based on user query
  if (lower.includes('recharge') || lower.includes('phone') || lower.includes('airtel') || lower.includes('jio')) {
    const rechargeHistory = history.find((h) => h.type === 'recharge') || {
      amount: 399,
      description: 'Airtel 5G Unlimited Prepaid (28 Days, 2GB/day)',
    };

    const orderResult = await executeTool('create_payment_order', {
      amount: rechargeHistory.amount,
      method: user?.preferred_payment_method || 'UPI',
      description: rechargeHistory.description,
      user_id: userId,
    });
    toolExecutions.push({ name: 'create_payment_order', input: { amount: rechargeHistory.amount, method: user?.preferred_payment_method, description: rechargeHistory.description, user_id: userId }, result: orderResult });

    return {
      message: `I found your usual phone recharge plan: **${rechargeHistory.description}** for **₹${rechargeHistory.amount}** via **${user?.preferred_payment_method || 'UPI'}**.\n\nReady to recharge? Click below or say "Go ahead":`,
      toolCalls: toolExecutions,
      checkoutProposal: {
        order_id: orderResult.order_id,
        amount: orderResult.amount,
        amount_paise: orderResult.amount_paise,
        currency: orderResult.currency,
        key_id: orderResult.key_id,
        method: orderResult.method,
        description: orderResult.description,
        is_mock: orderResult.is_mock,
        user: orderResult.user,
      },
      suggestedPrompts: ['Go ahead & Pay', 'Actually make it ₹500', 'Use a different payment method'],
    };
  }

  if (lower.includes('gym') || lower.includes('cult') || lower.includes('membership') || lower.includes('subscription')) {
    const subHistory = history.find((h) => h.type === 'subscription') || {
      amount: 1499,
      description: 'Cultpass ELITE Monthly Membership',
    };

    const orderResult = await executeTool('create_payment_order', {
      amount: subHistory.amount,
      method: user?.preferred_payment_method || 'Credit Card (HDFC Regalia •••• 4821)',
      description: subHistory.description,
      user_id: userId,
    });
    toolExecutions.push({ name: 'create_payment_order', input: { amount: subHistory.amount, method: user?.preferred_payment_method, description: subHistory.description, user_id: userId }, result: orderResult });

    return {
      message: `Your **${subHistory.description}** is ready for monthly renewal at **₹${subHistory.amount}** using your **${user?.preferred_payment_method}**.\n\nShall I proceed with the renewal?`,
      toolCalls: toolExecutions,
      checkoutProposal: {
        order_id: orderResult.order_id,
        amount: orderResult.amount,
        amount_paise: orderResult.amount_paise,
        currency: orderResult.currency,
        key_id: orderResult.key_id,
        method: orderResult.method,
        description: orderResult.description,
        is_mock: orderResult.is_mock,
        user: orderResult.user,
      },
      suggestedPrompts: ['Renew now', 'Switch to UPI payment', 'Cancel'],
    };
  }

  if (lower.includes('coffee') || lower.includes('latte') || lower.includes('croissant') || lower.includes('reorder') || lower.includes('swiggy')) {
    const foodHistory = history.find((h) => h.type === 'reorder') || {
      amount: 420,
      description: 'Third Wave Coffee - Oat Milk Vanilla Latte (Large) + Butter Almond Croissant',
    };

    const orderResult = await executeTool('create_payment_order', {
      amount: foodHistory.amount,
      method: user?.preferred_payment_method || 'UPI',
      description: foodHistory.description,
      user_id: userId,
    });
    toolExecutions.push({ name: 'create_payment_order', input: { amount: foodHistory.amount, method: user?.preferred_payment_method, description: foodHistory.description, user_id: userId }, result: orderResult });

    return {
      message: `Craving your usual? I have your favorite order ready: **${foodHistory.description}** for **₹${foodHistory.amount}** via **${user?.preferred_payment_method}**.\n\nTap to place the reorder instantly:`,
      toolCalls: toolExecutions,
      checkoutProposal: {
        order_id: orderResult.order_id,
        amount: orderResult.amount,
        amount_paise: orderResult.amount_paise,
        currency: orderResult.currency,
        key_id: orderResult.key_id,
        method: orderResult.method,
        description: orderResult.description,
        is_mock: orderResult.is_mock,
        user: orderResult.user,
      },
      suggestedPrompts: ['Confirm & Pay ₹420', 'Make it 2 lattes instead', 'Change payment method'],
    };
  }

  // Default helpful response with persona-specific recommendations
  return {
    message: `Hello ${user?.name || 'there'}! I'm your Razorpay Conversational Checkout Agent. Based on your account history, I can help you with:\n\n` +
      `• **Recharge:** ${history.find(h => h.type === 'recharge')?.description || 'Mobile Prepaid'} (₹${history.find(h => h.type === 'recharge')?.amount || 399})\n` +
      `• **Subscription:** ${history.find(h => h.type === 'subscription')?.description || 'Gym / Streaming'} (₹${history.find(h => h.type === 'subscription')?.amount || 1499})\n` +
      `• **Reorder:** ${history.find(h => h.type === 'reorder')?.description || 'Usual Coffee / Food'} (₹${history.find(h => h.type === 'reorder')?.amount || 420})\n\n` +
      `What would you like to checkout today?`,
    toolCalls: toolExecutions,
    suggestedPrompts: [
      'Recharge my phone',
      'Renew my gym membership',
      'Reorder my usual coffee',
    ],
  };
}
