# ⚡ Conversational Checkout Agent
> **Razorpay AI Buildathon 2026 — Track 1: AI Growth & Agentic Commerce**  
> An autonomous AI Commerce Agent that bridges buyers and merchants through machine-readable catalogs, executes end-to-end purchasing on Razorpay test rails, strictly enforces safety boundaries (Explainable, Bounded, Gated, Auditable), and handles real-world commerce failures gracefully.

---

## 🎯 What is this Project?

This project is a working prototype of **Agentic Commerce powered by Razorpay Test-Mode APIs**. 

Instead of scraping fragile, third-party platforms (which violates ToS and breaks during UI updates), this project demonstrates how merchants make themselves **directly legible and transactable to an AI buyer** (following emerging standards like ACP/AP2 and NPCI's Universal Authenticator Protocol).

The system consists of two cleanly separated layers:
1. **The Merchant Layer:** A self-hosted, machine-readable SQLite multi-merchant catalog with real inventory tracking and stock decrements.
2. **The AI Buyer Agent:** An autonomous, multi-turn reasoning agent that searches menus, filters by diet and budget, enforces spend safety limits, generates real Razorpay orders & payment links, and streams an audit trail in real-time.

---

## 🏆 Track 1: Requirements & Ground Truth Verification Matrix

| Track 1 Requirement | How It Is Implemented in This Codebase | Code Evidence & Verification |
|---|---|---|
| **1. Merchant / Shop (Own Catalog & Stock)** | • Product catalog in our own SQLite database (`restaurants`, `menu_items`) with structured fields (`name`, `price`, `stock_quantity`, `is_veg`, `category`).<br>• Inventory decrements atomically on every order placed.<br>• Exposes `GET /api/catalog` for machine inspection. | [`server/src/db/index.ts`](server/src/db/index.ts)<br>[`server/src/tools/handlers.ts`](server/src/tools/handlers.ts)<br>`GET /api/catalog` |
| **2. Autonomous Conversational Agent** | • Multi-turn reasoning agent (Claude 3.5 Sonnet + State Machine fallback).<br>• Dynamically queries and matches items across merchant menus based on natural language requests.<br>• Generates structured order proposals without hardcoded one-off logic. | [`server/src/services/claude.ts`](server/src/services/claude.ts)<br>[`server/src/tools/definitions.ts`](server/src/tools/definitions.ts) |
| **3. Razorpay Integration (Test Mode)** | • **Orders API:** Calls `razorpay.orders.create` to create live test orders with real IDs (e.g. `order_TYDzZeWOLZd2XN`).<br>• **Payment Links API:** Calls `razorpay.paymentLink.create` for shareable short URLs.<br>• **Verification:** HMAC-SHA256 signature verification & `payments.fetch`. | [`server/src/services/razorpay.ts`](server/src/services/razorpay.ts)<br>[`server/src/index.ts`](server/src/index.ts) |
| **4. The Bar: Explainable** | Before dispatching any payment order, the agent explicitly narrates *why* it chose the item: `🧠 Agent Reasoning: I matched 'Chicken Biryani' → Chicken Biryani (🔴 Non-Veg, ₹380) at Biryani House — closest match to your request.` | [`server/src/services/claude.ts`](server/src/services/claude.ts) |
| **4. The Bar: Bounded** | Strict per-order safety spend cap (`FOOD_SPEND_CAP = ₹2000`) enforced before checkout. Orders exceeding this limit halt and demand explicit re-confirmation. | [`server/src/services/claude.ts`](server/src/services/claude.ts) |
| **4. The Bar: Gated** | Money is NEVER automatically debited. The agent creates an order draft and renders an interactive `<FoodOrderCard />` proposal requiring explicit user button approval. | [`client/src/components/FoodOrderCard.tsx`](client/src/components/FoodOrderCard.tsx) |
| **4. The Bar: Auditable** | Every state transition (`USER_INTENT_PARSED` → `PAYMENT_ORDER_INITIATED` → `PAYMENT_CAPTURED` → `TRANSACTION_COMMITTED`) is recorded in the SQLite ledger and broadcast via Server-Sent Events (SSE). | [`server/src/events/eventBus.ts`](server/src/events/eventBus.ts)<br>`GET /api/events/stream` |
| **5. Failure Handling** | • **Out-of-Stock:** When `stock_quantity = 0`, order halts and suggests 3 in-stock alternatives.<br>• **Ambiguous Request:** Prompts for restaurant choice when user types `"Order Biryani"`.<br>• **Unknown Merchant:** Suggests available directory.<br>• **API Downtime:** Fallback rule engine. | [`server/src/tools/handlers.ts`](server/src/tools/handlers.ts)<br>[`server/src/services/claude.ts`](server/src/services/claude.ts) |

---

## 🏗️ System Architecture

```
                               ┌─────────────────────────────────────────┐
                               │       React + Tailwind Frontend         │
                               │  (Interactive Cards, Live Event Stream) │
                               └────────────────────┬────────────────────┘
                                                    │
                                      HTTP / REST   │  SSE Event Stream
                                                    ▼
                               ┌─────────────────────────────────────────┐
                               │        Node.js + Express (TS)           │
                               │     /api/chat | /api/catalog | /api/seed│
                               └────────────────────┬────────────────────┘
                                                    │
                     ┌──────────────────────────────┴──────────────────────────────┐
                     ▼                                                             ▼
       ┌───────────────────────────┐                                 ┌───────────────────────────┐
       │   Agentic Reasoning Core  │                                 │   Event-Driven Audit Log  │
       │   • Intent Classifier     │                                 │ (Real-time SSE event bus) │
       │   • Explainability Engine │                                 └─────────────┬─────────────┘
       │   • Bounded Spend Guard   │                                               │
       └─────────────┬─────────────┘                                               │
                     │                                                             │
        ┌────────────┴──────────────────────────────────────────┐                  │
        ▼                                                       ▼                  ▼
┌───────────────────────────────┐               ┌───────────────────────────────┐
│     Agent Tools Execution     │               │   Live Architecture Inspector │
│                               │               │   (Streamed to Frontend UI)   │
├───────────────────────────────┤               └───────────────────────────────┘
│ • food_search_restaurant      │
│ • food_place_order (decrement)│──────────────► 💳 Razorpay Orders API (Test Mode)
│ • create_payment_link         │──────────────► 💳 Razorpay Payment Links API
│ • verify_payment              │
│ • log_transaction             │──────────────► 🗄️ SQLite Database Engine (WAL Mode)
│ • schedule_reminder           │
└───────────────────────────────┘
```

---

## 📐 Key Design Decisions

1. **Why an Owned SQLite Database instead of Scraping?**
   * *Problem:* Scraping platforms like Amazon/Swiggy violates ToS, triggers bot-blocks, and breaks on UI changes.
   * *Solution:* Storing our structured catalog in SQLite gives us full control over inventory quantities, atomic stock decrements, and machine-readable data feeds (`/api/catalog`), matching the vision of open commerce protocols (ACP/AP2).
2. **Why Dual Razorpay Rails (Orders API + Payment Links API)?**
   * *Orders API (`orders.create`):* Drives frictionless, in-chat checkout cards with instantaneous HMAC-SHA256 signature verification.
   * *Payment Links API (`paymentLink.create`):* Provides shareable, expiring short URLs (`https://rzp.io/l/...`) for external or asynchronous payment requests.
3. **Why Dual Agent Execution (Claude 3.5 Sonnet + State Machine Fallback)?**
   * Employs real Anthropic Claude tool-calling when keys are active.
   * Seamlessly switches to a local deterministic 9-state conversational engine if external rate limits or token exhaustion occur, ensuring 100% uptime during live hackathon demos.
4. **Why Server-Sent Events (SSE) for Auditability?**
   * Exposes an `/api/events/stream` endpoint connected to the frontend "Live Events" inspector drawer, streaming every AI thought, tool call, and ledger commit in real time without polling.

---

## 🛡️ "The Bar" — Safe & Responsible Agentic Commerce

| Principle | Implementation in Code |
|---|---|
| **🧠 Explainable** | Agent explicitly narrates: `🧠 Agent Reasoning: I matched 'chicken biryani' → Chicken Biryani (🔴 Non-Veg, Biryani) at Biryani House — closest match to your request.` before presenting checkout. |
| **🛡️ Bounded** | A hard per-order spend cap (`FOOD_SPEND_CAP = ₹2000`) is checked before order creation. Orders above ₹2,000 halt and request explicit user re-authorization. |
| **🔒 Gated** | Money is never debited autonomously. The agent returns an interactive `<FoodOrderCard />` requiring an explicit button click to trigger payment. |
| **📜 Auditable** | Every state transition is recorded in SQLite and broadcast over the SSE event bus for real-time inspection. |

---

## 🚨 Failure Handling Scenarios (Built-in Resilience)

1. **Out-of-Stock Handling:**
   * When `stock_quantity` reaches `0`, `food_place_order` halts order generation, logs an out-of-stock event, and returns 3 available alternatives from the same restaurant.
2. **Ambiguous Query Disambiguation:**
   * When a user says `"Order Biryani"` without naming a restaurant, the agent detects missing entities and displays all 5 registered restaurants.
3. **Unknown Restaurant / Missing Item:**
   * When a restaurant or item is not found, the agent displays the directory and suggests closest alternatives.
4. **Mid-Flow Parameter Modification:**
   * Users can dynamically modify attributes (e.g. *"actually make it ₹500"* or *"use credit card"*) without restarting the session.

---

## 🗄️ Database Schema & Registered Merchants

### Schema:
* `restaurants`: `(id, name, cuisine, rating, delivery_fee, min_order, eta_minutes, address, is_open)`
* `menu_items`: `(id, restaurant_id, name, description, category, price, is_veg, is_available, stock_quantity)`
* `food_orders`: `(id, user_id, restaurant_id, restaurant_name, item_id, item_name, item_price, delivery_fee, total_amount, razorpay_order_id, status, eta_minutes, created_at)`
* `users`: `(id, name, phone, email, preferred_payment_method, avatar_url, created_at)`
* `purchase_history`: `(id, user_id, type, amount, currency, description, metadata_json, date)`
* `transactions`: `(id, user_id, razorpay_order_id, razorpay_payment_id, amount, currency, status, payment_method, description, created_at)`
* `reminders`: `(id, user_id, remind_date, description, status, created_at)`

### Registered Merchants in Catalog:
1. 🍛 **Biryani House** (`rest_bh`) — North Indian / Biryani | ⭐ 4.5 | Delivery: ₹40 | ETA: 35 min
2. 🍕 **Pizza Palace** (`rest_pp`) — Italian / Pizza | ⭐ 4.2 | Delivery: ₹50 | ETA: 30 min
3. 🍔 **Burger Barn** (`rest_bb`) — American / Burgers | ⭐ 4.3 | Delivery: ₹35 | ETA: 25 min
4. 🫓 **Dosa Corner** (`rest_dc`) — South Indian | ⭐ 4.6 | Delivery: ₹30 | ETA: 20 min
5. 🍜 **Wok Express** (`rest_we`) — Chinese / Asian | ⭐ 4.1 | Delivery: ₹45 | ETA: 30 min

---

## 🚀 Quickstart & Local Setup

### 1. Clone & Install
```bash
git clone https://github.com/Shiksha630/conversational-checkout-agent.git
cd conversational-checkout-agent
npm run install:all
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory:
```env
ANTHROPIC_API_KEY=your_anthropic_api_key
RAZORPAY_KEY_ID=rzp_test_your_key_id_here
RAZORPAY_KEY_SECRET=your_key_secret_here
PORT=5000
```

### 3. Start Application
```bash
npm run dev
```
* **Frontend UI:** [http://localhost:3000](http://localhost:3000)
* **Backend API:** [http://localhost:5000](http://localhost:5000)
* **Live Catalog API:** [http://localhost:5000/api/catalog](http://localhost:5000/api/catalog)

---

## 🎬 Live Demo Walkthrough Scripts

| Demo Flow | Prompt to Type | What Happens Under the Hood |
|---|---|---|
| **1. End-to-End Food Checkout** | `"Order Chicken Biryani from Biryani House"` | Agent explains reasoning → checks & decrements stock (50→49) → creates real Razorpay Order (`order_...`) for ₹420 → renders interactive `<FoodOrderCard />` → click **Pay** to capture. |
| **2. Razorpay Payment Link** | `"Send me a payment link for ₹850"` | Agent calls Razorpay Payment Links API (`paymentLink.create`) → returns active short URL (`https://rzp.io/l/...`). |
| **3. Ambiguous Query Disambiguation** | `"Order Biryani"` | Agent detects missing merchant name and prompts user with list of restaurants. |
| **4. Out-of-Stock Recovery** | `"Order Mutton Biryani from Biryani House"` *(when stock=0)* | Agent halts checkout, states item is sold out, and suggests 3 in-stock alternatives from the same menu. |
| **5. Repeat Purchase & Reminders** | `"Recharge my phone"` | Agent queries user history (Airtel 5G ₹399) → prepares proposal card → offers proactive renewal reminder. |
