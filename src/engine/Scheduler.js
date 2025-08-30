import { realtimeClient } from '../data/websocketClient';

class Scheduler {
  constructor() {
    this.jobs = new Map();
    this.timeframes = {
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
    this.timingErrors = [];
  }

  scheduleAtCandleBoundary(symbol, timeframe, callback, options = {}) {
    const { offset = 5 } = options; // Default 5ms before boundary
    const intervalMs = this.timeframes[timeframe];
    
    if (!intervalMs) {
      throw new Error(`Invalid timeframe: ${timeframe}`);
    }

    const jobId = `${symbol}_${timeframe}_${Date.now()}`;
    
    const scheduleNext = () => {
      const serverTime = realtimeClient.getServerTime();
      const nextBoundary = this.getNextCandleBoundary(serverTime, intervalMs);
      const delay = nextBoundary.getTime() - serverTime.getTime() - offset;
      
      if (delay <= 0) {
        // We're past the boundary, schedule for next one
        const nextNextBoundary = new Date(nextBoundary.getTime() + intervalMs);
        const nextDelay = nextNextBoundary.getTime() - serverTime.getTime() - offset;
        
        const timeoutId = setTimeout(() => {
          this.executeAtBoundary(symbol, timeframe, callback, nextNextBoundary);
          if (this.jobs.has(jobId)) {
            scheduleNext();
          }
        }, Math.max(0, nextDelay));
        
        this.jobs.set(jobId, { timeoutId, nextExecution: nextNextBoundary });
      } else {
        const timeoutId = setTimeout(() => {
          this.executeAtBoundary(symbol, timeframe, callback, nextBoundary);
          if (this.jobs.has(jobId)) {
            scheduleNext();
          }
        }, delay);
        
        this.jobs.set(jobId, { timeoutId, nextExecution: nextBoundary });
      }
    };

    scheduleNext();
    return jobId;
  }

  executeAtBoundary(symbol, timeframe, callback, expectedTime) {
    const actualTime = realtimeClient.getServerTime();
    const timingError = actualTime.getTime() - expectedTime.getTime();
    
    // Record timing error for analysis
    this.timingErrors.push({
      symbol,
      timeframe,
      expectedTime,
      actualTime,
      errorMs: timingError,
      timestamp: new Date()
    });
    
    // Keep only last 1000 timing errors
    if (this.timingErrors.length > 1000) {
      this.timingErrors.shift();
    }

    // Get the most recent tick at or before the boundary
    const tickBuffer = realtimeClient.getTickBuffer(symbol);
    const boundaryTick = this.findTickAtBoundary(tickBuffer, expectedTime);
    
    try {
      callback({
        symbol,
        timeframe,
        expectedTime,
        actualTime,
        timingError,
        tick: boundaryTick
      });
    } catch (error) {
      console.error('Error executing scheduled callback:', error);
    }
  }

  findTickAtBoundary(tickBuffer, boundaryTime) {
    if (!tickBuffer || tickBuffer.length === 0) {
      return null;
    }

    // Find the latest tick at or before the boundary
    let latestTick = null;
    for (let i = tickBuffer.length - 1; i >= 0; i--) {
      const tick = tickBuffer[i];
      if (tick.ts <= boundaryTime) {
        latestTick = tick;
        break;
      }
    }

    return latestTick;
  }

  getNextCandleBoundary(currentTime, intervalMs) {
    const timestamp = currentTime.getTime();
    const remainder = timestamp % intervalMs;
    const nextBoundaryTime = timestamp - remainder + intervalMs;
    return new Date(nextBoundaryTime);
  }

  cancelJob(jobId) {
    const job = this.jobs.get(jobId);
    if (job) {
      clearTimeout(job.timeoutId);
      this.jobs.delete(jobId);
      return true;
    }
    return false;
  }

  getTimingStats() {
    if (this.timingErrors.length === 0) {
      return null;
    }

    const errors = this.timingErrors.map(e => e.errorMs);
    const sorted = [...errors].sort((a, b) => a - b);
    
    return {
      count: errors.length,
      mean: errors.reduce((sum, e) => sum + e, 0) / errors.length,
      median: sorted[Math.floor(sorted.length / 2)],
      min: Math.min(...errors),
      max: Math.max(...errors),
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      stdev: this.calculateStandardDeviation(errors)
    };
  }

  calculateStandardDeviation(values) {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }

  getActiveJobs() {
    return Array.from(this.jobs.entries()).map(([id, job]) => ({
      id,
      nextExecution: job.nextExecution
    }));
  }

  cancelAllJobs() {
    this.jobs.forEach(job => clearTimeout(job.timeoutId));
    this.jobs.clear();
  }
}

export const scheduler = new Scheduler();