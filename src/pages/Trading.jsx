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
  CardContent,
  CircularProgress
} from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '../auth/AuthProvider';

const Trading = () => {
  const { user, profile } = useAuth();
  const [selectedSymbol, setSelectedSymbol] = useState('EURUSD');
  const [selectedTimeframe, setSelectedTimeframe] = useState('1m');
  const [isLiveTrading, setLiveTrading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [latency, setLatency] = useState(0);
  const [chartData, setChartData] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [strategies, setStrategies] = useState([]);
  const [activeStrategies, setActiveStrategies] = useState(new Set());
  const [signals, setSignals] = useState([]);
  const [currentPrice, setCurrentPrice] = useState(1.0850);

  // Mock metrics
  const [metrics] = useState({
    totalTrades: 0,
    winRate: 0,
    totalPnL: 0,
    avgTimingError: 0
  });

  // Initialize component
  useEffect(() => {
    const initializeTrading = async () => {
      try {
        setLoading(true);
        
        // Simulate WebSocket connection
        setTimeout(() => {
          setConnectionStatus('connected');
          setLatency(Math.floor(Math.random() * 50) + 10);
        }, 1000);

        // Load mock strategies
        const mockStrategies = [
          { id: 1, name: 'Moving Average Cross', active: true },
          { id: 2, name: 'RSI Oversold/Overbought', active: false },
          { id: 3, name: 'Bollinger Bands', active: false }
        ];
        setStrategies(mockStrategies);

        // Generate mock chart data
        const mockData = [];
        const basePrice = 1.0850;
        for (let i = 0; i < 50; i++) {
          const price = basePrice + (Math.random() - 0.5) * 0.01;
          mockData.push({
            time: Date.now() - (50 - i) * 60000,
            price: price,
            timestamp: new Date(Date.now() - (50 - i) * 60000).toLocaleTimeString()
          });
        }
        setChartData(mockData);

      } catch (error) {
        console.error('Error initializing trading:', error);
        setError('Failed to initialize trading interface');
      } finally {
        setLoading(false);
      }
    };

    initializeTrading();
  }, []);

  // Simulate real-time price updates
  useEffect(() => {
    if (connectionStatus === 'connected') {
      const interval = setInterval(() => {
        const newPrice = currentPrice + (Math.random() - 0.5) * 0.0001;
        setCurrentPrice(newPrice);
        
        // Update chart data
        setChartData(prev => {
          const newData = [...prev, {
            time: Date.now(),
            price: newPrice,
            timestamp: new Date().toLocaleTimeString()
          }];
          
          // Keep only last 50 points
          if (newData.length > 50) {
            newData.shift();
          }
          
          return newData;
        });

        // Update latency
        setLatency(Math.floor(Math.random() * 50) + 10);
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [connectionStatus, currentPrice]);

  // Toggle strategy
  const toggleStrategy = (strategyId) => {
    setActiveStrategies(prev => {
      const newSet = new Set(prev);
      if (newSet.has(strategyId)) {
        newSet.delete(strategyId);
      } else {
        newSet.add(strategyId);
      }
      return newSet;
    });
  };

  // Toggle live trading
  const handleToggleLiveTrading = () => {
    if (!isLiveTrading) {
      setLiveTrading(true);
      // Simulate some signals
      setTimeout(() => {
        setSignals(prev => [...prev, {
          id: Date.now(),
          side: 'long',
          strategy: 'Moving Average Cross',
          confidence: 0.85,
          timestamp: new Date()
        }]);
      }, 5000);
    } else {
      setLiveTrading(false);
    }
  };

  const symbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'BTCUSD'];
  const timeframes = ['1s', '5s', '15s', '30s', '1m', '5m', '15m', '30m', '1h'];

  if (loading) {
    return (
      <Box 
        display="flex" 
        flexDirection="column"
        justifyContent="center" 
        alignItems="center" 
        minHeight="100vh"
      >
        <CircularProgress size={60} sx={{ mb: 2 }} />
        <Typography>Loading trading interface...</Typography>
      </Box>
    );
  }

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
              Price: {currentPrice.toFixed(5)}
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
                <Typography variant="body2">Status:</Typography>
                <Typography variant="h6">
                  {isLiveTrading ? 'Active' : 'Inactive'}
                </Typography>
              </Grid>
            </Grid>
          </Paper>

          {/* Recent Signals */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Recent Signals
            </Typography>
            <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
              {signals.length === 0 ? (
                <Typography variant="body2" color="textSecondary">
                  No signals yet. Enable live trading to start generating signals.
                </Typography>
              ) : (
                signals.slice(-5).reverse().map((signal, index) => (
                  <Box key={signal.id || index} sx={{ mb: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
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
                ))
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Trading;
