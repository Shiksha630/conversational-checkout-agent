import Anthropic from '@anthropic-ai/sdk';
import { MessageParam, ContentBlock, ToolUseBlock } from '@anthropic-ai/sdk/resources/messages';
import { config } from '../config';
import { agentTools } from '../tools/definitions';
import { executeTool } from '../tools/handlers';
import { eventBus } from '../events/eventBus';
import { dbService } from '../db';
import { searchAllProviders } from '../providers/router';
import {
  ShoppingSession, ShoppingState, CommerceIntent, IntentResult,
  ProductIntent, UnifiedProduct, FoodIntent, FoodOrderData,
} from '../providers/types';

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
  foodOrderProposal?: {
    restaurantId: string;
    restaurantName: string;
    restaurantCuisine: string;
    restaurantRating: number;
    restaurantAddress: string;
    itemId: string;
    itemName: string;
    itemDescription: string;
    itemPrice: number;
    deliveryFee: number;
    totalAmount: number;
    etaMinutes: number;
    razorpayOrderId: string;
    razorpayAmountPaise: number;
    razorpayKeyId: string;
    paymentMethod: string;
    isMock: boolean;
    foodOrderId: string;
    user?: { name?: string; email?: string; phone?: string };
  };
  suggestedPrompts?: string[];
  reminderDetails?: { id: string; remind_date: string; description: string };
}

