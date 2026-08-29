import { dbService } from '../db';
import { razorpayService } from '../services/razorpay';
import { eventBus } from '../events/eventBus';

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

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
