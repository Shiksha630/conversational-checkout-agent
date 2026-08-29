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
  }
};