const SYSTEM_PROMPT = `
You are the "Razorpay Conversational Checkout Agent", an ultra-fast, intelligent AI commerce agent. You can handle repeat purchases from history AND brand-new orders via the Shopify Storefront API.

## Your Tools
- get_user_history: Fetch user's past purchases and preferred payment method.
- shopify_search_products: Search Shopify store for any product by keyword.
- shopify_select_product: Get all variants + prices for a specific product.
- shopify_create_cart: Add item to Shopify cart → automatically creates Razorpay payment order.
- create_payment_order: Create a Razorpay order for non-Shopify payments (recharge, bills, etc).
- schedule_reminder: Set a renewal reminder for the user.

## Decision Flow

### 1. NEW Product Order (user asks to buy something new)
If user mentions a product, item, or brand they want to buy:
a) Call shopify_search_products with the product keyword.
b) Show results clearly: title, brand, price in ₹, variants.
c) Ask user to pick one.
d) When user picks → call shopify_create_cart with the variant_id and user_id.
e) shopify_create_cart returns a Razorpay order automatically → present it for payment.

IMPORTANT: ALWAYS search Shopify first for ANY product request. Even if user mentions Zomato/Domino's — search for that item keyword on Shopify (e.g., "pizza", "food delivery gift card").

### 2. REPEAT Order (from history)
If user says "recharge my phone", "renew gym", "reorder coffee" → call get_user_history → find the past item → call create_payment_order.

### 3. MID-FLOW Changes
If user changes quantity/size mid-flow, adapt and call shopify_create_cart again with correct variant.

### 4. POST-PAYMENT
Celebrate success, show order ID, offer reminder via schedule_reminder.

## Tone
- Fast, friendly, concise. Like a smart personal shopping assistant.
- Always show prices in ₹.
- Never say "I can't order from X app" — always search Shopify for the nearest match.
- When showing search results, format them as a numbered list with price in ₹.
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

// ─── Per-user Shopping Sessions ──────────────────────────────────────────────
const shoppingSessions = new Map<string, ShoppingSession>();

// ─── Intent Classifier ────────────────────────────────────────────────────────
// The FIRST thing called on every message. Determines what the user wants
// before any product-selection or session logic runs.

function classifyIntent(message: string, session: ShoppingSession | undefined): IntentResult {
  const lower = message.toLowerCase().trim();

  // ── History / Utility intents (checked first — highest priority) ───────────
  if (lower.includes('remind') || lower.includes('set alert') || lower.includes('renewal date')) {
    return { intent: 'REMINDER', productIntent: null, foodIntent: null };
  }
  const isHistoryKeyword =
    lower.includes('recharge') || lower.includes('airtel') || lower.includes('jio') ||
    lower.includes('gym') || lower.includes('cult') || lower.includes('membership') ||
    lower.includes('renew') || lower.includes('my phone') || lower.includes('my plan') ||
    lower.includes('my coffee') || lower.includes('electricity bill');

  if (isHistoryKeyword) {
    return { intent: 'HISTORY_REORDER', productIntent: null, foodIntent: null };
  }

  // ── Checkout / Pay intent ─────────────────────────────────────────────────
  if (/^(pay now|checkout|proceed to pay|complete payment|pay ₹)/.test(lower)) {
    return { intent: 'CHECKOUT', productIntent: null, foodIntent: null };
  }

  // ── Extract structured ProductIntent (query + budget + preferences + sort) ─
  function extractProductIntent(text: string): ProductIntent {
    let q = text;

    // Extract budget: "under ₹3000", "below 1500", "less than ₹2,000", "upto 5000"
    let budget: number | null = null;
    const budgetMatch = text.match(/(?:under|below|less\s+than|upto|up\s+to|within|max|maximum)\s*[₹rs\.\s]*([0-9][0-9,]*)/i);
    if (budgetMatch) {
      budget = parseInt(budgetMatch[1].replace(/,/g, ''), 10);
      q = q.replace(budgetMatch[0], '').trim();
    }

    // Detect sort preference
    let sort: ProductIntent['sort'] = 'best_match';
    if (/cheaper|cheapest|lowest price|price low|budget|affordable/i.test(text)) sort = 'price_asc';
    if (/expensive|premium|highest|best quality|luxury/i.test(text)) sort = 'price_desc';

    // Extract color/size/attribute preferences
    const colorWords = ['black', 'white', 'red', 'blue', 'green', 'grey', 'gray', 'pink', 'yellow', 'orange', 'purple', 'silver', 'gold'];
    const sizeWords = ['small', 'medium', 'large', 'xl', 'xxl', 'xs', 'mini', 'compact'];
    const attrWords = ['wireless', 'wired', 'bluetooth', 'noise cancelling', 'waterproof', 'slim', 'fast charging'];
    const allAttrs = [...colorWords, ...sizeWords, ...attrWords];
    const preferences = allAttrs.filter(attr => text.toLowerCase().includes(attr));

    // Strip filler words to get the core product query
    const stopPhrases = [
      'i want to buy', 'i want to order', 'i want to get', 'i want to purchase',
      'i want', 'i need', 'i am looking for', "i'm looking for",
      'can you find me', 'can you get me', 'can you order', 'can you find',
      'order', 'buy', 'purchase', 'get me', 'find me', 'show me', 'search for',
      'shop for', 'pick up', 'book', 'looking for', 'actually', 'instead',
      'change to', 'switch to', 'what about', 'do you have', 'please', 'for me',
      'cheaper', 'cheapest', 'cheapest one', 'show cheaper', 'show me cheaper',
    ];
    stopPhrases.sort((a, b) => b.length - a.length);
    stopPhrases.forEach(phrase => {
      q = q.replace(new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), ' ');
    });
    q = q.replace(/\s+/g, ' ').trim();

    return { query: q, budget, preferences, sort };
  }

  // ── Pure selection signals — number, affirmative, ordinal ─────────────────
  // IMPORTANT: only treated as selection if there's an active session waiting for it.
  const isPureSelection =
    /^\s*[1-9]\s*$/.test(lower) ||
    /^(option|#|no\.?)\s*[1-9]/.test(lower) ||
    /^(first|second|third|fourth|fifth)\s*(one|option)?$/i.test(lower) ||
    /^(yes|ok|okay|sure|go ahead|proceed|confirm|yep|yeah|this one|that one|buy this|order this|pay now)$/.test(lower);

  if (isPureSelection && session?.state === 'PRODUCTS_SHOWN') {
    return { intent: 'SELECTION', productIntent: null, foodIntent: null };
  }
  if (isPureSelection && session?.state === 'VARIANT_SELECTION') {
    return { intent: 'VARIANT_PICK', productIntent: null, foodIntent: null };
  }

  // ── Refinement: sort/filter on existing session results ───────────────────
  // Only a refinement if: (a) session exists, (b) message has refinement word
  // but NO new product noun that would make it a NEW_SEARCH.
  const hasRefinementWord =
    lower.includes('cheaper') || lower.includes('lower price') || lower.includes('more expensive') ||
    lower.includes('premium') || lower.includes('show more') || lower.includes('other option') ||
    lower.includes('in stock') || lower.includes('sort by');

  // A budget-update "under ₹X" while in PRODUCTS_SHOWN is a REFINEMENT on same query
  const isBudgetUpdate = /(?:under|below|less than|upto)\s*[₹rs\.\s]*([0-9][0-9,]*)/i.test(lower) &&
    !lower.match(/want|buy|order|purchase|get me|looking for|find|need/);

  if (session && (hasRefinementWord || isBudgetUpdate) && ['PRODUCTS_SHOWN', 'PRODUCT_SELECTED'].includes(session.state)) {
    // Build a refinement intent that modifies the existing product intent
    const refinedIntent: ProductIntent = {
      query: session.productIntent?.query ?? '',
      budget: null,
      preferences: session.productIntent?.preferences ?? [],
      sort: session.productIntent?.sort ?? 'best_match',
    };
    // Update sort
    if (/cheaper|lowest|price low|budget|affordable/i.test(lower)) refinedIntent.sort = 'price_asc';
    if (/expensive|premium|highest/i.test(lower)) refinedIntent.sort = 'price_desc';
    // Update budget
    const bm = lower.match(/(?:under|below|less\s+than|upto)\s*[₹rs\.\s]*([0-9][0-9,]*)/i);
    if (bm) refinedIntent.budget = parseInt(bm[1].replace(/,/g, ''), 10);

    return { intent: 'REFINEMENT', productIntent: refinedIntent, foodIntent: null };
  }

  // ── FOOD ORDER — "order X from Y" pattern — checked BEFORE NEW_SEARCH ────
  const foodFromPattern = /(?:order|get me|place an order for|can you order)\s+(.+?)\s+from\s+(.+)/i;
  const foodMatch = lower.match(foodFromPattern);
  if (foodMatch) {
    const foodIntent: FoodIntent = {
      item: foodMatch[1].trim().replace(/^(a|an|the|some)\s+/i, ''),
      restaurant: foodMatch[2].trim().replace(/[?.!]+$/, ''),
      rawQuery: message,
    };
    return { intent: 'FOOD_ORDER', productIntent: null, foodIntent };
  }

  // ── FOOD AMBIGUOUS — "order biryani" (no restaurant specified) ─────────────
  const foodNoRestaurantPattern = /^(?:order|get me|can you order|place.*order.*for)\s+(.+?)(?:\s+(?:please|now|asap))?\.?$/i;
  const foodNoRestMatch = lower.match(foodNoRestaurantPattern);
  if (foodNoRestMatch) {
    const candidate = foodNoRestMatch[1].trim().replace(/^(a|an|the|some)\s+/i, '');
    // Only classify as FOOD_AMBIGUOUS if it looks like a food item (not a product category like "shoes")
    const foodKeywords = ['biryani','pizza','burger','dosa','noodles','rice','curry','sandwich','momos','chicken','paneer','veg','roti','paratha','pasta','coffee','tea','juice','wrap','kebab','idli','samosa','roll'];
    const looksLikeFood = foodKeywords.some(k => candidate.toLowerCase().includes(k));
    if (looksLikeFood) {
      return {
        intent: 'FOOD_ORDER',
        productIntent: null,
        foodIntent: { item: candidate, restaurant: '', rawQuery: message },
      };
    }
  }

  // Also detect confirmation of food order
  if (session?.state === 'FOOD_ORDER_CONFIRMATION' && isPureSelection) {
    return { intent: 'CHECKOUT', productIntent: null, foodIntent: null };
  }

  // ── New Search — any message with a shopping trigger verb ─────────────────
  const newSearchTriggers = [
    'want', 'buy', 'order', 'purchase', 'get me', 'need', 'looking for',
    'find me', 'search for', 'show me', 'pick up', 'shop for',
    'can you find', 'do you have', 'what about', 'actually i want',
    'actually i need', 'instead', 'switch to', 'change to',
  ];
  const hasNewSearchTrigger = newSearchTriggers.some(t => lower.includes(t));

  if (hasNewSearchTrigger) {
    const pIntent = extractProductIntent(lower);
    if (pIntent.query.length >= 2) {
      return { intent: 'NEW_SEARCH', productIntent: pIntent, foodIntent: null };
    }
  }

  // ── Variant pick: user replied with a color/size/model name ──────────────
  if (session?.state === 'VARIANT_SELECTION') {
    return { intent: 'VARIANT_PICK', productIntent: null, foodIntent: null };
  }

  return { intent: 'GENERAL', productIntent: null, foodIntent: null };
}

// ─── Helper: format product list for display ─────────────────────────────────
function formatProductList(products: UnifiedProduct[]): string {
  return products.map((p, i) => {
    const variantNote = p.variants.length > 1 ? ` | ${p.variants.length} options` : '';
    const stockNote = p.inStock ? '' : ' *(out of stock)*';
    return `**${i + 1}.** ${p.title}${stockNote}\n   🏷️ ${p.vendor} | 💰 ${p.priceDisplay}${variantNote}`;
  }).join('\n\n');
}

// ─── Helper: format variant list for display ─────────────────────────────────
function formatVariantList(product: UnifiedProduct): string {
  return product.variants.map((v, i) =>
    `**${i + 1}.** ${v.name} — ${v.priceDisplay}${v.inStock ? '' : ' *(out of stock)*'}`
  ).join('\n');
}

// ─── createCartAndRazorpay ────────────────────────────────────────────────────
// Shared by SELECTION (single-variant) and VARIANT_PICK flows.
// Creates a Shopify cart + Razorpay order and returns the checkout card response.
async function createCartAndRazorpay(
  userId: string,
  product: UnifiedProduct,
  variantId: string,
  session: ShoppingSession,
  toolExecutions: Array<{ name: string; input: any; result: any }>
): Promise<ChatResponse> {
  const cartResult = await executeTool('shopify_create_cart', {
    variant_id: variantId,
    quantity: 1,
    user_id: userId,
  });
  toolExecutions.push({
    name: 'shopify_create_cart',
    input: { variant_id: variantId, quantity: 1, user_id: userId },
    result: cartResult,
  });

  if (cartResult.success) {
    shoppingSessions.set(userId, {
      ...session,
      state: 'CART_CREATED',
      selectedProduct: product,
      selectedVariantId: variantId,
      cartId: cartResult.shopify_cart_id,
      razorpayOrderId: cartResult.razorpay_order_id,
      lastUpdated: Date.now(),
    });

    const cartShort = cartResult.shopify_cart_id?.split('/').pop() ?? cartResult.shopify_cart_id;
    return {
      message: `✅ **Cart ready!**\n\n📦 **${product.title}** by ${product.vendor}\n💰 Total: **${product.priceDisplay}** | 💳 Payment: **${cartResult.payment_method}**\n🛒 Cart ID: \`${cartShort}\`\n\nTap **Pay via Razorpay** below to complete your purchase:`,
      toolCalls: toolExecutions,
      checkoutProposal: {
        order_id: cartResult.razorpay_order_id,
        amount: cartResult.amount_inr,
        amount_paise: cartResult.razorpay_amount_paise,
        currency: 'INR',
        key_id: cartResult.razorpay_key_id,
        method: cartResult.payment_method,
        description: cartResult.description,
        is_mock: cartResult.is_mock,
        user: cartResult.user,
      },
      suggestedPrompts: [`Pay ₹${cartResult.amount_inr} Now`, 'Use Credit Card instead', 'Search for something else'],
    };
  }

  return {
    message: `⚠️ Couldn't create the cart for **${product.title}**. Please try again.`,
    toolCalls: toolExecutions,
    suggestedPrompts: ['Try again', 'Pick a different product'],
  };
}

