class WebSocketClient {
  constructor() {
    this.ws = null;
    this.subscribers = new Map();
    this.tickBuffers = new Map();
    this.clockOffset = 0;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.isConnected = false;
    this.pingInterval = null;
    this.lastPingTime = null;
  }

  connect(url = import.meta.env.VITE_WEBSOCKET_URL) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);
        
        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.startClockSync();
          this.startHeartbeat();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
          this.isConnected = false;
          this.stopHeartbeat();
          this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  handleMessage(data) {
    switch (data.type) {
      case 'tick':
        this.processTick(data);
        break;
      case 'pong':
        this.handlePong(data);
        break;
      case 'server_time':
        this.updateClockOffset(data);
        break;
      default:
        console.log('Unknown message type:', data.type);
    }
  }

  processTick({ symbol, ts, price }) {
    // Convert server timestamp to Date object
    const serverTime = new Date(ts);
    const tick = { symbol, ts: serverTime, price: parseFloat(price) };

    // Store in ring buffer (last 2048 ticks per symbol)
    if (!this.tickBuffers.has(symbol)) {
      this.tickBuffers.set(symbol, []);
    }
    
    const buffer = this.tickBuffers.get(symbol);
    buffer.push(tick);
    if (buffer.length > 2048) {
      buffer.shift();
    }

    // Notify subscribers
    const symbolSubscribers = this.subscribers.get(symbol) || [];
    symbolSubscribers.forEach(handler => {
      try {
        handler(tick);
      } catch (error) {
        console.error('Error in tick handler:', error);
      }
    });
  }

  subscribe(symbol, handler) {
    if (!this.subscribers.has(symbol)) {
      this.subscribers.set(symbol, []);
    }
    
    this.subscribers.get(symbol).push(handler);

    // Send subscription request to server
    if (this.isConnected) {
      this.send({ type: 'subscribe', symbol });
    }

    // Return unsubscribe function
    return () => {
      const handlers = this.subscribers.get(symbol) || [];
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
      
      if (handlers.length === 0) {
        this.subscribers.delete(symbol);
        if (this.isConnected) {
          this.send({ type: 'unsubscribe', symbol });
        }
      }
    };
  }

  getTickBuffer(symbol) {
    return this.tickBuffers.get(symbol) || [];
  }

  getLatestTick(symbol) {
    const buffer = this.tickBuffers.get(symbol);
    return buffer && buffer.length > 0 ? buffer[buffer.length - 1] : null;
  }

  getServerTime() {
    return new Date(Date.now() + this.clockOffset);
  }

  startClockSync() {
    // Perform initial clock sync
    this.syncClock();
    
    // Sync every 30 seconds
    this.clockSyncInterval = setInterval(() => {
      this.syncClock();
    }, 30000);
  }

  syncClock() {
    if (!this.isConnected) return;

    const clientTime = Date.now();
    this.send({ type: 'ping', client_time: clientTime });
    this.lastPingTime = clientTime;
  }

  handlePong(data) {
    if (!this.lastPingTime) return;

    const now = Date.now();
    const rtt = now - this.lastPingTime;
    const serverTime = new Date(data.server_time).getTime();
    
    // Calculate clock offset: server_time - client_time - rtt/2
    this.clockOffset = serverTime - now + rtt / 2;
    
    console.log(`Clock sync: offset=${this.clockOffset}ms, RTT=${rtt}ms`);
  }

  updateClockOffset(data) {
    const serverTime = new Date(data.server_time).getTime();
    const clientTime = Date.now();
    this.clockOffset = serverTime - clientTime;
  }

  startHeartbeat() {
    this.pingInterval = setInterval(() => {
      if (this.isConnected) {
        this.send({ type: 'ping', client_time: Date.now() });
      }
    }, 10000);
  }

  stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.clockSyncInterval) {
      clearInterval(this.clockSyncInterval);
      this.clockSyncInterval = null;
    }
  }

  send(data) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      this.connect().catch(console.error);
    }, delay);
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.subscribers.clear();
  }
}

// Create singleton instance
export const wsClient = new WebSocketClient();

// Fallback mock data for development when WebSocket is not available
class MockWebSocketClient {
  constructor() {
    this.subscribers = new Map();
    this.isRunning = false;
    this.mockInterval = null;
  }

  connect() {
    console.log('Using mock WebSocket client for development');
    this.isConnected = true;
    this.startMockData();
    return Promise.resolve();
  }

  startMockData() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    const symbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'BTCUSD'];
    let prices = { EURUSD: 1.0850, GBPUSD: 1.2650, USDJPY: 149.50, BTCUSD: 43500 };
    
    this.mockInterval = setInterval(() => {
      symbols.forEach(symbol => {
        // Generate realistic price movement
        const volatility = symbol === 'BTCUSD' ? 50 : 0.0005;
        const change = (Math.random() - 0.5) * volatility * 2;
        prices[symbol] += change;
        
        const tick = {
          symbol,
          ts: new Date(),
          price: prices[symbol]
        };
        
        const handlers = this.subscribers.get(symbol) || [];
        handlers.forEach(handler => handler(tick));
      });
    }, 100); // 10 ticks per second
  }

  subscribe(symbol, handler) {
    if (!this.subscribers.has(symbol)) {
      this.subscribers.set(symbol, []);
    }
    this.subscribers.get(symbol).push(handler);
    
    return () => {
      const handlers = this.subscribers.get(symbol) || [];
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    };
  }

  getServerTime() {
    return new Date();
  }

  disconnect() {
    this.isRunning = false;
    if (this.mockInterval) {
      clearInterval(this.mockInterval);
      this.mockInterval = null;
    }
    this.subscribers.clear();
  }
}

// Export the appropriate client based on environment
export const realtimeClient = import.meta.env.VITE_WEBSOCKET_URL 
  ? wsClient 
  : new MockWebSocketClient();