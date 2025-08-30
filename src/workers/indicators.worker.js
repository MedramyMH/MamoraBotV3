// Web Worker for heavy indicator calculations
import { EMA, RSI, ATR, BollingerBands, VWAP } from '../engine/indicators/index.js';

class IndicatorWorker {
  constructor() {
    this.indicators = new Map();
    this.candleBuilders = new Map();
  }

  initializeIndicator(id, type, params) {
    let indicator;
    
    switch (type) {
      case 'EMA':
        indicator = new EMA(params.period);
        break;
      case 'RSI':
        indicator = new RSI(params.period);
        break;
      case 'ATR':
        indicator = new ATR(params.period);
        break;
      case 'BollingerBands':
        indicator = new BollingerBands(params.period, params.stdDev);
        break;
      case 'VWAP':
        indicator = new VWAP();
        break;
      default:
        throw new Error(`Unknown indicator type: ${type}`);
    }
    
    this.indicators.set(id, { indicator, type });
    return { success: true, id };
  }

  updateIndicator(id, data) {
    const indicatorData = this.indicators.get(id);
    if (!indicatorData) {
      throw new Error(`Indicator ${id} not found`);
    }

    const { indicator, type } = indicatorData;
    let result;

    try {
      if (type === 'ATR') {
        result = indicator.update(data); // data should be a candle
      } else if (type === 'VWAP') {
        result = indicator.update(data.price, data.volume || 1);
      } else {
        result = indicator.update(data.price || data);
      }

      return { success: true, id, result, timestamp: Date.now() };
    } catch (error) {
      return { success: false, id, error: error.message };
    }
  }

  buildCandle(symbol, timeframe, tick) {
    const key = `${symbol}_${timeframe}`;
    
    if (!this.candleBuilders.has(key)) {
      this.candleBuilders.set(key, {
        currentCandle: null,
        timeframeMs: this.getTimeframeMs(timeframe)
      });
    }

    const builder = this.candleBuilders.get(key);
    const candleStart = this.getCandleStart(tick.ts, builder.timeframeMs);
    
    if (!builder.currentCandle || builder.currentCandle.ts_open.getTime() !== candleStart.getTime()) {
      // Start new candle
      if (builder.currentCandle) {
        // Return completed candle
        const completedCandle = { ...builder.currentCandle };
        builder.currentCandle = this.createNewCandle(tick, candleStart, builder.timeframeMs);
        return { 
          completed: completedCandle, 
          current: builder.currentCandle,
          isNewCandle: true 
        };
      } else {
        // First candle
        builder.currentCandle = this.createNewCandle(tick, candleStart, builder.timeframeMs);
        return { 
          current: builder.currentCandle,
          isNewCandle: true 
        };
      }
    } else {
      // Update existing candle
      this.updateCandle(builder.currentCandle, tick);
      return { 
        current: builder.currentCandle,
        isNewCandle: false 
      };
    }
  }

  createNewCandle(tick, candleStart, timeframeMs) {
    return {
      symbol: tick.symbol,
      frame: this.getMsToTimeframe(timeframeMs),
      open: tick.price,
      high: tick.price,
      low: tick.price,
      close: tick.price,
      ts_open: candleStart,
      ts_close: new Date(candleStart.getTime() + timeframeMs),
      volume: 1,
      tickCount: 1
    };
  }

  updateCandle(candle, tick) {
    candle.high = Math.max(candle.high, tick.price);
    candle.low = Math.min(candle.low, tick.price);
    candle.close = tick.price;
    candle.volume += 1;
    candle.tickCount += 1;
  }

  getCandleStart(timestamp, timeframeMs) {
    const ts = timestamp.getTime();
    const remainder = ts % timeframeMs;
    return new Date(ts - remainder);
  }

  getTimeframeMs(timeframe) {
    const timeframes = {
      '1s': 1000,
      '5s': 5000,
      '15s': 15000,
      '30s': 30000,
      '1m': 60000,
      '5m': 300000,
      '15m': 900000,
      '30m': 1800000,
      '1h': 3600000,
      '4h': 14400000,
      '1d': 86400000,
    };
    return timeframes[timeframe] || 60000;
  }

  getMsToTimeframe(ms) {
    const timeframes = {
      1000: '1s',
      5000: '5s',
      15000: '15s',
      30000: '30s',
      60000: '1m',
      300000: '5m',
      900000: '15m',
      1800000: '30m',
      3600000: '1h',
      14400000: '4h',
      86400000: '1d',
    };
    return timeframes[ms] || '1m';
  }

  batchProcess(operations) {
    const results = [];
    
    for (const operation of operations) {
      try {
        let result;
        
        switch (operation.type) {
          case 'initIndicator':
            result = this.initializeIndicator(operation.id, operation.indicatorType, operation.params);
            break;
          case 'updateIndicator':
            result = this.updateIndicator(operation.id, operation.data);
            break;
          case 'buildCandle':
            result = this.buildCandle(operation.symbol, operation.timeframe, operation.tick);
            break;
          default:
            result = { success: false, error: `Unknown operation: ${operation.type}` };
        }
        
        results.push({ ...result, operationId: operation.operationId });
      } catch (error) {
        results.push({ 
          success: false, 
          error: error.message, 
          operationId: operation.operationId 
        });
      }
    }
    
    return results;
  }

  reset(id) {
    const indicatorData = this.indicators.get(id);
    if (indicatorData) {
      indicatorData.indicator.reset();
      return { success: true, id };
    }
    return { success: false, error: `Indicator ${id} not found` };
  }

  cleanup() {
    this.indicators.clear();
    this.candleBuilders.clear();
  }
}

// Worker instance
const worker = new IndicatorWorker();

// Message handler
self.onmessage = function(e) {
  const { type, data, id } = e.data;
  
  try {
    let result;
    
    switch (type) {
      case 'init':
        result = worker.initializeIndicator(data.id, data.indicatorType, data.params);
        break;
      case 'update':
        result = worker.updateIndicator(data.id, data.data);
        break;
      case 'buildCandle':
        result = worker.buildCandle(data.symbol, data.timeframe, data.tick);
        break;
      case 'batch':
        result = worker.batchProcess(data.operations);
        break;
      case 'reset':
        result = worker.reset(data.id);
        break;
      case 'cleanup':
        result = worker.cleanup();
        break;
      default:
        result = { success: false, error: `Unknown message type: ${type}` };
    }
    
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ 
      id, 
      result: { success: false, error: error.message } 
    });
  }
};