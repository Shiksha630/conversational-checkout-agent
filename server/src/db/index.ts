import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from '../config';

const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');

export function initDatabase() {
  // 1. Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      preferred_payment_method TEXT NOT NULL DEFAULT 'UPI',
      avatar_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Purchase History table
  db.exec(`
    CREATE TABLE IF NOT EXISTS purchase_history (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('recharge', 'subscription', 'reorder')),
      amount INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      description TEXT NOT NULL,
      metadata_json TEXT,
      date DATETIME NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // 3. Transactions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      razorpay_order_id TEXT NOT NULL,
      razorpay_payment_id TEXT,
      amount INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      status TEXT NOT NULL DEFAULT 'PENDING',
      payment_method TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // 4. Reminders table
  db.exec(`
    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      remind_date TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // 5. Restaurants table
  db.exec(`
    CREATE TABLE IF NOT EXISTS restaurants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      cuisine TEXT NOT NULL,
      rating REAL NOT NULL DEFAULT 4.0,
      delivery_fee INTEGER NOT NULL DEFAULT 40,
      min_order INTEGER NOT NULL DEFAULT 199,
      eta_minutes INTEGER NOT NULL DEFAULT 35,
      address TEXT NOT NULL,
      is_open INTEGER NOT NULL DEFAULT 1
    );
  `);

  // 6. Menu items table
  db.exec(`
     CREATE TABLE IF NOT EXISTS menu_items (
       id TEXT PRIMARY KEY,
       restaurant_id TEXT NOT NULL,
       name TEXT NOT NULL,
       description TEXT NOT NULL DEFAULT '',
       category TEXT NOT NULL DEFAULT 'Main',
       price INTEGER NOT NULL,
       is_veg INTEGER NOT NULL DEFAULT 0,
       is_available INTEGER NOT NULL DEFAULT 1,
       stock_quantity INTEGER NOT NULL DEFAULT 50,
       FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
     );
  `);

  // Migration: add stock_quantity column to existing DBs that don't have it yet
  try {
    db.exec(`ALTER TABLE menu_items ADD COLUMN stock_quantity INTEGER NOT NULL DEFAULT 50`);
  } catch (_) { /* column already exists — safe to ignore */ }

  // 7. Food orders table
  db.exec(`
    CREATE TABLE IF NOT EXISTS food_orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      restaurant_id TEXT NOT NULL,
      restaurant_name TEXT NOT NULL,
      item_id TEXT NOT NULL,
      item_name TEXT NOT NULL,
      item_price INTEGER NOT NULL,
      delivery_fee INTEGER NOT NULL,
      total_amount INTEGER NOT NULL,
      razorpay_order_id TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      eta_minutes INTEGER NOT NULL DEFAULT 35,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
}

// User repository helpers
export interface User {
  id: string;
  name: string;
  phone: string;
  email: string;
  preferred_payment_method: string;
  avatar_url?: string;
  created_at: string;
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

export const dbService = {
  getUsers(): User[] {
    return db.prepare('SELECT * FROM users ORDER BY name ASC').all() as User[];
  },

  getUserById(id: string): User | undefined {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
  },

  getUserHistory(userId: string): PurchaseHistoryItem[] {
    return db.prepare(`
      SELECT * FROM purchase_history 
      WHERE user_id = ? 
      ORDER BY date DESC
    `).all(userId) as PurchaseHistoryItem[];
  },

  getUserHistoryByType(userId: string, type: string): PurchaseHistoryItem[] {
    return db.prepare(`
      SELECT * FROM purchase_history 
      WHERE user_id = ? AND type = ? 
      ORDER BY date DESC
    `).all(userId, type) as PurchaseHistoryItem[];
  },

  createTransaction(data: {
    id: string;
    user_id: string;
    razorpay_order_id: string;
    amount: number;
    currency?: string;
    status: string;
    payment_method?: string;
    description?: string;
  }): void {
    db.prepare(`
      INSERT INTO transactions (id, user_id, razorpay_order_id, amount, currency, status, payment_method, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.id,
      data.user_id,
      data.razorpay_order_id,
      data.amount,
      data.currency || 'INR',
      data.status,
      data.payment_method || null,
      data.description || null
    );
  },

  updateTransactionStatus(orderId: string, status: string, paymentId?: string): void {
    if (paymentId) {
      db.prepare(`
        UPDATE transactions 
        SET status = ?, razorpay_payment_id = ? 
        WHERE razorpay_order_id = ?
      `).run(status, paymentId, orderId);
    } else {
      db.prepare(`
        UPDATE transactions 
        SET status = ? 
        WHERE razorpay_order_id = ?
      `).run(status, orderId);
    }
  },

  getTransactions(userId: string): Transaction[] {
    return db.prepare(`
      SELECT * FROM transactions 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `).all(userId) as Transaction[];
  },

  createReminder(data: {
    id: string;
    user_id: string;
    remind_date: string;
    description: string;
  }): void {
    db.prepare(`
      INSERT INTO reminders (id, user_id, remind_date, description, status)
      VALUES (?, ?, ?, ?, 'ACTIVE')
    `).run(data.id, data.user_id, data.remind_date, data.description);
  },

  getReminders(userId: string): Reminder[] {
    return db.prepare(`
      SELECT * FROM reminders 
      WHERE user_id = ? 
      ORDER BY remind_date ASC
    `).all(userId) as Reminder[];
  },

  // ─── Food ordering ────────────────────────────────────────────────────────

  searchRestaurants(query: string): Restaurant[] {
    const q = `%${query.toLowerCase()}%`;
    return db.prepare(`
      SELECT * FROM restaurants
      WHERE is_open = 1
        AND (LOWER(name) LIKE ? OR LOWER(cuisine) LIKE ?)
      ORDER BY rating DESC
      LIMIT 5
    `).all(q, q) as Restaurant[];
  },

  getRestaurantByName(name: string): Restaurant | undefined {
    return db.prepare(`
      SELECT * FROM restaurants
      WHERE is_open = 1 AND LOWER(name) LIKE ?
      LIMIT 1
    `).get(`%${name.toLowerCase()}%`) as Restaurant | undefined;
  },

  getMenuItems(restaurantId: string): MenuItem[] {
    return db.prepare(`
      SELECT * FROM menu_items
      WHERE restaurant_id = ? AND is_available = 1
      ORDER BY category, name
    `).all(restaurantId) as MenuItem[];
  },

  searchMenuItem(restaurantId: string, query: string): MenuItem | undefined {
    const q = `%${query.toLowerCase()}%`;
    return db.prepare(`
      SELECT * FROM menu_items
      WHERE restaurant_id = ? AND is_available = 1
        AND LOWER(name) LIKE ?
      ORDER BY name
      LIMIT 1
    `).get(restaurantId, q) as MenuItem | undefined;
  },

  createFoodOrder(data: {
    id: string;
    user_id: string;
    restaurant_id: string;
    restaurant_name: string;
    item_id: string;
    item_name: string;
    item_price: number;
    delivery_fee: number;
    total_amount: number;
    razorpay_order_id?: string;
    eta_minutes: number;
  }): void {
    db.prepare(`
      INSERT INTO food_orders
        (id, user_id, restaurant_id, restaurant_name, item_id, item_name,
         item_price, delivery_fee, total_amount, razorpay_order_id, status, eta_minutes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)
    `).run(
      data.id, data.user_id, data.restaurant_id, data.restaurant_name,
      data.item_id, data.item_name, data.item_price, data.delivery_fee,
      data.total_amount, data.razorpay_order_id ?? null, data.eta_minutes
    );
  },

  updateFoodOrderStatus(id: string, status: string, razorpayOrderId?: string): void {
    if (razorpayOrderId) {
      db.prepare(`UPDATE food_orders SET status = ?, razorpay_order_id = ? WHERE id = ?`)
        .run(status, razorpayOrderId, id);
    } else {
      db.prepare(`UPDATE food_orders SET status = ? WHERE id = ?`).run(status, id);
    }
  },

  getFoodOrders(userId: string): FoodOrder[] {
    return db.prepare(`
      SELECT * FROM food_orders WHERE user_id = ? ORDER BY created_at DESC
    `).all(userId) as FoodOrder[];
  },

  getMenuItemById(itemId: string): MenuItem | undefined {
    return db.prepare(`SELECT * FROM menu_items WHERE id = ?`).get(itemId) as MenuItem | undefined;
  },

  decrementStock(itemId: string): { success: boolean; newStock: number } {
    const item = db.prepare(`SELECT stock_quantity FROM menu_items WHERE id = ?`).get(itemId) as any;
    if (!item || item.stock_quantity <= 0) {
      return { success: false, newStock: 0 };
    }
    db.prepare(`UPDATE menu_items SET stock_quantity = stock_quantity - 1 WHERE id = ?`).run(itemId);
    const updated = db.prepare(`SELECT stock_quantity FROM menu_items WHERE id = ?`).get(itemId) as any;
    return { success: true, newStock: updated.stock_quantity };
  },

  restockItem(itemId: string, quantity: number = 50): void {
    db.prepare(`UPDATE menu_items SET stock_quantity = ?, is_available = 1 WHERE id = ?`).run(quantity, itemId);
  },
};

// ─── New food-ordering types ──────────────────────────────────────────────────
export interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
  rating: number;
  delivery_fee: number;
  min_order: number;
  eta_minutes: number;
  address: string;
  is_open: number;
}

export interface MenuItem {
  id: string;
  restaurant_id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  is_veg: number;
  is_available: number;
  stock_quantity: number;
}

export interface FoodOrder {
  id: string;
  user_id: string;
  restaurant_id: string;
  restaurant_name: string;
  item_id: string;
  item_name: string;
  item_price: number;
  delivery_fee: number;
  total_amount: number;
  razorpay_order_id?: string;
  status: string;
  eta_minutes: number;
  created_at: string;
}
