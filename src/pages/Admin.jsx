import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Grid,
  Card,
  CardContent,
  Switch,
  FormControlLabel
} from '@mui/material';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabaseClient';

const Admin = () => {
  const { profile } = useAuth();
  const [users, setUsers] = useState([]);
  const [strategies, setStrategies] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [systemSettings, setSystemSettings] = useState({
    maintenanceMode: false,
    maxConcurrentUsers: 100,
    tradingEnabled: true,
    maxStrategiesPerUser: 5
  });

  useEffect(() => {
    if (profile?.role === 'admin') {
      loadAdminData();
    }
  }, [profile]);

  const loadAdminData = async () => {
    try {
      setLoading(true);
      
      // Load users
      const { data: usersData, error: usersError } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (usersError) throw usersError;
      setUsers(usersData || []);

      // Load strategies
      const { data: strategiesData, error: strategiesError } = await supabase
        .from('strategies')
        .select(`
          *,
          user_profiles(role)
        `)
        .order('created_at', { ascending: false });
      
      if (strategiesError) throw strategiesError;
      setStrategies(strategiesData || []);

      // Load recent sessions
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select(`
          *,
          user_profiles(role)
        `)
        .order('started_at', { ascending: false })
        .limit(50);
      
      if (sessionsError) throw sessionsError;
      setSessions(sessionsData || []);

    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId, newRole) => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ role: newRole })
        .eq('id', userId);
      
      if (error) throw error;
      
      // Refresh users list
      loadAdminData();
    } catch (error) {
      setError(error.message);
    }
  };

  const toggleStrategyStatus = async (strategyId, active) => {
    try {
      const { error } = await supabase
        .from('strategies')
        .update({ active })
        .eq('id', strategyId);
      
      if (error) throw error;
      
      // Refresh strategies list
      loadAdminData();
    } catch (error) {
      setError(error.message);
    }
  };

  if (profile?.role !== 'admin') {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="error">
          Access denied. Admin privileges required.
        </Alert>
      </Container>
    );
  }

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Typography>Loading admin dashboard...</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        Admin Dashboard
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Users
              </Typography>
              <Typography variant="h4">
                {users.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Active Strategies
              </Typography>
              <Typography variant="h4">
                {strategies.filter(s => s.active).length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Active Sessions
              </Typography>
              <Typography variant="h4">
                {sessions.filter(s => !s.ended_at).length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Admin Users
              </Typography>
              <Typography variant="h4">
                {users.filter(u => u.role === 'admin').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Users Management */}
      <Paper sx={{ mb: 3 }}>
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            User Management
          </Typography>
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>User ID</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.id.substring(0, 8)}...</TableCell>
                  <TableCell>
                    <Chip 
                      label={user.role} 
                      color={user.role === 'admin' ? 'error' : user.role === 'trader' ? 'primary' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {new Date(user.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                      <Select
                        value={user.role}
                        onChange={(e) => updateUserRole(user.id, e.target.value)}
                      >
                        <MenuItem value="viewer">Viewer</MenuItem>
                        <MenuItem value="trader">Trader</MenuItem>
                        <MenuItem value="admin">Admin</MenuItem>
                      </Select>
                    </FormControl>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Strategies Management */}
      <Paper sx={{ mb: 3 }}>
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Strategy Management
          </Typography>
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Strategy Name</TableCell>
                <TableCell>Owner</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {strategies.map((strategy) => (
                <TableRow key={strategy.id}>
                  <TableCell>{strategy.name}</TableCell>
                  <TableCell>{strategy.owner?.substring(0, 8)}...</TableCell>
                  <TableCell>
                    <Chip 
                      label={strategy.active ? 'Active' : 'Inactive'} 
                      color={strategy.active ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {new Date(strategy.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => toggleStrategyStatus(strategy.id, !strategy.active)}
                    >
                      {strategy.active ? 'Disable' : 'Enable'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Container>
  );
};

export default Admin;