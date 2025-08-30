import React, { useState, useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  Tab,
  Tabs,
} from '@mui/material';
import { useAuth } from '../auth/AuthProvider';

const Login = () => {
  const [tab, setTab] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { user, signIn, signUp } = useAuth();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Check if user just confirmed their email
    if (searchParams.get('confirmed') === 'true') {
      setSuccess('Email confirmed! You can now sign in.');
      setTab(0); // Switch to sign in tab
    }
  }, [searchParams]);

  if (user) {
    return <Navigate to="/trade" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const { error } = tab === 0 
        ? await signIn(email, password)
        : await signUp(email, password);

      if (error) throw error;

      if (tab === 1) {
        setSuccess('Check your email for the confirmation link! Click the link to verify your account, then return here to sign in.');
        setTab(0); // Switch to sign in tab
        setEmail('');
        setPassword('');
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="100vh"
      >
        <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
          <Typography variant="h4" align="center" gutterBottom>
            Mamorabot
          </Typography>
          
          <Tabs
            value={tab}
            onChange={(e, newValue) => setTab(newValue)}
            centered
            sx={{ mb: 3 }}
          >
            <Tab label="Sign In" />
            <Tab label="Sign Up" />
          </Tabs>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {success}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              margin="normal"
              required
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading}
            >
              {loading ? 'Loading...' : (tab === 0 ? 'Sign In' : 'Sign Up')}
            </Button>
          </form>

          {tab === 1 && (
            <Typography variant="body2" color="textSecondary" align="center">
              After signing up, check your email and click the confirmation link. 
              Then return here to sign in with your credentials.
            </Typography>
          )}
        </Paper>
      </Box>
    </Container>
  );
};

export default Login;