// ─── Main Simulated Agent ─────────────────────────────────────────────────────
async function runSimulatedAgent(
  userId: string,
  userText: string,
  rawMessages: Array<any>
): Promise<ChatResponse> {
  const toolExecutions: Array<{ name: string; input: any; result: any }> = [];
  const lower = userText.toLowerCase();
  const user = dbService.getUserById(userId);
  const history = dbService.getUserHistory(userId);

  // ── STEP 1: Classify intent — ALWAYS first ────────────────────────────────
  const session = shoppingSessions.get(userId);
  const { intent, productIntent, foodIntent } = classifyIntent(userText, session);

  // Debug log
  console.log('\n━━━━━━━━━━━━━ COMMERCE AGENT ━━━━━━━━━━━━━');
  console.log(`USER    : "${userText}"`);
  console.log(`INTENT  : ${intent}`);
  console.log(`QUERY   : ${productIntent?.query ?? '(none)'}`);
  console.log(`BUDGET  : ${productIntent?.budget ? `₹${productIntent.budget}` : '(none)'}`);
  console.log(`SORT    : ${productIntent?.sort ?? '(none)'}`);
  console.log(`SESSION : ${session?.state ?? 'IDLE'}`);
  console.log(`PREV Q  : ${session?.productIntent?.query ?? '(none)'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // ── STEP 2: NEW_SEARCH — clear old session, run fresh search ─────────────
  if (intent === 'NEW_SEARCH' && productIntent) {
    if (session) {
      console.log(`[State] Clearing session (was: ${session.state} / "${session.productIntent?.query}") → new search "${productIntent.query}"`);
      shoppingSessions.delete(userId);
    }

    // Create new session in SEARCHING state
    shoppingSessions.set(userId, {
      state: 'SEARCHING',
      productIntent,
      searchResults: [],
      selectedProduct: null,
      selectedVariantId: null,
      cartId: null,
      razorpayOrderId: null,
      lastUpdated: Date.now(),
    });

    const products = await searchAllProviders(productIntent);
    toolExecutions.push({
      name: 'shopify_search_products',
      input: { query: productIntent.query, budget: productIntent.budget, sort: productIntent.sort },
      result: { found: products.length > 0, count: products.length, products: products.map(p => ({ title: p.title, price: p.priceDisplay, vendor: p.vendor })) },
    });

    if (products.length === 0) {
      // Honest zero-results response — never leak old data
      const budgetNote = productIntent.budget ? ` under ₹${productIntent.budget.toLocaleString('en-IN')}` : '';
      shoppingSessions.delete(userId);
      return {
        message: `🔍 No products found for **"${productIntent.query}"${budgetNote}** in the connected store.\n\nThe current store carries: snowboards and accessories by Snowdevil. Try searching for "snowboard", or connect your own Shopify store with products you want to sell!`,
        toolCalls: toolExecutions,
        suggestedPrompts: ['Search for snowboard', 'Recharge my phone', 'Renew gym membership'],
      };
    }

    // Transition to PRODUCTS_SHOWN
    shoppingSessions.set(userId, {
      state: 'PRODUCTS_SHOWN',
      productIntent,
      searchResults: products,
      selectedProduct: null,
      selectedVariantId: null,
      cartId: null,
      razorpayOrderId: null,
      lastUpdated: Date.now(),
    });

    const budgetLine = productIntent.budget ? ` (budget: ≤₹${productIntent.budget.toLocaleString('en-IN')})` : '';
    return {
      message: `🛍️ Found **${products.length} product${products.length > 1 ? 's' : ''}** for **"${productIntent.query}"**${budgetLine}:\n\n${formatProductList(products)}\n\nReply with a number to select (e.g. **"1"**), or ask me to filter — *"show cheaper ones"*, *"under ₹50,000"*.`,
      toolCalls: toolExecutions,
      suggestedPrompts: [
        ...products.slice(0, 3).map((p, i) => `${i + 1}. ${p.title}`),
        ...(productIntent.budget ? [] : ['Show cheaper options']),
      ],
    };
  }

  // ── STEP 3: REFINEMENT — re-search with updated budget/sort ──────────────
  if (intent === 'REFINEMENT' && productIntent && session) {
    console.log(`[State] Refinement: query="${productIntent.query}" budget=${productIntent.budget} sort=${productIntent.sort}`);

    const products = await searchAllProviders(productIntent);
    toolExecutions.push({
      name: 'shopify_search_products',
      input: { query: productIntent.query, budget: productIntent.budget, sort: productIntent.sort },
      result: { found: products.length > 0, count: products.length },
    });

    if (products.length === 0) {
      const cheapest = session.searchResults[0];
      const budgetNote = productIntent.budget ? ` under ₹${productIntent.budget.toLocaleString('en-IN')}` : '';
      return {
        message: `🔍 No products found${budgetNote}. The most affordable option is **${cheapest?.title}** at **${cheapest?.priceDisplay}**. Want to see it?`,
        toolCalls: toolExecutions,
        suggestedPrompts: [`Show ${cheapest?.title ?? 'options'}`, 'Try a higher budget', 'Start new search'],
      };
    }

    shoppingSessions.set(userId, { ...session, state: 'PRODUCTS_SHOWN', productIntent, searchResults: products, lastUpdated: Date.now() });
    const sortNote = productIntent.sort === 'price_asc' ? ' (lowest price first)' : productIntent.sort === 'price_desc' ? ' (highest first)' : '';
    const budgetNote = productIntent.budget ? ` under ₹${productIntent.budget.toLocaleString('en-IN')}` : '';

    return {
      message: `🔄 Refined results${budgetNote}${sortNote}:\n\n${formatProductList(products)}\n\nPick a number or refine further.`,
      toolCalls: toolExecutions,
      suggestedPrompts: products.slice(0, 3).map((p, i) => `${i + 1}. ${p.title}`),
    };
  }

  // ── STEP 4: SELECTION — user picks a product from PRODUCTS_SHOWN list ─────
  if (intent === 'SELECTION' && session?.state === 'PRODUCTS_SHOWN') {
    const products = session.searchResults;

    // Parse which index the user chose
    let chosenIndex = 0;
    const numMatch = lower.match(/\b([1-9])\b/);
    if (numMatch) chosenIndex = parseInt(numMatch[1]) - 1;
    if (lower.includes('first')) chosenIndex = 0;
    else if (lower.includes('second')) chosenIndex = 1;
    else if (lower.includes('third')) chosenIndex = 2;
    else if (lower.includes('fourth')) chosenIndex = 3;
    else if (lower.includes('fifth')) chosenIndex = 4;

    const chosen = products[chosenIndex] ?? products[0];
    if (!chosen) {
      return {
        message: `Please pick a valid number (1–${products.length}).`,
        toolCalls: toolExecutions,
        suggestedPrompts: products.slice(0, 3).map((p, i) => `${i + 1}. ${p.title}`),
      };
    }

    console.log(`[State] PRODUCT_SELECTED: "${chosen.title}" (${chosen.variants.length} variants)`);

    // ── Does this product have multiple variants? ───────────────────────────
    if (chosen.variants.length > 1) {
      // Transition to VARIANT_SELECTION — ask user to pick
      shoppingSessions.set(userId, {
        ...session,
        state: 'VARIANT_SELECTION',
        selectedProduct: chosen,
        selectedVariantId: null,
        lastUpdated: Date.now(),
      });

      return {
        message: `📦 **${chosen.title}** by ${chosen.vendor} is available in **${chosen.variants.length} options**:\n\n${formatVariantList(chosen)}\n\nWhich one would you like? (reply with a number)`,
        toolCalls: toolExecutions,
        suggestedPrompts: chosen.variants.slice(0, 3).map((v, i) => `${i + 1}. ${v.name}`),
      };
    }

    // Single variant — go straight to cart
    return await createCartAndRazorpay(userId, chosen, chosen.variants[0]?.id ?? chosen.variantId, session, toolExecutions);
  }

  // ── STEP 5: VARIANT_PICK — user picks a variant after being shown the list ─
  if (intent === 'VARIANT_PICK' && session?.state === 'VARIANT_SELECTION' && session.selectedProduct) {
    const product = session.selectedProduct;
    const variants = product.variants;

    // Parse chosen variant index
    let variantIndex = 0;
    const numMatch = lower.match(/\b([1-9])\b/);
    if (numMatch) variantIndex = parseInt(numMatch[1]) - 1;
    if (lower.includes('first')) variantIndex = 0;
    else if (lower.includes('second')) variantIndex = 1;
    else if (lower.includes('third')) variantIndex = 2;

    // Try name-based match (e.g. user types "black" or "154cm")
    let chosenVariant = variants[variantIndex];
    const nameMatch = variants.find(v => lower.includes(v.name.toLowerCase().split(' / ')[0].toLowerCase()));
    if (nameMatch) chosenVariant = nameMatch;
    if (!chosenVariant) chosenVariant = variants[0];

    console.log(`[State] VARIANT_PICKED: "${chosenVariant.name}" id=${chosenVariant.id}`);

    return await createCartAndRazorpay(userId, product, chosenVariant.id, session, toolExecutions);
  }

  // ── STEP 6: CHECKOUT — user says pay now while in CART_CREATED ────────────
  if (intent === 'CHECKOUT' && session?.state === 'CART_CREATED' && session.razorpayOrderId) {
    return {
      message: `💳 Your Razorpay order **${session.razorpayOrderId}** is ready. Tap Pay below to complete checkout.`,
      toolCalls: toolExecutions,
      suggestedPrompts: ['Pay now', 'Use Credit Card instead'],
    };
  }

  // ── FOOD_ORDER_CONFIRMATION checkout ─────────────────────────────────────────
  if (intent === 'CHECKOUT' && session?.state === 'FOOD_ORDER_CONFIRMATION' && session.foodOrderData) {
    const fd = session.foodOrderData;
    return {
      message: `💳 Your food order of **₹${fd.totalAmount}** is ready. Tap Pay below to place your order!`,
      toolCalls: toolExecutions,
      foodOrderProposal: fd,
      suggestedPrompts: [`Pay ₹${fd.totalAmount} Now`, 'Cancel order'],
    };
  }

  // ── FOOD_ORDER — user says "order X from Y restaurant" ───────────────────
  if (intent === 'FOOD_ORDER' && foodIntent) {
    console.log('[FoodOrder] Restaurant:', foodIntent.restaurant || '(not specified)', '| Item:', foodIntent.item);

    // ── REQ 4 BOUNDED: Spend cap enforcement ─────────────────────────────
    const FOOD_SPEND_CAP = 2000; // INR — configurable per-session limit

    // ── REQ 5: Handle ambiguous query — no restaurant specified ──────────
    if (!foodIntent.restaurant || foodIntent.restaurant.trim() === '') {
      return {
        message: `🍽️ I'd love to order **${foodIntent.item}** for you!\n\nWhich restaurant would you like it from?\n\n• 🍛 **Biryani House** — Biryani & North Indian\n• 🍕 **Pizza Palace** — Pizza & Pasta\n• 🍔 **Burger Barn** — Burgers & Fries\n• 🫓 **Dosa Corner** — South Indian\n• 🍜 **Wok Express** — Chinese & Asian\n\nTry: *"Order ${foodIntent.item} from Biryani House"*`,
        toolCalls: toolExecutions,
        suggestedPrompts: [
          `Order ${foodIntent.item} from Biryani House`,
          `Order ${foodIntent.item} from Dosa Corner`,
          `Order ${foodIntent.item} from Wok Express`,
        ],
      };
    }

    const searchResult = await executeTool('food_search_restaurant', { query: foodIntent.restaurant });
    toolExecutions.push({ name: 'food_search_restaurant', input: { query: foodIntent.restaurant }, result: searchResult });

    if (!searchResult.found || searchResult.restaurants.length === 0) {
      return {
        message: `🍽️ Sorry, I couldn't find **${foodIntent.restaurant}** in my restaurant list.\n\nAvailable restaurants:\n• 🍛 **Biryani House** — Chicken Biryani, Mutton Biryani, Veg Biryani\n• 🍕 **Pizza Palace** — Margherita, Chicken BBQ, Farmhouse\n• 🍔 **Burger Barn** — Classic Burger, Chicken Crispy Burger\n• 🫓 **Dosa Corner** — Masala Dosa, Paneer Dosa, Idli\n• 🍜 **Wok Express** — Fried Rice, Chilli Chicken, Momos\n\nTry: "Order Chicken Biryani from Biryani House"`,
        toolCalls: toolExecutions,
        suggestedPrompts: ['Order Masala Dosa from Dosa Corner', 'Order Margherita Pizza from Pizza Palace', 'Order Momos from Wok Express'],
      };
    }

    const restaurant = searchResult.restaurants[0];
    const menuItem: any = restaurant.menu.find((m: any) =>
      m.name.toLowerCase().includes(foodIntent.item.toLowerCase()) ||
      foodIntent.item.toLowerCase().includes(m.name.toLowerCase().split(' ')[0])
    ) ?? restaurant.menu.find((m: any) =>
      foodIntent.item.toLowerCase().split(' ').some((word: string) => m.name.toLowerCase().includes(word))
    );

    if (!menuItem) {
      const menuList = restaurant.menu.slice(0, 6)
        .map((m: any) => `• **${m.name}** — ${m.price_display}`)
        .join('\n');
      return {
        message: `🍽️ I found **${restaurant.name}** but couldn't find "${foodIntent.item}" on their menu.\n\nHere's what they serve:\n${menuList}\n\nWhich one would you like to order?`,
        toolCalls: toolExecutions,
        suggestedPrompts: restaurant.menu.slice(0, 3).map((m: any) => `Order ${m.name} from ${restaurant.name}`),
      };
    }

    // ── REQ 4 BOUNDED: Check estimated total against spend cap ───────────
    const estimatedTotal = menuItem.price + restaurant.delivery_fee;
    if (estimatedTotal > FOOD_SPEND_CAP) {
      return {
        message: `⚠️ **Spend Limit Notice**\n\n🧠 **Agent Reasoning:** I matched *"${foodIntent.item}"* → **${menuItem.name}** (₹${menuItem.price}) at **${restaurant.name}** + ₹${restaurant.delivery_fee} delivery = **₹${estimatedTotal} total**.\n\nThis exceeds your per-order spend cap of **₹${FOOD_SPEND_CAP}**.\n\nDo you want to proceed anyway? Or I can suggest cheaper alternatives.`,
        toolCalls: toolExecutions,
        suggestedPrompts: [`Yes, proceed with ₹${estimatedTotal} order`, 'Show me cheaper options', 'Cancel'],
      };
    }

    const orderResult = await executeTool('food_place_order', {
      restaurant_id: restaurant.id,
      item_id: menuItem.id,
      user_id: userId,
    });
    toolExecutions.push({
      name: 'food_place_order',
      input: { restaurant_id: restaurant.id, item_id: menuItem.id, user_id: userId },
      result: orderResult,
    });

    // ── REQ 5: Out-of-stock graceful failure ─────────────────────────────
    if (!orderResult.success && orderResult.out_of_stock) {
      const altText = orderResult.alternatives?.length
        ? `\n\nAvailable alternatives from ${restaurant.name}:\n${orderResult.alternatives.map((a: string) => `• ${a}`).join('\n')}`
        : '';
      return {
        message: `😔 **${orderResult.item_name || foodIntent.item} is currently sold out** at ${restaurant.name}.${altText}\n\nWould you like to order one of the alternatives, or try another restaurant?`,
        toolCalls: toolExecutions,
        suggestedPrompts: [
          ...(orderResult.alternatives?.slice(0, 2).map((a: string) => `Order ${a.split(' (')[0]} from ${restaurant.name}`) || []),
          'Try another restaurant',
        ],
      };
    }

    if (!orderResult.success) {
      return {
        message: `⚠️ Something went wrong while placing the order for **${menuItem.name}**. Please try again in a moment.`,
        toolCalls: toolExecutions,
        suggestedPrompts: [`Order ${menuItem.name} from ${restaurant.name}`, 'Try a different item'],
      };
    }

    const foodOrderData: FoodOrderData = {
      restaurantId: orderResult.restaurant.id,
      restaurantName: orderResult.restaurant.name,
      restaurantCuisine: orderResult.restaurant.cuisine,
      restaurantRating: orderResult.restaurant.rating,
      restaurantAddress: orderResult.restaurant.address,
      itemId: orderResult.item.id,
      itemName: orderResult.item.name,
      itemDescription: orderResult.item.description,
      itemPrice: orderResult.pricing.item_price,
      deliveryFee: orderResult.pricing.delivery_fee,
      totalAmount: orderResult.pricing.total_amount,
      etaMinutes: orderResult.restaurant.eta_minutes,
      razorpayOrderId: orderResult.razorpay_order_id,
      razorpayAmountPaise: orderResult.razorpay_amount_paise,
      razorpayKeyId: orderResult.razorpay_key_id,
      paymentMethod: orderResult.payment_method,
      isMock: orderResult.is_mock,
      foodOrderId: orderResult.food_order_id,
      user: orderResult.user,
    };

    shoppingSessions.set(userId, {
      state: 'FOOD_ORDER_CONFIRMATION',
      productIntent: null,
      searchResults: [],
      selectedProduct: null,
      selectedVariantId: null,
      cartId: null,
      razorpayOrderId: orderResult.razorpay_order_id,
      lastUpdated: Date.now(),
      foodOrderData,
    });

    // ── REQ 4 EXPLAINABLE: State exactly why this item was selected ───────
    const vegTag = orderResult.item.is_veg ? '🟢 Veg' : '🔴 Non-Veg';
    const stockNote = orderResult.stock_remaining <= 5 ? ` *(only ${orderResult.stock_remaining} left!)*` : '';
    const reasoningLine = `🧠 **Agent Reasoning:** I matched *"${foodIntent.item}"* → **${orderResult.item.name}** (${vegTag}, ${orderResult.item.category}) at **${orderResult.restaurant.name}** — closest match to your request.${stockNote}`;

    return {
      message: `${reasoningLine}\n\n✅ Here's your order summary — tap **Pay** to place the order:\n\n🏪 **${orderResult.restaurant.name}** (${orderResult.restaurant.cuisine}) | ⭐ ${orderResult.restaurant.rating}\n📍 ${orderResult.restaurant.address}`,
      toolCalls: toolExecutions,
      foodOrderProposal: foodOrderData,
      suggestedPrompts: [`Pay ₹${orderResult.pricing.total_amount} Now`, 'Order something else', 'Cancel'],
    };
  }

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

  // 1b. Check if user is asking for a Razorpay Payment Link
  if (lower.includes('payment link') || lower.includes('pay link') || lower.includes('send link') || lower.includes('share link')) {
    const amountMatch = userText.match(/₹?\s*(\d{2,5})/);
    const linkAmount = amountMatch ? parseInt(amountMatch[1], 10) : 500;
    const linkDesc = `Payment link for ₹${linkAmount}`;

    const linkResult = await executeTool('create_payment_link', {
      amount: linkAmount,
      description: linkDesc,
      user_id: userId,
      expiry_minutes: 30,
    });
    toolExecutions.push({ name: 'create_payment_link', input: { amount: linkAmount, description: linkDesc, user_id: userId }, result: linkResult });

    return {
      message: `🔗 **Razorpay Payment Link Generated!**\n\n🧠 **Agent Reasoning:** You requested a direct payment link for **₹${linkAmount}**. I've created an active Razorpay Payment Link that expires in 30 minutes.\n\n👉 **[Click here to Pay ₹${linkAmount}](${linkResult.short_url})**\n\nLink: \`${linkResult.short_url}\``,
      toolCalls: toolExecutions,
      suggestedPrompts: ['Recharge my phone', 'Order Chicken Biryani from Biryani House'],
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

  // ─── CUSTOM ORDER HANDLER ────────────────────────────────────────────────────
  // Detects any free-text order containing food, product, app, or merchant names
  // and generates a dynamic Razorpay payment card for it.
  const customOrderResult = detectCustomOrder(userText, user?.preferred_payment_method || 'UPI');
  if (customOrderResult) {
    const { description, amount, method } = customOrderResult;

    const orderResult = await executeTool('create_payment_order', {
      amount,
      method,
      description,
      user_id: userId,
    });
    toolExecutions.push({ name: 'create_payment_order', input: { amount, method, description, user_id: userId }, result: orderResult });

    return {
      message: `Got it! Here is your order ready for checkout:\n\n**${description}**\n\nAmount: **₹${amount}** | Payment: **${method}**\n\nTap the button below to pay via Razorpay:`,
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
      suggestedPrompts: [`Pay ₹${amount} Now`, `Change amount`, 'Use Credit Card instead'],
    };
  }

  // Default helpful response with persona-specific recommendations
  return {
    message: `Hello ${user?.name || 'there'}! I'm your Razorpay Conversational Checkout Agent. Based on your account history, I can help you with:\n\n` +
      `• **Recharge:** ${history.find(h => h.type === 'recharge')?.description || 'Mobile Prepaid'} (₹${history.find(h => h.type === 'recharge')?.amount || 399})\n` +
      `• **Subscription:** ${history.find(h => h.type === 'subscription')?.description || 'Gym / Streaming'} (₹${history.find(h => h.type === 'subscription')?.amount || 1499})\n` +
      `• **Reorder:** ${history.find(h => h.type === 'reorder')?.description || 'Usual Coffee / Food'} (₹${history.find(h => h.type === 'reorder')?.amount || 420})\n\n` +
      `You can also tell me about a **custom order** — for example:\n` +
      `*"Order a Farmhouse Pizza from Domino's for ₹450"*\n` +
      `*"Pay my electricity bill of ₹1200"*\n` +
      `*"Order groceries from Blinkit worth ₹800"*\n\n` +
      `What would you like to do today?`,
    toolCalls: toolExecutions,
    suggestedPrompts: [
      'Recharge my phone',
      'Renew my gym membership',
      'Reorder my usual coffee',
    ],
  };
}

// ─── SMART CUSTOM ORDER EXTRACTOR ────────────────────────────────────────────
// Parses free-text input to extract merchant name, items, and price for any
// custom order that doesn't match pre-seeded history patterns.
function detectCustomOrder(
  text: string,
  defaultMethod: string
): { description: string; amount: number; method: string } | null {

  const lower = text.toLowerCase();

  // Keywords that signal a fresh order / payment / bill intent
  const orderTriggers = [
    'order', 'want', 'get me', 'place', 'buy', 'purchase', 'book',
    'pay', 'bill', 'deliver', 'send me', 'i need', 'arrange',
    'from zomato', 'from swiggy', 'from blinkit', 'from zepto',
    'from domino', 'from mcdonald', 'from kfc', 'from pizza hut',
    'from bigbasket', 'from amazon', 'from flipkart', 'electricity',
    'water bill', 'gas bill', 'broadband', 'internet bill',
  ];

  const hasTrigger = orderTriggers.some(t => lower.includes(t));
  if (!hasTrigger) return null;

  // Extract amount if mentioned explicitly (e.g. "for ₹550", "worth 800", "₹450")
  const amountMatch = text.match(/(?:for\s*|worth\s*|of\s*|rs\.?\s*|₹\s*)(\d{2,6})/i)
    || text.match(/(\d{2,6})\s*(?:rs|rupees|inr)/i)
    || text.match(/₹\s*(\d{2,6})/);
  const extractedAmount = amountMatch ? parseInt(amountMatch[1], 10) : null;

  // Extract quantity (e.g. "2 pizzas", "3 burgers", "medium sized")
  const qtyMatch = text.match(/(\d+)\s+(?:piece|pcs|nos?|x\s+)?/i);
  const qty = qtyMatch ? qtyMatch[1] : null;

  // Detect size hints
  const size = lower.includes('large') ? 'Large'
    : lower.includes('medium') ? 'Medium'
    : lower.includes('small') ? 'Small'
    : lower.includes('family') ? 'Family'
    : '';

  // Known merchants & their typical price ranges
  const merchants: Array<{ names: string[]; priceRange: [number, number]; category: string }> = [
    { names: ['domino', 'dominos', "domino's"], priceRange: [299, 699], category: 'Pizza' },
    { names: ['pizza hut'], priceRange: [349, 799], category: 'Pizza' },
    { names: ['mcdonald', "mcdonald's", 'mcdonalds', 'mcd'], priceRange: [199, 549], category: 'Fast Food' },
    { names: ['kfc'], priceRange: [249, 649], category: 'Fried Chicken' },
    { names: ['burger king'], priceRange: [199, 499], category: 'Burgers' },
    { names: ['subway'], priceRange: [199, 449], category: 'Sandwiches' },
    { names: ['zomato'], priceRange: [300, 800], category: 'Food Delivery' },
    { names: ['swiggy'], priceRange: [250, 700], category: 'Food Delivery' },
    { names: ['blinkit', 'grofers'], priceRange: [400, 1200], category: 'Groceries' },
    { names: ['zepto'], priceRange: [300, 1000], category: 'Groceries' },
    { names: ['bigbasket'], priceRange: [500, 2000], category: 'Groceries' },
    { names: ['amazon', 'amzn'], priceRange: [500, 5000], category: 'Shopping' },
    { names: ['flipkart'], priceRange: [500, 5000], category: 'Shopping' },
    { names: ['meesho'], priceRange: [200, 2000], category: 'Shopping' },
    { names: ['starbucks'], priceRange: [350, 800], category: 'Coffee' },
    { names: ['third wave', 'blue tokai'], priceRange: [300, 700], category: 'Coffee' },
    { names: ['chaayos', 'chai point'], priceRange: [150, 400], category: 'Tea & Snacks' },
    { names: ['ola', 'uber'], priceRange: [80, 500], category: 'Cab Booking' },
    { names: ['rapido'], priceRange: [50, 200], category: 'Bike Taxi' },
    { names: ['hotstar', 'disney'], priceRange: [299, 1499], category: 'Streaming' },
    { names: ['netflix'], priceRange: [149, 649], category: 'Streaming' },
    { names: ['spotify'], priceRange: [119, 399], category: 'Music Streaming' },
    { names: ['electricity', 'bescom', 'msedcl', 'tneb', 'electric bill'], priceRange: [500, 5000], category: 'Utility Bill' },
    { names: ['water bill', 'gas bill', 'piped gas'], priceRange: [200, 2000], category: 'Utility Bill' },
    { names: ['broadband', 'wifi', 'jiofiber', 'airtel broadband'], priceRange: [399, 1499], category: 'Internet Bill' },
    { names: ['redbull', 'red bull', 'monster energy'], priceRange: [120, 300], category: 'Beverages' },
  ];

  let detectedMerchant: string | null = null;
  let estimatedAmount = 399;
  let category = 'Order';

  for (const m of merchants) {
    if (m.names.some(n => lower.includes(n))) {
      detectedMerchant = m.names[0].split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      // Use midpoint of price range as default estimate
      estimatedAmount = Math.round((m.priceRange[0] + m.priceRange[1]) / 2);
      category = m.category;
      break;
    }
  }

  // Extract item keywords from the message
  const foodItems = [
    'pizza', 'burger', 'sandwich', 'pasta', 'biryani', 'naan', 'roti',
    'dosa', 'idli', 'fried rice', 'noodles', 'momos', 'roll', 'wrap',
    'garlic bread', 'wings', 'nuggets', 'fries', 'coffee', 'tea', 'juice',
    'cake', 'pastry', 'croissant', 'cookie', 'shake', 'smoothie',
    'atta', 'rice', 'dal', 'oil', 'milk', 'bread', 'eggs', 'vegetables',
    'farmhouse', 'margherita', 'pepperoni', 'veggie supreme', 'paneer',
  ];

  const detectedItems: string[] = [];
  for (const item of foodItems) {
    if (lower.includes(item)) {
      const capitalised = item.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      detectedItems.push(capitalised);
    }
  }

  // Only proceed if we detected a merchant or at least 1 item with a trigger word
  if (!detectedMerchant && detectedItems.length === 0) return null;

  // Build description string
  const qtyPrefix = qty ? `${qty}x ` : '';
  const sizePrefix = size ? `${size} ` : '';
  const itemsStr = detectedItems.length > 0
    ? detectedItems.map(i => `${qtyPrefix}${sizePrefix}${i}`).join(' & ')
    : `${sizePrefix}${category} Order`;
  const merchantStr = detectedMerchant || 'Selected Merchant';
  const description = `${merchantStr} — ${itemsStr}`;

  // Determine amount: use explicit amount if given, else use merchant estimate
  const finalAmount = extractedAmount && extractedAmount >= 10 && extractedAmount <= 50000
    ? extractedAmount
    : estimatedAmount;

  // Determine payment method
  const method = lower.includes('card') || lower.includes('credit') || lower.includes('debit')
    ? 'Credit Card'
    : lower.includes('cod') || lower.includes('cash')
    ? 'Cash on Delivery'
    : defaultMethod;

  return { description, amount: finalAmount, method };
}
