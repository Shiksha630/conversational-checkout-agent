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

  // ── Seed Restaurants + Menus ────────────────────────────────────────────────
  console.log('🍽️  Seeding restaurants and menus...');

  // Clear existing food data (idempotent)
  db.exec(`DELETE FROM menu_items; DELETE FROM restaurants;`);

  const insertRestaurant = db.prepare(`
    INSERT INTO restaurants (id, name, cuisine, rating, delivery_fee, min_order, eta_minutes, address)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertItem = db.prepare(`
    INSERT INTO menu_items (id, restaurant_id, name, description, category, price, is_veg, stock_quantity)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // 1. Biryani House
  insertRestaurant.run('rest_bh', 'Biryani House', 'North Indian / Biryani', 4.5, 40, 199, 35, 'Sector 18, Noida');
  insertItem.run('item_bh_01', 'rest_bh', 'Chicken Biryani', 'Aromatic basmati rice with tender chicken, slow-cooked with spices', 'Biryani', 380, 0, 50);
  insertItem.run('item_bh_02', 'rest_bh', 'Veg Biryani', 'Fragrant basmati with mix vegetables and saffron', 'Biryani', 280, 1, 50);
  insertItem.run('item_bh_03', 'rest_bh', 'Mutton Biryani', 'Slow-cooked mutton with whole spices on dum', 'Biryani', 480, 0, 50);
  insertItem.run('item_bh_04', 'rest_bh', 'Raita', 'Fresh yoghurt with cucumber and mint', 'Sides', 60, 1, 50);
  insertItem.run('item_bh_05', 'rest_bh', 'Seekh Kebab (6 pcs)', 'Minced lamb kebabs on skewer with mint chutney', 'Starters', 220, 0, 50);
  insertItem.run('item_bh_06', 'rest_bh', 'Chicken Korma', 'Rich creamy chicken curry with cashew and cream', 'Curry', 320, 0, 50);

  // 2. Pizza Palace
  insertRestaurant.run('rest_pp', 'Pizza Palace', 'Italian / Pizza', 4.2, 50, 299, 30, 'Connaught Place, Delhi');
  insertItem.run('item_pp_01', 'rest_pp', 'Margherita Pizza', 'Classic tomato base with mozzarella and basil', 'Pizza', 299, 1, 50);
  insertItem.run('item_pp_02', 'rest_pp', 'Chicken BBQ Pizza', 'BBQ sauce, grilled chicken, onion, capsicum', 'Pizza', 399, 0, 50);
  insertItem.run('item_pp_03', 'rest_pp', 'Farmhouse Pizza', 'Onion, capsicum, tomato, paneer, mushroom', 'Pizza', 349, 1, 50);
  insertItem.run('item_pp_04', 'rest_pp', 'Pasta Arrabiata', 'Penne in spicy tomato sauce with garlic', 'Pasta', 259, 1, 50);
  insertItem.run('item_pp_05', 'rest_pp', 'Garlic Bread', 'Toasted bread with garlic butter and herbs', 'Sides', 129, 1, 50);
  insertItem.run('item_pp_06', 'rest_pp', 'Pepperoni Pizza', 'Tomato base, mozzarella, beef pepperoni', 'Pizza', 449, 0, 50);

  // 3. Burger Barn
  insertRestaurant.run('rest_bb', 'Burger Barn', 'American / Burgers', 4.3, 35, 149, 25, 'Koramangala, Bangalore');
  insertItem.run('item_bb_01', 'rest_bb', 'Classic Beef Burger', 'Beef patty, lettuce, tomato, cheese, pickles', 'Burgers', 249, 0, 50);
  insertItem.run('item_bb_02', 'rest_bb', 'Chicken Crispy Burger', 'Crispy fried chicken, coleslaw, mayo, brioche bun', 'Burgers', 229, 0, 50);
  insertItem.run('item_bb_03', 'rest_bb', 'Veg Aloo Tikki Burger', 'Spiced potato patty, chutney, onion, lettuce', 'Burgers', 159, 1, 50);
  insertItem.run('item_bb_04', 'rest_bb', 'French Fries (Large)', 'Crispy golden fries with dipping sauce', 'Sides', 99, 1, 50);
  insertItem.run('item_bb_05', 'rest_bb', 'Chocolate Milkshake', 'Thick chocolate shake with whipped cream', 'Drinks', 149, 1, 50);
  insertItem.run('item_bb_06', 'rest_bb', 'Double Smash Burger', 'Two smashed beef patties, American cheese, pickles', 'Burgers', 349, 0, 50);

  // 4. Dosa Corner
  insertRestaurant.run('rest_dc', 'Dosa Corner', 'South Indian', 4.6, 30, 149, 20, 'Anna Nagar, Chennai');
  insertItem.run('item_dc_01', 'rest_dc', 'Masala Dosa', 'Crispy dosa with spiced potato filling and coconut chutney', 'Dosa', 130, 1, 50);
  insertItem.run('item_dc_02', 'rest_dc', 'Paneer Dosa', 'Dosa stuffed with spiced cottage cheese and vegetables', 'Dosa', 160, 1, 50);
  insertItem.run('item_dc_03', 'rest_dc', 'Plain Dosa', 'Thin crispy plain dosa with sambar and chutney', 'Dosa', 90, 1, 50);
  insertItem.run('item_dc_04', 'rest_dc', 'Idli (3 pcs)', 'Soft steamed rice cakes with sambar and two chutneys', 'Rice & Idli', 80, 1, 50);
  insertItem.run('item_dc_05', 'rest_dc', 'Uttapam', 'Thick rice pancake with onion, tomato, chilli', 'Dosa', 120, 1, 50);
  insertItem.run('item_dc_06', 'rest_dc', 'Sambar Vada (2 pcs)', 'Crispy lentil donuts soaked in sambar', 'Starters', 100, 1, 50);

  // 5. Wok Express
  insertRestaurant.run('rest_we', 'Wok Express', 'Chinese / Asian', 4.1, 45, 199, 30, 'Bandra, Mumbai');
  insertItem.run('item_we_01', 'rest_we', 'Chicken Fried Rice', 'Wok-tossed rice with egg, chicken, spring onion', 'Rice', 219, 0, 50);
  insertItem.run('item_we_02', 'rest_we', 'Veg Hakka Noodles', 'Stir-fried noodles with mixed vegetables, soy sauce', 'Noodles', 189, 1, 50);
  insertItem.run('item_we_03', 'rest_we', 'Chilli Chicken', 'Indo-Chinese crispy chicken with bell peppers and chilli sauce', 'Starters', 279, 0, 50);
  insertItem.run('item_we_04', 'rest_we', 'Manchurian Gravy', 'Deep-fried veggie balls in spicy Manchurian sauce', 'Starters', 229, 1, 50);
  insertItem.run('item_we_05', 'rest_we', 'Momos (8 pcs)', 'Steamed dumplings with spicy chilli dip', 'Starters', 160, 1, 50);
  insertItem.run('item_we_06', 'rest_we', 'Schezwan Chicken Noodles', 'Fiery Schezwan sauce tossed with chicken and egg noodles', 'Noodles', 249, 0, 50);

  console.log('✅ Seed completed — 3 users + 5 restaurants + 30 menu items.');
}

