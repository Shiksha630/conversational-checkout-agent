# ⚡ Razorpay Conversational Checkout Agent
> **Razorpay AI Buildathon 2026 — Track 1: AI Growth & Agentic Commerce**  
> An autonomous, explainable, and bounded AI Commerce Agent that connects buyers to merchant product catalogs, executes end-to-end purchasing, handles stock management & failures gracefully, and settles transactions using real Razorpay Test-Mode APIs.

---

## 🏆 Track 1 Requirements Verification Matrix

| Requirement | Implementation in this Codebase | Evidence / Location |
|---|---|---|
| **1. Merchant Catalog & Inventory** | Native SQLite multi-merchant catalog (`restaurants`, `menu_items`) with structured fields (`id`, `name`, `price`, `is_veg`, `stock_quantity`), automatic stock decrement upon purchase, and REST inspection endpoint. | `server/src/db/index.ts`, `GET /api/catalog` |
| **2. Conversational Agent** | Multi-turn reasoning agent that parses natural language requests, handles semantic search across restaurants and menus, filters by budget/diet, and prompts for clarification on ambiguous inputs. | `server/src/services/claude.ts` |
| **3. Razorpay Integration** | Live integration with Razorpay Test Mode using **Orders API** (`orders.create`), **Payment Links API** (`paymentLink.create`), and HMAC-SHA256 signature verification (`payments.fetch`). | `server/src/services/razorpay.ts` |
| **4. The Bar (4 Pillars)** | **Explainable:** Agent narrates exact reasoning for every item choice.<br>**Bounded:** Per-order spend cap (₹2000) enforced before checkout.<br>**Gated:** Interactive proposal card requiring explicit user confirmation before payment.<br>**Auditable:** Real-time EventBus logging all decisions streamed via SSE. | `server/src/events/eventBus.ts`, `FoodOrderCard.tsx` |
| **5. Failure Handling** | Graceful recovery from: (a) Out-of-stock items with alternatives, (b) Ambiguous inputs without restaurant names, (c) Unknown merchants, (d) Upstream API downtime fallback. | `server/src/tools/handlers.ts` |
| **6. Deliverables** | Clean repository structure, detailed architecture documentation with design decisions, demo scripts, and verifiable REST endpoints. | `README.md` |

---

