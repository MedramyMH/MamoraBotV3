import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export const useTradingStore = create(
  subscribeWithSelector((set, get) => ({
    // Market data
    selectedSymbol: 'EURUSD',
    selectedTimeframe: '1m',
    ticks: new Map(), // symbol -> tick array
    candles: new Map(), // symbol_timeframe -> candle array
    latestPrices: new Map(), // symbol -> latest price
    
    // Trading state
    isLiveTrading: false,
    strategies: [],
    activeStrategies: new Set(),
    signals: [],
    orders: [],
    trades: [],
    positions: [],
    
    // Performance metrics
    metrics: {
      totalTrades: 0,
      winRate: 0,
      totalPnL: 0,
      avgTimingError: 0,
      maxDrawdown: 0
    },
    
    // UI state
    connectionStatus: 'disconnected', // disconnected, connecting, connected
    latency: 0,
    timingErrors: [],
    
    // Actions
    setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),
    setSelectedTimeframe: (timeframe) => set({ selectedTimeframe: timeframe }),
    
    addTick: (tick) => set((state) => {
      const symbolTicks = state.ticks.get(tick.symbol) || [];
      symbolTicks.push(tick);
      
      // Keep only last 1000 ticks per symbol
      if (symbolTicks.length > 1000) {
        symbolTicks.shift();
      }
      
      const newTicks = new Map(state.ticks);
      newTicks.set(tick.symbol, symbolTicks);
      
      const newLatestPrices = new Map(state.latestPrices);
      newLatestPrices.set(tick.symbol, tick.price);
      
      return {
        ticks: newTicks,
        latestPrices: newLatestPrices
      };
    }),
    
    addCandle: (candle) => set((state) => {
      const key = `${candle.symbol}_${candle.frame}`;
      const symbolCandles = state.candles.get(key) || [];
      symbolCandles.push(candle);
      
      // Keep only last 500 candles per symbol/timeframe
      if (symbolCandles.length > 500) {
        symbolCandles.shift();
      }
      
      const newCandles = new Map(state.candles);
      newCandles.set(key, symbolCandles);
      
      return { candles: newCandles };
    }),
    
    setConnectionStatus: (status) => set({ connectionStatus: status }),
    setLatency: (latency) => set({ latency }),
    
    addTimingError: (error) => set((state) => {
      const newErrors = [...state.timingErrors, error];
      // Keep only last 100 timing errors
      if (newErrors.length > 100) {
        newErrors.shift();
      }
      return { timingErrors: newErrors };
    }),
    
    setStrategies: (strategies) => set({ strategies }),
    
    toggleStrategy: (strategyId) => set((state) => {
      const newActiveStrategies = new Set(state.activeStrategies);
      if (newActiveStrategies.has(strategyId)) {
        newActiveStrategies.delete(strategyId);
      } else {
        newActiveStrategies.add(strategyId);
      }
      return { activeStrategies: newActiveStrategies };
    }),
    
    addSignal: (signal) => set((state) => ({
      signals: [...state.signals, { ...signal, timestamp: new Date() }]
    })),
    
    addOrder: (order) => set((state) => ({
      orders: [...state.orders, order]
    })),
    
    updateOrder: (orderId, updates) => set((state) => ({
      orders: state.orders.map(order => 
        order.id === orderId ? { ...order, ...updates } : order
      )
    })),
    
    addTrade: (trade) => set((state) => {
      const newTrades = [...state.trades, trade];
      
      // Update metrics
      const totalTrades = newTrades.length;
      const winningTrades = newTrades.filter(t => t.pnl > 0).length;
      const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
      const totalPnL = newTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
      
      return {
        trades: newTrades,
        metrics: {
          ...state.metrics,
          totalTrades,
          winRate,
          totalPnL
        }
      };
    }),
    
    setLiveTrading: (isLive) => set({ isLiveTrading: isLive }),
    
    updateMetrics: (newMetrics) => set((state) => ({
      metrics: { ...state.metrics, ...newMetrics }
    })),
    
    // Getters
    getTicksForSymbol: (symbol) => {
      const state = get();
      return state.ticks.get(symbol) || [];
    },
    
    getCandlesForSymbol: (symbol, timeframe) => {
      const state = get();
      const key = `${symbol}_${timeframe}`;
      return state.candles.get(key) || [];
    },
    
    getLatestPrice: (symbol) => {
      const state = get();
      return state.latestPrices.get(symbol) || 0;
    },
    
    getActiveStrategiesList: () => {
      const state = get();
      return state.strategies.filter(s => state.activeStrategies.has(s.id));
    },
    
    // Reset functions
    clearMarketData: () => set({
      ticks: new Map(),
      candles: new Map(),
      latestPrices: new Map()
    }),
    
    clearTradingData: () => set({
      signals: [],
      orders: [],
      trades: [],
      positions: [],
      metrics: {
        totalTrades: 0,
        winRate: 0,
        totalPnL: 0,
        avgTimingError: 0,
        maxDrawdown: 0
      }
    }),
    
    reset: () => set({
      selectedSymbol: 'EURUSD',
      selectedTimeframe: '1m',
      ticks: new Map(),
      candles: new Map(),
      latestPrices: new Map(),
      isLiveTrading: false,
      strategies: [],
      activeStrategies: new Set(),
      signals: [],
      orders: [],
      trades: [],
      positions: [],
      connectionStatus: 'disconnected',
      latency: 0,
      timingErrors: [],
      metrics: {
        totalTrades: 0,
        winRate: 0,
        totalPnL: 0,
        avgTimingError: 0,
        maxDrawdown: 0
      }
    })
  }))
);