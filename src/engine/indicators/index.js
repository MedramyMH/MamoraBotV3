// Technical Indicators for Strategy Engine

export class EMA {
  constructor(period) {
    this.period = period;
    this.multiplier = 2 / (period + 1);
    this.ema = null;
  }

  update(price) {
    if (this.ema === null) {
      this.ema = price;
    } else {
      this.ema = (price * this.multiplier) + (this.ema * (1 - this.multiplier));
    }
    return this.ema;
  }

  getValue() {
    return this.ema;
  }

  reset() {
    this.ema = null;
  }
}

export class RSI {
  constructor(period = 14) {
    this.period = period;
    this.gains = [];
    this.losses = [];
    this.lastPrice = null;
  }

  update(price) {
    if (this.lastPrice !== null) {
      const change = price - this.lastPrice;
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? -change : 0;

      this.gains.push(gain);
      this.losses.push(loss);

      if (this.gains.length > this.period) {
        this.gains.shift();
        this.losses.shift();
      }

      if (this.gains.length === this.period) {
        const avgGain = this.gains.reduce((sum, g) => sum + g, 0) / this.period;
        const avgLoss = this.losses.reduce((sum, l) => sum + l, 0) / this.period;

        if (avgLoss === 0) return 100;
        
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
      }
    }

    this.lastPrice = price;
    return null;
  }

  getValue() {
    if (this.gains.length < this.period) return null;
    
    const avgGain = this.gains.reduce((sum, g) => sum + g, 0) / this.period;
    const avgLoss = this.losses.reduce((sum, l) => sum + l, 0) / this.period;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  reset() {
    this.gains = [];
    this.losses = [];
    this.lastPrice = null;
  }
}

export class ATR {
  constructor(period = 14) {
    this.period = period;
    this.trueRanges = [];
    this.lastCandle = null;
  }

  update(candle) {
    if (this.lastCandle) {
      const high = candle.high;
      const low = candle.low;
      const prevClose = this.lastCandle.close;

      const tr1 = high - low;
      const tr2 = Math.abs(high - prevClose);
      const tr3 = Math.abs(low - prevClose);
      
      const trueRange = Math.max(tr1, tr2, tr3);
      this.trueRanges.push(trueRange);

      if (this.trueRanges.length > this.period) {
        this.trueRanges.shift();
      }
    }

    this.lastCandle = candle;
    return this.getValue();
  }

  getValue() {
    if (this.trueRanges.length === 0) return null;
    return this.trueRanges.reduce((sum, tr) => sum + tr, 0) / this.trueRanges.length;
  }

  reset() {
    this.trueRanges = [];
    this.lastCandle = null;
  }
}

export class BollingerBands {
  constructor(period = 20, stdDev = 2) {
    this.period = period;
    this.stdDev = stdDev;
    this.prices = [];
  }

  update(price) {
    this.prices.push(price);
    if (this.prices.length > this.period) {
      this.prices.shift();
    }

    if (this.prices.length < this.period) {
      return null;
    }

    const sma = this.prices.reduce((sum, p) => sum + p, 0) / this.period;
    const variance = this.prices.reduce((sum, p) => sum + Math.pow(p - sma, 2), 0) / this.period;
    const stdDeviation = Math.sqrt(variance);

    return {
      middle: sma,
      upper: sma + (stdDeviation * this.stdDev),
      lower: sma - (stdDeviation * this.stdDev),
      bandwidth: (stdDeviation * this.stdDev * 2) / sma
    };
  }

  getValue() {
    if (this.prices.length < this.period) return null;
    
    const sma = this.prices.reduce((sum, p) => sum + p, 0) / this.period;
    const variance = this.prices.reduce((sum, p) => sum + Math.pow(p - sma, 2), 0) / this.period;
    const stdDeviation = Math.sqrt(variance);

    return {
      middle: sma,
      upper: sma + (stdDeviation * this.stdDev),
      lower: sma - (stdDeviation * this.stdDev),
      bandwidth: (stdDeviation * this.stdDev * 2) / sma
    };
  }

  reset() {
    this.prices = [];
  }
}

export class VWAP {
  constructor() {
    this.totalVolume = 0;
    this.totalVolumePrice = 0;
  }

  update(price, volume = 1) {
    this.totalVolume += volume;
    this.totalVolumePrice += price * volume;
    return this.getValue();
  }

  getValue() {
    if (this.totalVolume === 0) return null;
    return this.totalVolumePrice / this.totalVolume;
  }

  reset() {
    this.totalVolume = 0;
    this.totalVolumePrice = 0;
  }
}