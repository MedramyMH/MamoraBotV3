import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box, AppBar, Toolbar, Typography, Button, CircularProgress } from '@mui/material';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import ProtectedRoute from './auth/ProtectedRoute';
import Login from './pages/Login';
import Trading from './pages/Trading';
import Admin from './pages/Admin';

// Create theme
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

// Create query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

// Navigation component
const Navigation = () => {
  const { user, profile, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  if (!user) return null;

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          Mamorabot
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2">
            {profile?.role || 'User'}
          </Typography>
          
          {profile?.role === 'admin' && (
            <Button color="inherit" href="/admin">
              Admin
            </Button>
          )}
          
          <Button color="inherit" href="/trade">
            Trading
          </Button>
          
          <Button color="inherit" onClick={handleSignOut}>
            Sign Out
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box 
          display="flex" 
          flexDirection="column"
          justifyContent="center" 
          alignItems="center" 
          minHeight="100vh"
          sx={{ p: 4, textAlign: 'center' }}
        >
          <Typography variant="h4" gutterBottom color="error">
            Something went wrong
          </Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </Typography>
          <Button 
            variant="contained" 
            onClick={() => window.location.reload()}
          >
            Reload Page
          </Button>
        </Box>
      );
    }

    return this.props.children;
  }
}

// Main App component
const AppContent = () => {
  const { loading, user } = useAuth();

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
        <Typography>Loading application...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Navigation />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route 
          path="/trade" 
          element={
            <ProtectedRoute roles={['admin', 'trader']}>
              <Trading />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute roles={['admin']}>
              <Admin />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/unauthorized" 
          element={
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="h4" gutterBottom>
                Access Denied
              </Typography>
              <Typography>
                You don't have permission to access this page.
              </Typography>
            </Box>
          } 
        />
        <Route 
          path="/" 
          element={
            user ? <Navigate to="/trade" replace /> : <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="*" 
          element={
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="h4" gutterBottom>
                Page Not Found
              </Typography>
              <Typography>
                The page you're looking for doesn't exist.
              </Typography>
            </Box>
          } 
        />
      </Routes>
    </Box>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <AuthProvider>
            <Router>
              <AppContent />
            </Router>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;