import { dbService } from '../db';
import { razorpayService } from '../services/razorpay';
import { eventBus } from '../events/eventBus';
import { searchProducts, getProduct, createCart, toINR } from '../services/shopify';

export async function executeTool(name: string, input: any): Promise<any> {
  switch (name) {
    case 'get_user_history': {
      const { user_id } = input;
      const user = dbService.getUserById(user_id);
      if (!user) {
        return { error: `User with ID ${user_id} not found in database.` };
      }

      const history = dbService.getUserHistory(user_id);
      
      eventBus.emitEvent(
        'USER_HISTORY_RETRIEVED',
        `User Profile & History Loaded: ${user.name}`,
        `Retrieved ${history.length} past purchases. Preferred payment: ${user.preferred_payment_method}`,
        { userId: user_id, userName: user.name, itemsCount: history.length }
      );

      return {
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          preferred_payment_method: user.preferred_payment_method,
        },
        recent_purchases: history.map((item) => ({
          type: item.type,
          amount: item.amount,
          currency: item.currency,
          description: item.description,
          date: item.date,
          metadata: item.metadata_json ? JSON.parse(item.metadata_json) : null,
        })),
        summary: `User ${user.name} typically prefers ${user.preferred_payment_method}. Has ${history.length} historical transactions on record.`,
      };
    }

    case 'create_payment_order': {
      const { amount, method, description, user_id } = input;
      const user = dbService.getUserById(user_id);

      const order = await razorpayService.createOrder({
        amount,
        description,
        notes: {
          user_id,
          method,
          customer_name: user?.name || 'Customer',
        },
      });

      // Save pending transaction in SQLite
      const txnId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      dbService.createTransaction({
        id: txnId,
        user_id,
        razorpay_order_id: order.id,
        amount,
        currency: order.currency,
        status: 'PENDING',
        payment_method: method,
        description,
      });

      eventBus.emitEvent(
        'AGENT_PROPOSAL_DISPATCHED',
        `Payment Proposal Created: ₹${amount}`,
        `Razorpay Order ${order.id} generated for ${description} via ${method}`,
        { orderId: order.id, amount, method, description }
      );

      return {
        success: true,
        order_id: order.id,
        amount: order.amount / 100,
        amount_paise: order.amount,
        currency: order.currency,
        key_id: razorpayService.getKeyId(),
        method,
        description,
        is_mock: order.is_mock,
        user: {
          name: user?.name,
          email: user?.email,
          phone: user?.phone,
        },
        action_required: 'SHOW_CHECKOUT_CONFIRMATION',
      };
    }

    case 'verify_payment': {
      const { payment_id, order_id, signature } = input;
      const result = await razorpayService.verifyPayment(order_id, payment_id, signature);

      if (result.success) {
        dbService.updateTransactionStatus(order_id, 'SUCCESS', payment_id);
      }

      return {
        verified: result.success,
        payment_id: result.paymentId,
        order_id,
        status: result.status,
      };
    }

    case 'log_transaction': {
      const { user_id, order_id, payment_id, amount, status, payment_method, description } = input;
      
      dbService.updateTransactionStatus(order_id, status || 'SUCCESS', payment_id);

      eventBus.emitEvent(
        'TRANSACTION_COMMITTED',
        `Transaction Finalized (${status || 'SUCCESS'})`,
        `Logged payment ${payment_id || 'N/A'} for Order ${order_id} (₹${amount}) in database.`,
        { user_id, order_id, payment_id, amount, status }
      );

      return {
        success: true,
        message: `Transaction recorded with status ${status || 'SUCCESS'}`,
        timestamp: new Date().toISOString(),
      };
    }

    case 'schedule_reminder': {
      const { user_id, remind_date, description } = input;
      
      // If relative date like "in 28 days" or "28 days", calculate standard date
      let targetDate = remind_date;
      if (remind_date.toLowerCase().includes('day') || remind_date.toLowerCase().includes('month')) {
        const d = new Date();
        if (remind_date.includes('28')) d.setDate(d.getDate() + 28);
        else if (remind_date.includes('30') || remind_date.includes('month')) d.setDate(d.getDate() + 30);
        else d.setDate(d.getDate() + 7);
        targetDate = d.toISOString().split('T')[0];
      }

      const reminderId = `rem_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
      dbService.createReminder({
        id: reminderId,
        user_id,
        remind_date: targetDate,
        description,
      });

      eventBus.emitEvent(
        'REMINDER_SCHEDULED',
        `Proactive Commerce Reminder Set`,
        `Reminder scheduled for ${targetDate}: "${description}"`,
        { reminderId, userId: user_id, date: targetDate, description }
      );

      return {
        success: true,
        reminder_id: reminderId,
        remind_date: targetDate,
        description,
        message: `Proactive reminder set for ${targetDate}`,
      };
    }

    // ─── SHOPIFY STOREFRONT TOOLS ──────────────────────────────────────────────
    case 'shopify_search_products': {
      const { query, limit = 4 } = input;

      eventBus.emitEvent(
        'USER_INTENT_PARSED',
        `Searching Shopify: "${query}"`,
        `Looking up products on Shopify store for query: ${query}`,
        { query }
      );

      const products = await searchProducts(query, Math.min(limit, 5));

      if (products.length === 0) {
        return { found: false, message: `No products found for "${query}" on the Shopify store.`, products: [] };
      }

      const formatted = products.map((p, i) => ({
        index: i + 1,
        id: p.id,
        title: p.title,
        vendor: p.vendor,
        description: p.description,
        price_usd: p.priceRange.min === p.priceRange.max
          ? `$${p.priceRange.min}`
          : `$${p.priceRange.min} – $${p.priceRange.max}`,
        price_inr: `₹${toINR(p.priceRange.min)}${p.priceRange.min !== p.priceRange.max ? ` – ₹${toINR(p.priceRange.max)}` : ''}`,
        variants_count: p.variants.length,
        first_variant_id: p.variants[0]?.id,
        image_url: p.imageUrl,
      }));

      eventBus.emitEvent(
        'USER_HISTORY_RETRIEVED',
        `Shopify Search: ${products.length} products found`,
        `Found ${products.length} products for "${query}"`,
        { query, count: products.length }
      );

      return { found: true, query, products: formatted, total: products.length };
    }

    case 'shopify_select_product': {
      const { product_id } = input;
      const product = await getProduct(product_id);

      if (!product) {
        return { found: false, message: `Product not found: ${product_id}` };
      }

      return {
        found: true,
        id: product.id,
        title: product.title,
        vendor: product.vendor,
        description: product.description,
        variants: product.variants.map((v, i) => ({
          index: i + 1,
          id: v.id,
          name: v.title,
          price_usd: `$${v.price}`,
          price_inr: `₹${toINR(v.price)}`,
          in_stock: v.available,
        })),
      };
    }

    case 'shopify_create_cart': {
      const { variant_id, quantity = 1, user_id } = input;
      const user = dbService.getUserById(user_id);

      eventBus.emitEvent(
        'AGENT_PROPOSAL_DISPATCHED',
        'Creating Shopify Cart',
        `Adding variant ${variant_id} × ${quantity} to Shopify cart`,
        { variant_id, quantity }
      );

      const cart = await createCart(variant_id, quantity);
      const amountINR = toINR(cart.totalAmount);

      // Build description from cart lines
      const itemsDesc = cart.lines.map(l => `${l.quantity}× ${l.title}`).join(', ');
      const description = `Shopify Order: ${itemsDesc}`;

      // Create Razorpay order for the INR equivalent
      const order = await razorpayService.createOrder({
        amount: amountINR,
        description,
        notes: {
          user_id,
          shopify_cart_id: cart.cartId,
          shopify_checkout_url: cart.checkoutUrl,
          customer_name: user?.name || 'Customer',
        },
      });

      // Save pending transaction
      const txnId = `txn_shopify_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      dbService.createTransaction({
        id: txnId,
        user_id,
        razorpay_order_id: order.id,
        amount: amountINR,
        currency: 'INR',
        status: 'PENDING',
        payment_method: user?.preferred_payment_method || 'UPI',
        description,
      });

      eventBus.emitEvent(
        'AGENT_PROPOSAL_DISPATCHED',
        `Shopify + Razorpay Order Ready: ₹${amountINR}`,
        `Cart created (${cart.cartId}). Razorpay order ${order.id} for ₹${amountINR}`,
        { cartId: cart.cartId, orderId: order.id, amountINR }
      );

      return {
        success: true,
        shopify_cart_id: cart.cartId,
        shopify_checkout_url: cart.checkoutUrl,
        items: cart.lines,
        original_price_usd: `$${cart.totalAmount}`,
        amount_inr: amountINR,
        razorpay_order_id: order.id,
        razorpay_amount_paise: order.amount,
        razorpay_key_id: razorpayService.getKeyId(),
        payment_method: user?.preferred_payment_method || 'UPI',
        currency: 'INR',
        is_mock: order.is_mock,
        user: { name: user?.name, email: user?.email, phone: user?.phone },
        description,
        action_required: 'SHOW_CHECKOUT_CONFIRMATION',
      };
    }

    // ─── Food Ordering Tools ────────────────────────────────────────────────

    case 'food_search_restaurant': {
      const { query } = input;
      const restaurants = dbService.searchRestaurants(query);

      if (restaurants.length === 0) {
        return {
          found: false,
          message: `No restaurants found matching "${query}". Available restaurants: Biryani House, Pizza Palace, Burger Barn, Dosa Corner, Wok Express.`,
        };
      }

      // Attach menu to each result
      const results = restaurants.map((r) => ({
        id: r.id,
        name: r.name,
        cuisine: r.cuisine,
        rating: r.rating,
        delivery_fee: r.delivery_fee,
        min_order: r.min_order,
        eta_minutes: r.eta_minutes,
        address: r.address,
        menu: dbService.getMenuItems(r.id).map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          category: item.category,
          price: item.price,
          price_display: `₹${item.price}`,
          is_veg: item.is_veg === 1,
        })),
      }));

      return { found: true, count: results.length, restaurants: results };
    }

    case 'food_place_order': {
      const { restaurant_id, item_id, user_id } = input;

      const user = dbService.getUserById(user_id);

      // Fetch menu items and the target item
      const allMenuItems = dbService.getMenuItems(restaurant_id);
      const item = allMenuItems.find((m) => m.id === item_id);
      if (!item) {
        return { success: false, error: `Menu item ${item_id} not found in restaurant ${restaurant_id}.` };
      }

      // ── REQ 1: CHECK STOCK before placing ───────────────────────────────────
      const stockCheck = dbService.decrementStock(item_id);
      if (!stockCheck.success) {
        // Mark item unavailable and suggest alternatives
        const alternatives = allMenuItems
          .filter((m) => m.id !== item_id && m.stock_quantity > 0)
          .slice(0, 3)
          .map((m) => `${m.name} (₹${m.price})`);

        eventBus.emitEvent(
          'SYSTEM_LOG',
          `Out of Stock: ${item.name}`,
          `Item ${item.id} is sold out. Alternatives: ${alternatives.join(', ')}`,
          { item_id, restaurant_id }
        );

        return {
          success: false,
          out_of_stock: true,
          error: `❌ **${item.name}** is currently sold out.`,
          alternatives: alternatives.length > 0 ? alternatives : null,
          item_name: item.name,
          restaurant_id,
        };
      }

      // Fetch restaurant row directly from DB
      const { db } = require('../db') as typeof import('../db');
      const restData = (db as any).prepare('SELECT * FROM restaurants WHERE id = ?').get(restaurant_id) as any;
      if (!restData) {
        return { success: false, error: `Restaurant ${restaurant_id} not found.` };
      }

      const itemPrice = item.price;
      const deliveryFee = restData.delivery_fee;
      const totalAmount = itemPrice + deliveryFee;

      // Create Razorpay order
      const description = `${item.name} from ${restData.name}`;
      const order = await razorpayService.createOrder({
        amount: totalAmount,
        currency: 'INR',
        description,
        notes: { type: 'food_order', restaurant: restData.name, item: item.name },
      });

      // Persist food order
      const foodOrderId = `food_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      dbService.createFoodOrder({
        id: foodOrderId,
        user_id,
        restaurant_id,
        restaurant_name: restData.name,
        item_id,
        item_name: item.name,
        item_price: itemPrice,
        delivery_fee: deliveryFee,
        total_amount: totalAmount,
        razorpay_order_id: order.id,
        eta_minutes: restData.eta_minutes,
      });

      eventBus.emitEvent(
        'PAYMENT_ORDER_INITIATED',
        `Food Order Created: ${item.name} from ${restData.name}`,
        `₹${itemPrice} + ₹${deliveryFee} delivery = ₹${totalAmount} total. Razorpay order ${order.id}. Stock remaining: ${stockCheck.newStock}`,
        { foodOrderId, restaurantName: restData.name, itemName: item.name, total: totalAmount, stockRemaining: stockCheck.newStock }
      );

      return {
        success: true,
        food_order_id: foodOrderId,
        stock_remaining: stockCheck.newStock,
        restaurant: {
          id: restData.id,
          name: restData.name,
          cuisine: restData.cuisine,
          rating: restData.rating,
          address: restData.address,
          eta_minutes: restData.eta_minutes,
        },
        item: {
          id: item.id,
          name: item.name,
          description: item.description,
          category: item.category,
          is_veg: item.is_veg === 1,
          stock_remaining: stockCheck.newStock,
        },
        pricing: {
          item_price: itemPrice,
          item_price_display: `₹${itemPrice}`,
          delivery_fee: deliveryFee,
          delivery_fee_display: `₹${deliveryFee}`,
          total_amount: totalAmount,
          total_display: `₹${totalAmount}`,
        },
        razorpay_order_id: order.id,
        razorpay_amount_paise: order.amount,
        razorpay_key_id: razorpayService.getKeyId(),
        payment_method: user?.preferred_payment_method || 'UPI',
        currency: 'INR',
        is_mock: order.is_mock,
        user: { name: user?.name, email: user?.email, phone: user?.phone },
        action_required: 'SHOW_FOOD_ORDER_CONFIRMATION',
      };
    }

    case 'create_payment_link': {
      const { amount, description, user_id, expiry_minutes = 30 } = input;
      const user = dbService.getUserById(user_id);

      const linkResult = await razorpayService.createPaymentLink({
        amount,
        description,
        customerName: user?.name,
        customerEmail: user?.email,
        customerPhone: user?.phone,
        expiryMinutes: expiry_minutes,
        notes: { user_id, purpose: description },
      });

      return {
        success: true,
        payment_link_id: linkResult.id,
        short_url: linkResult.short_url,
        amount: linkResult.amount,
        description,
        expires_in_minutes: expiry_minutes,
        is_mock: linkResult.is_mock,
        message: `Payment Link created: ${linkResult.short_url}`,
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
