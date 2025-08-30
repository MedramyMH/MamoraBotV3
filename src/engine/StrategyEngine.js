import { EMA, RSI, ATR, BollingerBands, VWAP } from './indicators/index.js';
import { supabase } from '../lib/supabaseClient.js';

class StrategyEngine {
  constructor() {
    this.strategies = new Map();
    this.activeStrategies = new Set();
    this.indicators = new Map();
  }

  registerStrategy(name, strategyClass) {
    this.strategies.set(name, strategyClass);
  }

  async createStrategy(name, params, userId) {
    if (!this.strategies.has(name)) {
      throw new Error(`Strategy ${name} not found`);
    }

    const { data, error } = await supabase
      .from('strategies')
      .insert({
        owner: userId,
        name,
        params,
        active: true
      })
      .select()
      .single();

    if (error) throw error;

    const StrategyClass = this.strategies.get(name);
    const strategy = new StrategyClass(params);
    strategy.id = data.id;
    strategy.name = name;
    
    return strategy;
  }

  async loadUserStrategies(userId) {
    const { data, error } = await supabase
      .from('strategies')
      .select('*')
      .eq('owner', userId)
      .eq('active', true);

    if (error) throw error;

    const loadedStrategies = [];
    for (const strategyData of data) {
      const StrategyClass = this.strategies.get(strategyData.name);
      if (StrategyClass) {
        const strategy = new StrategyClass(strategyData.params);
        strategy.id = strategyData.id;
        strategy.name = strategyData.name;
        loadedStrategies.push(strategy);
      }
    }

    return loadedStrategies;
  }

  async evaluateStrategies(tick, candle, strategies) {
    const signals = [];

    for (const strategy of strategies) {
      try {
        const signal = await strategy.evaluate(tick, candle);
        if (signal) {
          // Persist signal to database
          const { data, error } = await supabase
            .from('signals')
            .insert({
              symbol: tick.symbol,
              strategy_id: strategy.id,
              ts: tick.ts.toISOString(),
              side: signal.side,
              confidence: signal.confidence,
              details: signal.details || {}
            })
            .select()
            .single();

          if (!error) {
            signals.push({ ...signal, id: data.id, strategy: strategy.name });
          }
        }
      } catch (error) {
        console.error(`Error evaluating strategy ${strategy.name}:`, error);
      }
    }

    return signals;
  }
}

// Base Strategy Class
export class BaseStrategy {
  constructor(params = {}) {
    this.params = params;
    this.indicators = {};
    this.initializeIndicators();
  }

  initializeIndicators() {
    // Override in subclasses
  }

  async evaluate(tick, candle) {
    // Override in subclasses
    throw new Error('evaluate method must be implemented');
  }

  reset() {
    Object.values(this.indicators).forEach(indicator => {
      if (indicator.reset) indicator.reset();
    });
  }
}

// EMA Crossover Strategy
export class EMACrossStrategy extends BaseStrategy {
  initializeIndicators() {
    const { fastPeriod = 12, slowPeriod = 26 } = this.params;
    this.indicators.fastEMA = new EMA(fastPeriod);
    this.indicators.slowEMA = new EMA(slowPeriod);
    this.lastCrossover = null;
  }

  async evaluate(tick, candle) {
    const price = tick.price;
    
    const fastEMA = this.indicators.fastEMA.update(price);
    const slowEMA = this.indicators.slowEMA.update(price);

    if (fastEMA === null || slowEMA === null) {
      return null;
    }

    const currentCrossover = fastEMA > slowEMA ? 'bullish' : 'bearish';
    
    // Check for crossover
    if (this.lastCrossover && this.lastCrossover !== currentCrossover) {
      const signal = {
        side: currentCrossover === 'bullish' ? 'long' : 'short',
        confidence: Math.abs(fastEMA - slowEMA) / slowEMA,
        details: {
          fastEMA,
          slowEMA,
          crossover: currentCrossover,
          price
        }
      };

      this.lastCrossover = currentCrossover;
      return signal;
    }

    this.lastCrossover = currentCrossover;
    return null;
  }
}

// RSI Mean Reversion Strategy
export class RSIMeanReversionStrategy extends BaseStrategy {
  initializeIndicators() {
    const { period = 14, oversoldLevel = 30, overboughtLevel = 70 } = this.params;
    this.indicators.rsi = new RSI(period);
    this.oversoldLevel = oversoldLevel;
    this.overboughtLevel = overboughtLevel;
  }

