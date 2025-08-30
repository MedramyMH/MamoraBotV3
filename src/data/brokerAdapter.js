import { supabase } from '../lib/supabaseClient.js';

// Base Broker Interface
export class Broker {
  constructor() {
    this.connected = false;
    this.executionHandlers = [];
  }

  async connect(credentials) {
    throw new Error('connect method must be implemented');
  }

  async disconnect() {
    this.connected = false;
  }

  async getServerTime() {
    return new Date();
  }

  async placeOrder({ symbol, side, qty, type = 'market', limitPrice = null, tif = 'GTC' }) {
    throw new Error('placeOrder method must be implemented');
  }

  onExecution(handler) {
    this.executionHandlers.push(handler);
    return () => {
      const index = this.executionHandlers.indexOf(handler);
      if (index > -1) {
        this.executionHandlers.splice(index, 1);
      }
    };
  }

  notifyExecution(execution) {
    this.executionHandlers.forEach(handler => {
      try {
        handler(execution);
      } catch (error) {
        console.error('Error in execution handler:', error);
      }
    });
  }
}

// PocketOption Broker Implementation (Simulated)
export class PocketOptionBroker extends Broker {
  constructor() {
    super();
    this.positions = new Map();
    this.orderIdCounter = 1;
    this.latency = { min: 10, max: 50 }; // Simulated latency in ms
  }

  async connect(credentials) {
    // Simulate connection delay
    await this.delay(100);
    
    console.log('Connected to PocketOption (simulated)');
    this.connected = true;
    return { success: true };
  }

  async getServerTime() {
    // Simulate network latency
    await this.delay(this.getRandomLatency());
    return new Date();
  }

  async placeOrder({ symbol, side, qty, type = 'market', limitPrice = null, tif = 'GTC' }) {
    if (!this.connected) {
      throw new Error('Broker not connected');
    }

    const orderId = this.orderIdCounter++;
    const submitTime = new Date();

    // Store order in database
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert({
        symbol,
        ts_submit: submitTime.toISOString(),
        side,
        qty,
        price_limit: limitPrice,
        status: 'submitted',
        meta: { type, tif, broker: 'PocketOption' }
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // Simulate order processing
    setTimeout(async () => {
      await this.processOrder(orderData, submitTime);
    }, this.getRandomLatency());

    return {
      orderId: orderData.id,
      status: 'submitted',
      submitTime
    };
  }

  async processOrder(orderData, submitTime) {
    const ackTime = new Date();
    
    // Update order status to acknowledged
    await supabase
      .from('orders')
      .update({ 
        status: 'ack', 
        ts_ack: ackTime.toISOString() 
      })
      .eq('id', orderData.id);

    this.notifyExecution({
      type: 'ack',
      orderId: orderData.id,
      timestamp: ackTime
    });

    // Simulate fill after additional delay
    setTimeout(async () => {
      await this.fillOrder(orderData, ackTime);
    }, this.getRandomLatency());
  }

  async fillOrder(orderData, ackTime) {
    const fillTime = new Date();
    
    // Simulate realistic fill price with slippage
    const basePrice = this.getCurrentPrice(orderData.symbol);
    const slippage = this.calculateSlippage(orderData);
    const fillPrice = basePrice + slippage;

    // Update order status to filled
    await supabase
      .from('orders')
      .update({ status: 'filled' })
      .eq('id', orderData.id);

    // Create trade record
    const { data: tradeData, error: tradeError } = await supabase
      .from('trades')
      .insert({
        order_id: orderData.id,
        symbol: orderData.symbol,
        ts_fill: fillTime.toISOString(),
        price: fillPrice,
        qty: orderData.qty
      })
      .select()
      .single();

    if (!tradeError) {
      this.notifyExecution({
        type: 'fill',
        orderId: orderData.id,
        tradeId: tradeData.id,
        symbol: orderData.symbol,
        side: orderData.side,
        qty: orderData.qty,
        price: fillPrice,
        timestamp: fillTime
      });
    }
  }

  getCurrentPrice(symbol) {
    // Simulate current market prices
    const prices = {
      'EURUSD': 1.0850,
      'GBPUSD': 1.2650,
      'USDJPY': 149.50,
      'BTCUSD': 43500
    };
    
    return prices[symbol] || 1.0000;
  }

  calculateSlippage(orderData) {
    // Simulate realistic slippage based on market conditions
    const baseSlippage = orderData.symbol === 'BTCUSD' ? 5 : 0.0001;
    const randomFactor = (Math.random() - 0.5) * 2; // -1 to 1
    const sideMultiplier = orderData.side === 'buy' ? 1 : -1;
    
    return baseSlippage * randomFactor * sideMultiplier;
  }

  getRandomLatency() {
    return Math.random() * (this.latency.max - this.latency.min) + this.latency.min;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getPositions() {
    // Return current positions (simulated)
    return Array.from(this.positions.values());
  }

  async getAccountInfo() {
    return {
      balance: 10000,
      equity: 10000,
      margin: 0,
      freeMargin: 10000,
      marginLevel: 0,
      currency: 'USD'
    };
  }
}

// Mock Broker for Testing
export class MockBroker extends Broker {
  constructor() {
    super();
    this.orders = [];
    this.trades = [];
    this.orderIdCounter = 1;
  }

  async connect() {
    this.connected = true;
    return { success: true };
  }

  async placeOrder(orderParams) {
    const order = {
      id: this.orderIdCounter++,
      ...orderParams,
      status: 'filled',
      submitTime: new Date(),
      fillTime: new Date(),
      fillPrice: this.getCurrentPrice(orderParams.symbol)
    };

    this.orders.push(order);
    
    // Immediately notify of fill (for testing)
    setTimeout(() => {
      this.notifyExecution({
        type: 'fill',
        orderId: order.id,
        ...order
      });
    }, 10);

    return order;
  }

  getCurrentPrice(symbol) {
    const prices = {
      'EURUSD': 1.0850,
      'GBPUSD': 1.2650,
      'USDJPY': 149.50,
      'BTCUSD': 43500
    };
    return prices[symbol] || 1.0000;
  }
}

// Export broker instances
export const pocketOptionBroker = new PocketOptionBroker();
export const mockBroker = new MockBroker();