import express, { Request, Response } from 'express';
import cors from 'cors';
import { config } from './config';
import { dbService, initDatabase } from './db';
import { seedDatabase, seedRestaurantsIfEmpty } from './db/seed';
import { processChat } from './services/claude';
import { executeTool } from './tools/handlers';
import { eventBus } from './events/eventBus';

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

// Initialize DB schema and auto-seed restaurants (idempotent)
initDatabase();
seedRestaurantsIfEmpty();

// 1. Health & Config check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    razorpay_mode: config.razorpay.isMockMode ? 'mock_sandbox' : 'live_test',
    anthropic_configured: Boolean(config.anthropicApiKey && !config.anthropicApiKey.includes('your_anthropic')),
  });
});

// 2. Chat Endpoint (Agent interaction)
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { userId, message, history } = req.body;

    if (!userId || !message) {
      return res.status(400).json({ error: 'userId and message are required.' });
    }

    const response = await processChat(String(userId), history || [], String(message));
    res.json(response);
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error?.message || 'Internal server error processing agent chat.' });
  }
});

// 3. User & History Endpoints
app.get('/api/users', (req: Request, res: Response) => {
  const users = dbService.getUsers();
  res.json(users);
});

app.get('/api/users/:id', (req: Request, res: Response) => {
  const userId = String(req.params.id);
  const user = dbService.getUserById(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  const history = dbService.getUserHistory(userId);
  const transactions = dbService.getTransactions(userId);
  const reminders = dbService.getReminders(userId);

  res.json({
    user,
    history,
    transactions,
    reminders,
  });
});

// 4. Payment Verification & Webhook Endpoint
app.post('/api/payment/verify', async (req: Request, res: Response) => {
  try {
    const { orderId, paymentId, signature, userId, amount, method, description } = req.body;

    const verifyResult = await executeTool('verify_payment', {
      order_id: String(orderId),
      payment_id: String(paymentId),
      signature: signature ? String(signature) : undefined,
    });

    if (verifyResult.verified) {
      await executeTool('log_transaction', {
        user_id: String(userId),
        order_id: String(orderId),
        payment_id: String(paymentId),
        amount: Number(amount) || 0,
        status: 'SUCCESS',
        payment_method: method ? String(method) : 'UPI',
        description: description ? String(description) : 'Conversational Checkout Order',
      });
    }

    res.json(verifyResult);
  } catch (error: any) {
    console.error('Payment verification error:', error);
    res.status(500).json({ error: error?.message || 'Verification failed' });
  }
});

// 5. Architecture Events SSE Stream & JSON Endpoint
app.get('/api/events', (req: Request, res: Response) => {
  res.json(eventBus.getRecentEvents(30));
});

app.get('/api/events/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const onEvent = (event: any) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  eventBus.on('architecture_event', onEvent);

  req.on('close', () => {
    eventBus.off('architecture_event', onEvent);
  });
});

// 6. Transactions & Reminders endpoints
app.get('/api/transactions/:userId', (req: Request, res: Response) => {
  const userId = String(req.params.userId);
  const transactions = dbService.getTransactions(userId);
  res.json(transactions);
});

app.get('/api/reminders/:userId', (req: Request, res: Response) => {
  const userId = String(req.params.userId);
  const reminders = dbService.getReminders(userId);
  res.json(reminders);
});

// 7. Merchant Catalog & Food Orders (Track 1 Agent-Readable Catalog)
app.get('/api/catalog', (req: Request, res: Response) => {
  const restaurants = dbService.searchRestaurants('');
  const catalog = restaurants.map((r) => ({
    ...r,
    menu: dbService.getMenuItems(r.id),
  }));
  res.json({
    merchant_type: 'restaurant_network',
    count: catalog.length,
    restaurants: catalog,
  });
});

app.get('/api/food-orders/:userId', (req: Request, res: Response) => {
  const userId = String(req.params.userId);
  const orders = dbService.getFoodOrders(userId);
  res.json(orders);
});

// 8. Seed / Reset Endpoint
app.post('/api/seed', (req: Request, res: Response) => {
  seedDatabase();
  eventBus.emitEvent('SYSTEM_LOG', 'Database Reset & Re-seeded', 'Reset users, transactions, and reminders.');
  res.json({ success: true, message: 'Database reset to initial demo state.' });
});

app.listen(config.port, () => {
  console.log(`🚀 Razorpay Conversational Checkout Server running at http://localhost:${config.port}`);
});
