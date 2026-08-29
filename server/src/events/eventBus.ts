import { EventEmitter } from 'events';

export interface ArchitectureEvent {
  id: string;
  type: 
    | 'USER_INTENT_PARSED'
    | 'USER_HISTORY_RETRIEVED'
    | 'PAYMENT_ORDER_INITIATED'
    | 'AGENT_PROPOSAL_DISPATCHED'
    | 'PAYMENT_CAPTURED'
    | 'TRANSACTION_COMMITTED'
    | 'REMINDER_SCHEDULED'
    | 'SYSTEM_LOG';
  title: string;
  description: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

class AgentEventBus extends EventEmitter {
  private events: ArchitectureEvent[] = [];
  private readonly maxEvents = 100;

  emitEvent(
    type: ArchitectureEvent['type'],
    title: string,
    description: string,
    metadata?: Record<string, any>
  ): ArchitectureEvent {
    const event: ArchitectureEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type,
      title,
      description,
      metadata,
      timestamp: new Date().toISOString(),
    };

    this.events.unshift(event);
    if (this.events.length > this.maxEvents) {
      this.events.pop();
    }

    this.emit('architecture_event', event);
    return event;
  }

  getRecentEvents(limit: number = 20): ArchitectureEvent[] {
    return this.events.slice(0, limit);
  }

  clear(): void {
    this.events = [];
  }
}

export const eventBus = new AgentEventBus();