  async evaluate(tick, candle) {
    const rsi = this.indicators.rsi.update(tick.price);
    
    if (rsi === null) return null;

    let signal = null;
    
    if (rsi <= this.oversoldLevel) {
      signal = {
        side: 'long',
        confidence: (this.oversoldLevel - rsi) / this.oversoldLevel,
        details: { rsi, level: 'oversold', price: tick.price }
      };
    } else if (rsi >= this.overboughtLevel) {
      signal = {
        side: 'short',
        confidence: (rsi - this.overboughtLevel) / (100 - this.overboughtLevel),
        details: { rsi, level: 'overbought', price: tick.price }
      };
    }

    return signal;
  }
}

// Bollinger Bands Strategy
export class BollingerBandsStrategy extends BaseStrategy {
  initializeIndicators() {
    const { period = 20, stdDev = 2 } = this.params;
    this.indicators.bb = new BollingerBands(period, stdDev);
  }

  async evaluate(tick, candle) {
    const bands = this.indicators.bb.update(tick.price);
    
    if (!bands) return null;

    const price = tick.price;
    let signal = null;

    if (price <= bands.lower) {
      signal = {
        side: 'long',
        confidence: (bands.lower - price) / (bands.upper - bands.lower),
        details: { 
          price, 
          bands, 
          position: 'below_lower_band',
          bandwidth: bands.bandwidth 
        }
      };
    } else if (price >= bands.upper) {
      signal = {
        side: 'short',
        confidence: (price - bands.upper) / (bands.upper - bands.lower),
        details: { 
          price, 
          bands, 
          position: 'above_upper_band',
          bandwidth: bands.bandwidth 
        }
      };
    }

    return signal;
  }
}

// Multi-Indicator Strategy combining EMA, RSI, and ATR
export class MultiIndicatorStrategy extends BaseStrategy {
  initializeIndicators() {
    const { 
      emaPeriod = 21, 
      rsiPeriod = 14, 
      atrPeriod = 14,
      rsiOversold = 30,
      rsiOverbought = 70,
      minATRMultiple = 1.5
    } = this.params;
    
    this.indicators.ema = new EMA(emaPeriod);
    this.indicators.rsi = new RSI(rsiPeriod);
    this.indicators.atr = new ATR(atrPeriod);
    this.rsiOversold = rsiOversold;
    this.rsiOverbought = rsiOverbought;
    this.minATRMultiple = minATRMultiple;
  }

  async evaluate(tick, candle) {
    const price = tick.price;
    const ema = this.indicators.ema.update(price);
    const rsi = this.indicators.rsi.update(price);
    
    let atr = null;
    if (candle) {
      atr = this.indicators.atr.update(candle);
    }

    if (ema === null || rsi === null) return null;

    // Trend filter: only trade in direction of EMA
    const trendBullish = price > ema;
    const trendBearish = price < ema;

    // RSI conditions
    const rsiOversold = rsi <= this.rsiOversold;
    const rsiOverbought = rsi >= this.rsiOverbought;

    // ATR filter: ensure sufficient volatility
    const atrFilter = atr === null || atr > (price * 0.001 * this.minATRMultiple);

    let signal = null;

    if (trendBullish && rsiOversold && atrFilter) {
      signal = {
        side: 'long',
        confidence: Math.min(
          (price - ema) / ema,
          (this.rsiOversold - rsi) / this.rsiOversold
        ),
        details: {
          price,
          ema,
          rsi,
          atr,
          trend: 'bullish',
          rsiCondition: 'oversold'
        }
      };
    } else if (trendBearish && rsiOverbought && atrFilter) {
      signal = {
        side: 'short',
        confidence: Math.min(
          (ema - price) / ema,
          (rsi - this.rsiOverbought) / (100 - this.rsiOverbought)
        ),
        details: {
          price,
          ema,
          rsi,
          atr,
          trend: 'bearish',
          rsiCondition: 'overbought'
        }
      };
    }

    return signal;
  }
}

// Create and export strategy engine instance
export const strategyEngine = new StrategyEngine();

// Register built-in strategies
strategyEngine.registerStrategy('EMA_Cross', EMACrossStrategy);
strategyEngine.registerStrategy('RSI_MeanReversion', RSIMeanReversionStrategy);
strategyEngine.registerStrategy('BollingerBands', BollingerBandsStrategy);
strategyEngine.registerStrategy('MultiIndicator', MultiIndicatorStrategy);