import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  Chip,
  Alert,
  CircularProgress,
  Divider
} from '@mui/material';
import { useTradingStore } from '../store/tradingStore';

const TradingAssistant = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  
  const {
    selectedSymbol,
    latestPrices,
    signals,
    metrics,
    isLiveTrading
  } = useTradingStore();

  const handleSendMessage = useCallback(async () => {
    if (!input.trim()) return;

    const userMessage = { type: 'user', content: input, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Simulate AI response (replace with actual AI integration)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const aiResponse = generateAIResponse(input, {
        symbol: selectedSymbol,
        price: latestPrices.get(selectedSymbol),
        signals: signals.slice(-3),
        metrics,
        isLiveTrading
      });

      const assistantMessage = { 
        type: 'assistant', 
        content: aiResponse, 
        timestamp: new Date() 
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage = { 
        type: 'error', 
        content: 'Sorry, I encountered an error. Please try again.', 
        timestamp: new Date() 
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }, [input, selectedSymbol, latestPrices, signals, metrics, isLiveTrading]);

  const generateAIResponse = (query, context) => {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('price') || lowerQuery.includes('current')) {
      return `The current price of ${context.symbol} is ${context.price?.toFixed(5) || 'N/A'}`;
    }
    
    if (lowerQuery.includes('signal') || lowerQuery.includes('trade')) {
      const recentSignals = context.signals || [];
      if (recentSignals.length > 0) {
        const latest = recentSignals[recentSignals.length - 1];
        return `Latest signal: ${latest.side} ${latest.strategy} with ${(latest.confidence * 100).toFixed(1)}% confidence`;
      }
      return 'No recent signals available';
    }
    
    if (lowerQuery.includes('performance') || lowerQuery.includes('stats')) {
      return `Performance: ${context.metrics?.totalTrades || 0} trades, ${context.metrics?.winRate?.toFixed(1) || 0}% win rate, P&L: $${context.metrics?.totalPnL?.toFixed(2) || 0}`;
    }
    
    if (lowerQuery.includes('status')) {
      return `Trading status: ${context.isLiveTrading ? 'Live trading active' : 'Paper trading mode'}`;
    }
    
    return 'I can help you with price information, trading signals, performance metrics, and system status. What would you like to know?';
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Paper sx={{ height: 400, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6">Trading Assistant</Typography>
      </Box>
      
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 1 }}>
        <List dense>
          {messages.map((message, index) => (
            <ListItem key={index} sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                <Chip
                  label={message.type === 'user' ? 'You' : 'Assistant'}
                  size="small"
                  color={message.type === 'user' ? 'primary' : 'secondary'}
                  sx={{ mr: 1 }}
                />
                <Typography variant="caption" color="textSecondary">
                  {message.timestamp.toLocaleTimeString()}
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ ml: 1 }}>
                {message.content}
              </Typography>
              {index < messages.length - 1 && <Divider sx={{ width: '100%', mt: 1 }} />}
            </ListItem>
          ))}
          {loading && (
            <ListItem>
              <CircularProgress size={20} sx={{ mr: 1 }} />
              <Typography variant="body2">Assistant is thinking...</Typography>
            </ListItem>
          )}
        </List>
      </Box>
      
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <TextField
          fullWidth
          multiline
          maxRows={3}
          placeholder="Ask about prices, signals, performance..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={loading}
          size="small"
        />
        <Button
          fullWidth
          variant="contained"
          onClick={handleSendMessage}
          disabled={loading || !input.trim()}
          sx={{ mt: 1 }}
        >
          Send
        </Button>
      </Box>
    </Paper>
  );
};

export default TradingAssistant;