## 🏗️ System Architecture & Design Decisions

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
│ • log_transaction             │──────────────► 🗄️ SQLite Database (better-sqlite3)
│ • schedule_reminder           │
└───────────────────────────────┘
```

### Key Architectural Decisions

1. **Why SQLite (`better-sqlite3`) for the Merchant Catalog?**
   - Enables synchronous, zero-latency in-process database queries during LLM tool-calling loops.
   - Provides ACID transaction safety when decrementing stock quantities and recording financial ledger entries (`transactions`, `food_orders`).
2. **Why Dual-Mode Razorpay Execution (Orders API + Payment Links)?**
   - **Orders API:** Powers the in-chat seamless interactive card checkout with instant signature verification.
   - **Payment Links API:** Enables sharing payment links directly via SMS, WhatsApp, or external channels for asynchronous checkout.
3. **Why Dual-Engine Execution (Anthropic Claude + Smart Rule Simulation)?**
   - The agent uses Claude 3.5 Sonnet tool-calling by default.
   - If the external LLM API encounters rate limits or credit exhaustion, it automatically falls back to a deterministic 9-state conversational engine, ensuring zero downtime during judging and demos.
4. **Why SSE (Server-Sent Events) for Auditability?**
   - Every AI reasoning step, tool invocation, and payment event is pushed in real-time to the frontend "Live Events" inspector drawer, satisfying the auditable requirement without noisy polling.

---

## 🛡️ "The Bar" — Safe & Responsible Agentic Commerce

| Principle | How It Is Implemented |
|---|---|
| **🧠 Explainable** | Before dispatching any payment order, the agent includes an explicit reasoning header: `🧠 Agent Reasoning: I matched 'Chicken Biryani' → Chicken Biryani (🔴 Non-Veg, Biryani) at Biryani House — closest match to your request.` |
| **🛡️ Bounded** | Every food order enforces a strict `FOOD_SPEND_CAP = ₹2000`. If an order exceeds this bound, the agent halts and demands explicit user re-authorization. |
| **🔒 Gated** | Money is never automatically deducted. The agent creates an order draft and renders an interactive proposal card. The customer must click **Pay via Razorpay** to trigger checkout. |
| **📜 Auditable** | Every state transition (`USER_INTENT_PARSED` → `PAYMENT_ORDER_INITIATED` → `AGENT_PROPOSAL_DISPATCHED` → `PAYMENT_CAPTURED` → `TRANSACTION_COMMITTED`) is recorded in the SQLite ledger and broadcast over SSE. |

---

## 🚨 Failure Handling Scenarios (Built-in Resilience)

1. **Out-of-Stock Handling:**
   - When `stock_quantity` reaches `0`, `food_place_order` refuses the transaction, logs an out-of-stock event, and returns 3 available alternatives from the same restaurant.
2. **Ambiguous Query Disambiguation:**
   - If the user asks *"Order biryani"* without specifying a restaurant, the agent detects the ambiguity and displays matching restaurants rather than guessing.
3. **Unknown Restaurant / Item Fallback:**
   - If a requested merchant or item is not found, the agent displays the full directory and suggests closest alternatives.
4. **Resilient Mid-Flow Parameter Modification:**
   - Users can dynamically adjust quantities or amounts (*"actually make it ₹500"*) or switch payment methods (*"use credit card"*) without breaking state.

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Agent Layer** | Anthropic Claude SDK (Claude 3.5 Sonnet) + State Machine Fallback | Tool calling, natural language understanding, conversational state |
| **Backend API** | Node.js + Express + TypeScript (`tsx`) | REST endpoints, tool orchestration, payment callbacks |
| **Database & Catalog** | SQLite (`better-sqlite3`) | Own merchant catalog, inventory tracking, financial transactions |
| **Payment Gateway** | Razorpay Node SDK & Checkout.js | Live test order creation, payment links, and HMAC verification |
| **Event System** | Node.js `EventEmitter` + SSE | Real-time audit trail and architectural event streaming |
| **Frontend UI** | React 18 (Vite) + Tailwind CSS + Lucide Icons | Responsive chat interface, interactive proposal cards, order tracker |

---

## 🚀 Quickstart & Local Setup

### 1. Clone & Navigate
```bash
git clone https://github.com/Shiksha630/conversational-checkout-agent.git
cd conversational-checkout-agent
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory:
```env
ANTHROPIC_API_KEY=your_anthropic_api_key
RAZORPAY_KEY_ID=rzp_test_TVZUaXzsVeHZpK
RAZORPAY_KEY_SECRET=rXxK0tDUAx5Yr2pIDnLkGWg1
PORT=5000
```

### 3. Install Dependencies
```bash
npm run install:all
```

### 4. Launch Application
```bash
npm run dev
```
- **Frontend App:** http://localhost:3000
- **Backend Server:** http://localhost:5000
- **Merchant Catalog API:** http://localhost:5000/api/catalog

---

## 🎬 Live Demo Scripts to Try

### Demo 1: End-to-End Food Order with Real Razorpay Order Creation
- **Prompt:** `"Order Chicken Biryani from Biryani House"`
- **Result:** Agent explains reasoning → checks stock (decrements) → calculates ₹380 + ₹40 = ₹420 → creates Razorpay test order → displays `FoodOrderCard`.
- **Payment:** Click **Pay ₹420 & Place Order** → select UPI → Payment captured → Live delivery tracking animation begins.

### Demo 2: Razorpay Payment Link Generation
- **Prompt:** `"Send me a payment link for ₹750"`
- **Result:** Agent calls Razorpay Payment Links API → returns a real clickable short URL (`https://rzp.io/l/...`).

### Demo 3: Failure Handling — Ambiguous Query
- **Prompt:** `"Order Biryani"`
- **Result:** Agent politely asks which restaurant you want (Biryani House, Dosa Corner, etc.).

### Demo 4: Failure Handling — Out of Stock
- **Action:** Decrement stock to 0 via DB or repeat purchases.
- **Result:** Agent informs user that item is sold out and recommends 3 in-stock alternatives.

### Demo 5: Re-orders & Proactive Subscriptions
- **Prompt:** `"Recharge my phone"` or `"Renew my gym membership"`
- **Result:** Agent retrieves personal history → generates gated proposal card → offers proactive renewal reminder.
