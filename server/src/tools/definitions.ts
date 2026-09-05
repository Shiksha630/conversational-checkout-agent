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

  // ─── SHOPIFY STOREFRONT TOOLS ─────────────────────────────────────────────
  {
    name: 'shopify_search_products',
    description: 'Search the Shopify store for products matching a keyword (e.g. "sneakers", "phone case", "t-shirt"). Returns up to 5 matching products with titles, prices, and variant options.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search keyword or product name (e.g. "running shoes", "bluetooth headphones", "vitamin C serum").',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of products to return (1–5). Default: 4.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'shopify_select_product',
    description: 'Get full details of a specific Shopify product by its product ID, including all variants with exact prices and availability status.',
    input_schema: {
      type: 'object',
      properties: {
        product_id: {
          type: 'string',
          description: 'The Shopify product GID (e.g. "gid://shopify/Product/123456789").',
        },
      },
      required: ['product_id'],
    },
  },
  {
    name: 'shopify_create_cart',
    description: 'Add a product variant to the Shopify cart and get the total order amount and checkout URL. Call this once the user has confirmed which product/variant they want to buy.',
    input_schema: {
      type: 'object',
      properties: {
        variant_id: {
          type: 'string',
          description: 'The Shopify ProductVariant GID (e.g. "gid://shopify/ProductVariant/987654321").',
        },
        quantity: {
          type: 'number',
          description: 'Number of units to add to cart. Default: 1.',
        },
        user_id: {
          type: 'string',
          description: 'The user ID for creating the Razorpay payment order.',
        },
      },
      required: ['variant_id', 'user_id'],
    },
  },

  // ─── Food Ordering Tools ───────────────────────────────────────────────────
  {
    name: 'food_search_restaurant',
    description: 'Search for a restaurant by name or cuisine type in the local restaurant database. Returns restaurant details and full menu.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Restaurant name or cuisine type to search for (e.g. "Biryani House", "pizza", "south indian")',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'food_place_order',
    description: 'Place a food order for a specific menu item from a restaurant. Creates a Razorpay payment order for the total amount (food price + delivery fee). Returns the confirmation details including total amount and estimated delivery time.',
    input_schema: {
      type: 'object',
      properties: {
        restaurant_id: {
          type: 'string',
          description: 'The restaurant ID (e.g. "rest_bh")',
        },
        item_id: {
          type: 'string',
          description: 'The menu item ID to order (e.g. "item_bh_01")',
        },
        user_id: {
          type: 'string',
          description: 'The user ID placing the order',
        },
      },
      required: ['restaurant_id', 'item_id', 'user_id'],
    },
  },
  {
    name: 'create_payment_link',
    description: 'Create a direct Razorpay Payment Link (short_url) that can be sent to the customer via SMS/WhatsApp or opened in browser.',
    input_schema: {
      type: 'object',
      properties: {
        amount: {
          type: 'number',
          description: 'Payment amount in INR (e.g. 500 for ₹500)',
        },
        description: {
          type: 'string',
          description: 'Purpose or description of the payment link',
        },
        user_id: {
          type: 'string',
          description: 'User ID requesting the link',
        },
        expiry_minutes: {
          type: 'number',
          description: 'Link expiration time in minutes (default: 30)',
        },
      },
      required: ['amount', 'description', 'user_id'],
    },
  },
];
