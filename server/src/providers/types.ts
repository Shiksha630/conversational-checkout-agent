// ─── Unified Product Model ────────────────────────────────────────────────────
// All product providers (Shopify, WooCommerce, future) map their data to this.

export interface UnifiedVariant {
  id: string;
  name: string;          // "154cm / Black", "Medium / Blue"
  priceINR: number;
  priceDisplay: string;  // "₹42,000"
  inStock: boolean;
}

export interface UnifiedProduct {
  id: string;
  variantId: string;     // default/cheapest variant id
  title: string;
  vendor: string;
  priceINR: number;      // lowest variant price in INR
  priceDisplay: string;  // "₹42,000"
  description: string;
  imageUrl: string | null;
  inStock: boolean;
  variants: UnifiedVariant[];
  source: 'shopify' | 'woocommerce';
  externalUrl?: string;
}

// ─── Structured Product Intent ────────────────────────────────────────────────
// Extracted from user message — budget + preferences + sort intent.

export interface ProductIntent {
  query: string;               // "wireless headphones"
  budget: number | null;       // INR — null means no budget constraint
  preferences: string[];       // ["black", "wireless", "large"]
  sort: 'price_asc' | 'price_desc' | 'best_match';
}

// ─── Shopping State Machine ───────────────────────────────────────────────────

export type ShoppingState =
  | 'IDLE'
  | 'SEARCHING'
  | 'PRODUCTS_SHOWN'
  | 'PRODUCT_SELECTED'
  | 'VARIANT_SELECTION'   // has multiple variants — waiting for user to pick
  | 'CART_CREATED'
  | 'PAYMENT_PENDING'
  | 'ORDER_CONFIRMED'
  // ─── Food ordering states ──────────────────────
  | 'FOOD_SEARCHING'          // searching for restaurant + item
  | 'FOOD_RESTAURANT_FOUND'   // restaurant found, waiting for item selection
  | 'FOOD_ORDER_CONFIRMATION' // confirmation card shown, waiting for confirm/pay
  | 'FOOD_ORDER_PLACED';      // payment done

export type CommerceIntent =
  | 'NEW_SEARCH'        // "I want tops", "show me headphones"
  | 'REFINEMENT'        // "cheaper ones", "under ₹1000", "in black"
  | 'SELECTION'         // "1", "option 2", "the first one"
  | 'VARIANT_PICK'      // "black", "medium", "154cm" — after variant prompt
  | 'CHECKOUT'          // "pay now", "proceed to checkout"
  | 'HISTORY_REORDER'   // "recharge my phone", "renew gym"
  | 'REMINDER'          // "remind me", "set alert"
  | 'FOOD_ORDER'        // "order chicken biryani from biryani house"
  | 'GENERAL';          // anything else

export interface IntentResult {
  intent: CommerceIntent;
  productIntent: ProductIntent | null;
  foodIntent: FoodIntent | null;
}

export interface ShoppingSession {
  state: ShoppingState;
  productIntent: ProductIntent | null;
  searchResults: UnifiedProduct[];
  selectedProduct: UnifiedProduct | null;
  selectedVariantId: string | null;
  cartId: string | null;
  razorpayOrderId: string | null;
  lastUpdated: number;
  // ─── Food ordering ──────────────────────────────
  foodOrderData?: FoodOrderData;
}

// ─── Food ordering types ──────────────────────────────────────────────────────

export interface FoodIntent {
  item: string;           // "chicken biryani"
  restaurant: string;     // "biryani house"
  rawQuery: string;       // original user message
}

export interface FoodOrderData {
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
}
