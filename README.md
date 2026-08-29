# ⚡ Conversational Checkout Agent
> **Razorpay AI Growth & Agentic Commerce Hackathon Submission**  
> An autonomous tool-calling AI agent that executes purchases, utility recharges, subscription renewals, and repeat food/grocery orders entirely through natural language chat with integrated Razorpay payment gateway execution.

---

## 📌 Executive Summary & Problem Statement

### The Problem
Traditional e-commerce and fintech checkout funnels suffer from severe drop-offs (often 60–75%) because users must navigate complex multi-step user interfaces: selecting operators, choosing specific plans, navigating billing forms, manually typing OTPs/VPA handles, and confirming review screens.

### The Solution: Razorpay Agentic Commerce
The **Conversational Checkout Agent** replaces rigid checkout menus with a continuous, intent-driven conversational loop:
1. **Zero Menu Navigation:** The customer types natural requests like *"recharge my phone"*, *"reorder my usual coffee"*, or *"renew gym membership"*.
2. **Context-Aware Personalization:** The AI agent autonomously invokes backend tools to inspect historical patterns and preferred payment methods (UPI, Cards, Mandates).
3. **Interactive One-Click Checkout:** Rather than raw text links, the agent generates actionable **Razorpay Payment Cards** within the stream.
4. **Resilient Mid-Flow Changes:** Users can dynamically modify attributes (e.g. *"actually make it ₹500"* or *"switch to my credit card"*) without restarting the conversation.
5. **Post-Payment Proactivity:** Captures payment verification, logs transactions in database, and schedules automated renewal reminders.

---

## 🏗️ System Architecture

```
                               ┌─────────────────────────────────────────┐
                               │       React + Tailwind Frontend         │
                               │   (Chat Stream, Cards, Event Drawer)    │
                               └────────────────────┬────────────────────┘
                                                    │
                                      HTTP / REST   │  SSE Event Stream
                                                    ▼
                               ┌─────────────────────────────────────────┐
                               │        Node.js + Express (TS)           │
                               │             /api/chat                   │
                               └────────────────────┬────────────────────┘
                                                    │
                     ┌──────────────────────────────┴──────────────────────────────┐
                     ▼                                                             ▼
       ┌───────────────────────────┐                                 ┌───────────────────────────┐
       │   Claude Agent SDK Core   │                                 │   In-Memory Event Bus     │
       │   (Tool-Calling Loop)     │                                 │ (Kafka-style architecture)│
       └─────────────┬─────────────┘                                 └─────────────┬─────────────┘
                     │                                                             │
        ┌────────────┴──────────────────────────────────────────┐                  │
        ▼                                                       ▼                  ▼
┌───────────────────────────────┐               ┌───────────────────────────────┐
│     Agent Tools Execution     │               │   Live Architecture Inspector │
│                               │               │   (Streamed to Frontend UI)   │
├───────────────────────────────┤               └───────────────────────────────┘
│ • get_user_history            │
│ • create_payment_order        │──────────────► 💳 Razorpay Gateway API (Test Mode)
│ • verify_payment              │
│ • log_transaction             │──────────────► 🗄️ SQLite Database Engine
│ • schedule_reminder           │
└───────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Agent Layer** | `@anthropic-ai/sdk` (Claude 3.5) | Tool calling, intent extraction, multi-turn state management |
| **Backend API** | Node.js + Express + TypeScript (`tsx`) | REST endpoints, tool orchestration, payment callbacks |
| **Database** | SQLite (`better-sqlite3`) | Persistent storage for users, purchase history, transactions, reminders |
| **Payment Gateway** | Razorpay Node SDK & Checkout.js | Live test order creation, payment capture, and signature verification |
| **Event System** | Node.js `EventEmitter` + SSE | Models discrete commerce state events (`ORDER_INIT` → `PROPOSAL` → `CAPTURE` → `COMMITTED`) |
| **Frontend UI** | React 18 (Vite) + Tailwind CSS + Lucide | Polished chat interface, interactive proposal cards, receipt modals, event visualizer |

---

## 🗄️ Database Schema

- `users`: `(id, name, phone, email, preferred_payment_method, avatar_url, created_at)`
- `purchase_history`: `(id, user_id, type ['recharge'|'subscription'|'reorder'], amount, currency, description, metadata_json, date)`
- `transactions`: `(id, user_id, razorpay_order_id, razorpay_payment_id, amount, currency, status, payment_method, description, created_at)`
- `reminders`: `(id, user_id, remind_date, description, status, created_at)`

---

## 🚀 Quickstart & Local Setup

### 1. Clone & Navigate
```bash
cd /Users/shiksha/Desktop/conversational-checkout-agent
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` (optional — works with built-in high-fidelity sandbox mode if keys are not immediately configured):
```bash
cp .env.example .env
```

Edit `.env`:
```env
ANTHROPIC_API_KEY=your_anthropic_api_key
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
PORT=5000
```

### 3. Install All Dependencies
```bash
npm run install:all
```

### 4. Seed Database
```bash
npm run seed
```

### 5. Launch Full-Stack Application
```bash
npm run dev
```
- **Frontend:** [http://localhost:3000](http://localhost:3000)
- **Backend Server:** [http://localhost:5000](http://localhost:5000)

---

## 🎬 Demo Walkthrough & Conversation Scripts

### Persona 1: Rahul Sharma (Utility Recharge Flow)
1. Select **Rahul** from the persona bar.
2. Click suggestion or type: `"recharge my phone"`
3. **Agent Action:** Calls `get_user_history("usr_rahul")` → finds Airtel 5G ₹399 plan → Calls `create_payment_order(...)`.
4. **Agent Response:** Renders interactive Payment Proposal Card for ₹399 via UPI.
5. **Mid-Flow Modification:** Type: `"actually make it ₹500"`
6. **Agent Action:** Agent modifies the order seamlessly to ₹500 without restarting context.
7. Click **Pay via Razorpay** → Select Payment Method → Payment captures instantly.
8. **Agent Action:** Calls `verify_payment` and `log_transaction`, displays receipt, and offers proactive renewal reminder.
9. Type: `"yes, set a reminder"` → Agent calls `schedule_reminder`.

### Persona 2: Priya Patel (Subscription Renewal Flow)
1. Select **Priya** from the persona bar.
2. Type: `"renew my gym membership"`
3. **Agent Action:** Recognizes Cultpass ELITE membership (₹1,499) with preferred Credit Card.
4. Click **Pay via Razorpay** to renew.

### Persona 3: Ananya Roy (Repeat Order Flow)
1. Select **Ananya** from the persona bar.
2. Type: `"reorder my usual coffee order"`
3. **Agent Action:** Recommends Third Wave Coffee (Vanilla Latte + Croissant - ₹420).
4. Complete checkout in one tap.

---

## 🏆 Key Hackathon Highlights

- **Native Tool Calling:** Uses standard JSON schema tool definitions for deterministic AI actions.
- **Razorpay Production Stack Parity:** Implements Razorpay Orders API (`orders.create`), Payment Verification (`payments.fetch` / HMAC SHA256), and Standard Checkout Modal.
- **Event-Driven Architecture:** Kafka-style event bus tracking the lifecycle of every transaction with real-time UI streaming.
- **Graceful Error Recovery:** Built-in resilience for ambiguous intents, modified parameters, and zero-downtime offline sandbox fallback.
