import { db, initDatabase } from './index';

export function seedDatabase() {
  initDatabase();

  // Clear existing records
  db.exec(`
    DELETE FROM reminders;
    DELETE FROM transactions;
    DELETE FROM purchase_history;
    DELETE FROM users;
  `);

  console.log('🌱 Seeding users...');

  // 1. Insert Users
  const insertUser = db.prepare(`
    INSERT INTO users (id, name, phone, email, preferred_payment_method, avatar_url)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertUser.run(
    'usr_rahul',
    'Rahul Sharma',
    '+91 98765 43210',
    'rahul.sharma@example.com',
    'UPI (rahul@okhdfcbank)',
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'
  );

  insertUser.run(
    'usr_priya',
    'Priya Patel',
    '+91 98112 23344',
    'priya.patel@example.com',
    'Credit Card (HDFC Regalia •••• 4821)',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80'
  );

  insertUser.run(
    'usr_ananya',
    'Ananya Roy',
    '+91 99887 76655',
    'ananya.roy@example.com',
    'UPI (ananya@paytm)',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80'
  );

  console.log('🌱 Seeding purchase history...');

  // 2. Insert Purchase History
  const insertHistory = db.prepare(`
    INSERT INTO purchase_history (id, user_id, type, amount, currency, description, metadata_json, date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Rahul's history (Recharges & quick utilities)
  insertHistory.run(
    'hist_101',
    'usr_rahul',
    'recharge',
    399,
    'INR',
    'Airtel 5G Unlimited Prepaid (28 Days, 2GB/day + Unlimited 5G + Disney+ Hotstar Mobile)',
    JSON.stringify({ operator: 'Airtel', plan_code: 'AIR_399_28D', validity: '28 Days', data: '2GB/day' }),
    '2026-07-23 10:30:00'
  );

  insertHistory.run(
    'hist_102',
    'usr_rahul',
    'recharge',
    399,
    'INR',
    'Airtel 5G Unlimited Prepaid (28 Days, 2GB/day + Unlimited 5G)',
    JSON.stringify({ operator: 'Airtel', plan_code: 'AIR_399_28D', validity: '28 Days', data: '2GB/day' }),
    '2026-06-25 14:15:00'
  );

  insertHistory.run(
    'hist_103',
    'usr_rahul',
    'subscription',
    149,
    'INR',
    'Netflix Mobile Monthly Subscription',
    JSON.stringify({ provider: 'Netflix', tier: 'Mobile', screens: 1 }),
    '2026-08-01 09:00:00'
  );

  // Priya's history (Gym, Fitness, Lifestyle Subscriptions)
  insertHistory.run(
    'hist_201',
    'usr_priya',
    'subscription',
    1499,
    'INR',
    'Cultpass ELITE Monthly Membership (All Centers Access + Unlimited Group Classes)',
    JSON.stringify({ gym: 'Cult.fit', center: 'Indiranagar Bangalore', pass_type: 'ELITE' }),
    '2026-07-21 18:20:00'
  );

  insertHistory.run(
    'hist_202',
    'usr_priya',
    'subscription',
    149,
    'INR',
    'Spotify Premium Individual Monthly',
    JSON.stringify({ provider: 'Spotify', tier: 'Individual' }),
    '2026-08-05 11:00:00'
  );

  insertHistory.run(
    'hist_203',
    'usr_priya',
    'reorder',
    590,
    'INR',
    'Blue Tokai Coffee Roasters - Attikan Estate Medium Dark Roast (500g, French Press)',
    JSON.stringify({ roaster: 'Blue Tokai', grind: 'French Press', weight: '500g' }),
    '2026-08-10 16:45:00'
  );

  // Ananya's history (Coffee & Food reorders)
  insertHistory.run(
    'hist_301',
    'usr_ananya',
    'reorder',
    420,
    'INR',
    'Third Wave Coffee - Oat Milk Vanilla Latte (Large) + Butter Almond Croissant',
    JSON.stringify({ merchant: 'Third Wave Coffee', items: ['Oat Milk Vanilla Latte (L)', 'Butter Almond Croissant'] }),
    '2026-08-18 08:30:00'
  );

  insertHistory.run(
    'hist_302',
    'usr_ananya',
    'reorder',
    420,
    'INR',
    'Third Wave Coffee - Oat Milk Vanilla Latte (Large) + Butter Almond Croissant',
    JSON.stringify({ merchant: 'Third Wave Coffee', items: ['Oat Milk Vanilla Latte (L)', 'Butter Almond Croissant'] }),
    '2026-08-15 08:45:00'
  );

  insertHistory.run(
    'hist_303',
    'usr_ananya',
    'recharge',
    299,
    'INR',
    'Jio True 5G Prepaid (28 Days, 1.5GB/day)',
    JSON.stringify({ operator: 'Jio', plan_code: 'JIO_299_28D' }),
    '2026-07-28 12:00:00'
  );

  console.log('✅ Seed completed successfully with 3 users and realistic purchase history.');
}

if (require.main === module) {
  seedDatabase();
}