/** Called on every server startup — only inserts restaurants if the table is empty. Safe to call repeatedly. */
export function seedRestaurantsIfEmpty() {
  const count = (db.prepare('SELECT count(*) as c FROM restaurants').get() as any).c;
  if (count > 0) {
    console.log(`🍽️  Restaurants already seeded (${count} rows) — skipping.`);
    return;
  }

  console.log('🍽️  Seeding restaurants for the first time...');

  const insertRestaurant = db.prepare(`
    INSERT OR IGNORE INTO restaurants (id, name, cuisine, rating, delivery_fee, min_order, eta_minutes, address)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertItem = db.prepare(`
    INSERT OR IGNORE INTO menu_items (id, restaurant_id, name, description, category, price, is_veg, stock_quantity)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertRestaurant.run('rest_bh', 'Biryani House', 'North Indian / Biryani', 4.5, 40, 199, 35, 'Sector 18, Noida');
  insertItem.run('item_bh_01', 'rest_bh', 'Chicken Biryani', 'Aromatic basmati rice with tender chicken, slow-cooked with spices', 'Biryani', 380, 0, 50);
  insertItem.run('item_bh_02', 'rest_bh', 'Veg Biryani', 'Fragrant basmati with mix vegetables and saffron', 'Biryani', 280, 1, 50);
  insertItem.run('item_bh_03', 'rest_bh', 'Mutton Biryani', 'Slow-cooked mutton with whole spices on dum', 'Biryani', 480, 0, 50);
  insertItem.run('item_bh_04', 'rest_bh', 'Raita', 'Fresh yoghurt with cucumber and mint', 'Sides', 60, 1, 50);
  insertItem.run('item_bh_05', 'rest_bh', 'Seekh Kebab (6 pcs)', 'Minced lamb kebabs on skewer with mint chutney', 'Starters', 220, 0, 50);
  insertItem.run('item_bh_06', 'rest_bh', 'Chicken Korma', 'Rich creamy chicken curry with cashew and cream', 'Curry', 320, 0, 50);

  insertRestaurant.run('rest_pp', 'Pizza Palace', 'Italian / Pizza', 4.2, 50, 299, 30, 'Connaught Place, Delhi');
  insertItem.run('item_pp_01', 'rest_pp', 'Margherita Pizza', 'Classic tomato base with mozzarella and basil', 'Pizza', 299, 1, 50);
  insertItem.run('item_pp_02', 'rest_pp', 'Chicken BBQ Pizza', 'BBQ sauce, grilled chicken, onion, capsicum', 'Pizza', 399, 0, 50);
  insertItem.run('item_pp_03', 'rest_pp', 'Farmhouse Pizza', 'Onion, capsicum, tomato, paneer, mushroom', 'Pizza', 349, 1, 50);
  insertItem.run('item_pp_04', 'rest_pp', 'Pasta Arrabiata', 'Penne in spicy tomato sauce with garlic', 'Pasta', 259, 1, 50);
  insertItem.run('item_pp_05', 'rest_pp', 'Garlic Bread', 'Toasted bread with garlic butter and herbs', 'Sides', 129, 1, 50);
  insertItem.run('item_pp_06', 'rest_pp', 'Pepperoni Pizza', 'Tomato base, mozzarella, beef pepperoni', 'Pizza', 449, 0, 50);

  insertRestaurant.run('rest_bb', 'Burger Barn', 'American / Burgers', 4.3, 35, 149, 25, 'Koramangala, Bangalore');
  insertItem.run('item_bb_01', 'rest_bb', 'Classic Beef Burger', 'Beef patty, lettuce, tomato, cheese, pickles', 'Burgers', 249, 0, 50);
  insertItem.run('item_bb_02', 'rest_bb', 'Chicken Crispy Burger', 'Crispy fried chicken, coleslaw, mayo, brioche bun', 'Burgers', 229, 0, 50);
  insertItem.run('item_bb_03', 'rest_bb', 'Veg Aloo Tikki Burger', 'Spiced potato patty, chutney, onion, lettuce', 'Burgers', 159, 1, 50);
  insertItem.run('item_bb_04', 'rest_bb', 'French Fries (Large)', 'Crispy golden fries with dipping sauce', 'Sides', 99, 1, 50);
  insertItem.run('item_bb_05', 'rest_bb', 'Chocolate Milkshake', 'Thick chocolate shake with whipped cream', 'Drinks', 149, 1, 50);
  insertItem.run('item_bb_06', 'rest_bb', 'Double Smash Burger', 'Two smashed beef patties, American cheese, pickles', 'Burgers', 349, 0, 50);

  insertRestaurant.run('rest_dc', 'Dosa Corner', 'South Indian', 4.6, 30, 149, 20, 'Anna Nagar, Chennai');
  insertItem.run('item_dc_01', 'rest_dc', 'Masala Dosa', 'Crispy dosa with spiced potato filling and coconut chutney', 'Dosa', 130, 1, 50);
  insertItem.run('item_dc_02', 'rest_dc', 'Paneer Dosa', 'Dosa stuffed with spiced cottage cheese and vegetables', 'Dosa', 160, 1, 50);
  insertItem.run('item_dc_03', 'rest_dc', 'Plain Dosa', 'Thin crispy plain dosa with sambar and chutney', 'Dosa', 90, 1, 50);
  insertItem.run('item_dc_04', 'rest_dc', 'Idli (3 pcs)', 'Soft steamed rice cakes with sambar and two chutneys', 'Rice & Idli', 80, 1, 50);
  insertItem.run('item_dc_05', 'rest_dc', 'Uttapam', 'Thick rice pancake with onion, tomato, chilli', 'Dosa', 120, 1, 50);
  insertItem.run('item_dc_06', 'rest_dc', 'Sambar Vada (2 pcs)', 'Crispy lentil donuts soaked in sambar', 'Starters', 100, 1, 50);

  insertRestaurant.run('rest_we', 'Wok Express', 'Chinese / Asian', 4.1, 45, 199, 30, 'Bandra, Mumbai');
  insertItem.run('item_we_01', 'rest_we', 'Chicken Fried Rice', 'Wok-tossed rice with egg, chicken, spring onion', 'Rice', 219, 0, 50);
  insertItem.run('item_we_02', 'rest_we', 'Veg Hakka Noodles', 'Stir-fried noodles with mixed vegetables, soy sauce', 'Noodles', 189, 1, 50);
  insertItem.run('item_we_03', 'rest_we', 'Chilli Chicken', 'Indo-Chinese crispy chicken with bell peppers and chilli sauce', 'Starters', 279, 0, 50);
  insertItem.run('item_we_04', 'rest_we', 'Manchurian Gravy', 'Deep-fried veggie balls in spicy Manchurian sauce', 'Starters', 229, 1, 50);
  insertItem.run('item_we_05', 'rest_we', 'Momos (8 pcs)', 'Steamed dumplings with spicy chilli dip', 'Starters', 160, 1, 50);
  insertItem.run('item_we_06', 'rest_we', 'Schezwan Chicken Noodles', 'Fiery Schezwan sauce tossed with chicken and egg noodles', 'Noodles', 249, 0, 50);

  console.log('✅ Restaurants seeded: 5 restaurants, 30 menu items.');
}

if (require.main === module) {
  seedDatabase();
}
