import dotenv from 'dotenv';
import path from 'path';

// Load .env from server root or project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

export const config = {
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 5000,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    isMockMode: !process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID.includes('your_key') || process.env.RAZORPAY_KEY_ID.includes('placeholder'),
  },
  dbPath: process.env.DB_PATH || path.resolve(__dirname, '../data/checkout_agent.db'),
  shopify: {
    // Shopify's official public Hydrogen demo store — works out of the box with no account needed.
    // To use your own store: set SHOPIFY_STORE_DOMAIN and SHOPIFY_STOREFRONT_TOKEN in .env
    storeDomain: process.env.SHOPIFY_STORE_DOMAIN || 'hydrogen-preview.myshopify.com',
    storefrontToken: process.env.SHOPIFY_STOREFRONT_TOKEN || '3b580e70970c4528da70c98e097c2fa0',
    apiVersion: '2024-01',
  },
};
