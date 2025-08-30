import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Button,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Chip,
  Card,
  CardContent
} from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '../auth/AuthProvider';
import { useTradingStore } from '../store/tradingStore';
import { realtimeClient } from '../data/websocketClient';
import { scheduler } from '../engine/Scheduler';
import { strategyEngine } from '../engine/StrategyEngine';
import { pocketOptionBroker } from '../data/brokerAdapter';

const Trading = () => {
  const { user, profile } = useAuth();
  const {
    selectedSymbol,
    selectedTimeframe,
    isLiveTrading,
    connectionStatus,
    latency,
    metrics,
    strategies,
    activeStrategies,
    signals,
    orders,
    trades,
    latestPrices,
    setSelectedSymbol,
    setSelectedTimeframe,
    setLiveTrading,
    setConnectionStatus,
    setLatency,
    addTick,
    addSignal,
    addOrder,
    addTrade,
    setStrategies,
    toggleStrategy,
    getCandlesForSymbol,
    getLatestPrice
  } = useTradingStore();

  const [worker, setWorker] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [error, setError] = useState('');

  // Initialize worker
  useEffect(() => {
    const indicatorWorker = new Worker('/src/workers/indicators.worker.js', { type: 'module' });
    setWorker(indicatorWorker);

    return () => {
      indicatorWorker.terminate();
    };
  }, []);

  // Connect to WebSocket
  useEffect(() => {
    const connectWebSocket = async () => {
      try {
        setConnectionStatus('connecting');
        await realtimeClient.connect();
        setConnectionStatus('connected');
      } catch (error) {
        console.error('WebSocket connection failed:', error);
        setConnectionStatus('disconnected');
        setError('Failed to connect to market data feed');
      }
    };

    connectWebSocket();

    return () => {
      realtimeClient.disconnect();
    };
  }, [setConnectionStatus]);

  // Subscribe to market data
  useEffect(() => {
    if (connectionStatus === 'connected') {
      const unsubscribe = realtimeClient.subscribe(selectedSymbol, handleTick);
      return unsubscribe;
    }
  }, [selectedSymbol, connectionStatus]);

  // Load user strategies
  useEffect(() => {
    const loadStrategies = async () => {
      if (user) {
        try {
          const userStrategies = await strategyEngine.loadUserStrategies(user.id);
          setStrategies(userStrategies);
        } catch (error) {
          console.error('Failed to load strategies:', error);
        }
      }
    };

    loadStrategies();
  }, [user, setStrategies]);

  // Handle incoming ticks
  const handleTick = useCallback((tick) => {
    addTick(tick);
    
    // Update chart data
    setChartData(prev => {
      const newData = [...prev, {
        time: tick.ts.getTime(),
        price: tick.price,
        timestamp: tick.ts.toLocaleTimeString()
      }];
      
      // Keep only last 100 points for performance
      if (newData.length > 100) {
        newData.shift();
      }
      
      return newData;
    });

    // Process tick through worker for candle building
    if (worker) {
      worker.postMessage({
        type: 'buildCandle',
        data: {
          symbol: tick.symbol,
          timeframe: selectedTimeframe,
          tick
        }
      });
    }
  }, [addTick, worker, selectedTimeframe]);

  // Handle worker messages
  useEffect(() => {
    if (!worker) return;

    const handleWorkerMessage = (e) => {
      const { result } = e.data;
      
      if (result.completed) {
        // New candle completed, evaluate strategies
        evaluateStrategies(result.completed);
      }
    };

    worker.addEventListener('message', handleWorkerMessage);
    
    return () => {
      worker.removeEventListener('message', handleWorkerMessage);
    };
  }, [worker]);

  // Evaluate strategies on new candles
  const evaluateStrategies = async (candle) => {
    if (!isLiveTrading) return;

    const activeStratList = strategies.filter(s => activeStrategies.has(s.id));
    
    if (activeStratList.length === 0) return;

    try {
      const latestTick = { 
        symbol: candle.symbol, 
        price: candle.close, 
        ts: candle.ts_close 
      };
      
      const newSignals = await strategyEngine.evaluateStrategies(latestTick, candle, activeStratList);
      
      newSignals.forEach(signal => {
        addSignal(signal);
        
        // Auto-execute signals if enabled
        if (signal.confidence > 0.7) {
          executeSignal(signal);
        }
      });
    } catch (error) {
      console.error('Error evaluating strategies:', error);
    }
  };

  // Execute trading signal
  const executeSignal = async (signal) => {
    try {
      const orderParams = {
        symbol: signal.symbol || selectedSymbol,
        side: signal.side === 'long' ? 'buy' : 'sell',
        qty: 1000, // Default position size
        type: 'market'
      };

      const order = await pocketOptionBroker.placeOrder(orderParams);
      addOrder(order);
    } catch (error) {
      console.error('Failed to execute signal:', error);
    }
  };

  // Toggle live trading
  const handleToggleLiveTrading = async () => {
    if (!isLiveTrading) {
      // Start live trading
      try {
        await pocketOptionBroker.connect();
        setLiveTrading(true);
        
        // Start scheduler for candle boundaries
        scheduler.scheduleAtCandleBoundary(
          selectedSymbol,
          selectedTimeframe,
          (data) => {
            console.log('Candle boundary reached:', data);
          }
        );
      } catch (error) {
        setError('Failed to start live trading: ' + error.message);
      }
    } else {
      // Stop live trading
      setLiveTrading(false);
      scheduler.cancelAllJobs();
      await pocketOptionBroker.disconnect();
    }
  };

  const symbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'BTCUSD'];
  const timeframes = ['1s', '5s', '15s', '30s', '1m', '5m', '15m', '30m', '1h'];

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Header Controls */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Symbol</InputLabel>
              <Select
                value={selectedSymbol}
                label="Symbol"
                onChange={(e) => setSelectedSymbol(e.target.value)}
              >
                {symbols.map(symbol => (
                  <MenuItem key={symbol} value={symbol}>{symbol}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Timeframe</InputLabel>
              <Select
                value={selectedTimeframe}
                label="Timeframe"
                onChange={(e) => setSelectedTimeframe(e.target.value)}
              >
                {timeframes.map(tf => (
                  <MenuItem key={tf} value={tf}>{tf}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item>
            <Chip
              label={connectionStatus}
              color={connectionStatus === 'connected' ? 'success' : 'error'}
              size="small"
            />
          </Grid>

          <Grid item>
            <Typography variant="body2">
              Latency: {latency}ms
            </Typography>
          </Grid>

          <Grid item>
            <Typography variant="body2">
              Price: {getLatestPrice(selectedSymbol).toFixed(5)}
            </Typography>
          </Grid>

          <Grid item sx={{ ml: 'auto' }}>
            <FormControlLabel
              control={
                <Switch
                  checked={isLiveTrading}
                  onChange={handleToggleLiveTrading}
                  disabled={connectionStatus !== 'connected'}
                />
              }
              label="Live Trading"
            />
          </Grid>
        </Grid>
      </Paper>

      <Grid container spacing={3}>
        {/* Main Chart */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2, height: 400 }}>
            <Typography variant="h6" gutterBottom>
              {selectedSymbol} - {selectedTimeframe}
            </Typography>
            <ResponsiveContainer width="100%" height="90%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" />
                <YAxis domain={['dataMin - 0.001', 'dataMax + 0.001']} />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="price" 
                  stroke="#8884d8" 
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Side Panel */}
        <Grid item xs={12} md={4}>
          {/* Strategies */}
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Strategies
            </Typography>
            {strategies.map(strategy => (
              <Box key={strategy.id} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Switch
                  checked={activeStrategies.has(strategy.id)}
                  onChange={() => toggleStrategy(strategy.id)}
                  size="small"
                />
                <Typography variant="body2" sx={{ ml: 1 }}>
                  {strategy.name}
                </Typography>
              </Box>
            ))}
          </Paper>

          {/* Performance Metrics */}
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Performance
            </Typography>
            <Grid container spacing={1}>
              <Grid item xs={6}>
                <Typography variant="body2">Total Trades:</Typography>
                <Typography variant="h6">{metrics.totalTrades}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">Win Rate:</Typography>
                <Typography variant="h6">{metrics.winRate.toFixed(1)}%</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">Total P&L:</Typography>
                <Typography variant="h6" color={metrics.totalPnL >= 0 ? 'success.main' : 'error.main'}>
                  ${metrics.totalPnL.toFixed(2)}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">Avg Timing:</Typography>
                <Typography variant="h6">{metrics.avgTimingError.toFixed(1)}ms</Typography>
              </Grid>
            </Grid>
          </Paper>

          {/* Recent Signals */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Recent Signals
            </Typography>
            <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
              {signals.slice(-5).reverse().map((signal, index) => (
                <Box key={index} sx={{ mb: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="body2">
                    <Chip 
                      label={signal.side} 
                      size="small" 
                      color={signal.side === 'long' ? 'success' : 'error'}
                      sx={{ mr: 1 }}
                    />
                    {signal.strategy} - {(signal.confidence * 100).toFixed(1)}%
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {signal.timestamp?.toLocaleTimeString()}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Trading;