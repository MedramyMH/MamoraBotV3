import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { CircularProgress, Box, Typography } from '@mui/material';

const ProtectedRoute = ({ children, roles = [] }) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <Box 
        display="flex" 
        flexDirection="column"
        justifyContent="center" 
        alignItems="center" 
        minHeight="100vh"
      >
        <CircularProgress sx={{ mb: 2 }} />
        <Typography>Loading user profile...</Typography>
      </Box>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Wait for profile to load before checking roles
  if (!profile) {
    return (
      <Box 
        display="flex" 
        flexDirection="column"
        justifyContent="center" 
        alignItems="center" 
        minHeight="100vh"
      >
        <CircularProgress sx={{ mb: 2 }} />
        <Typography>Setting up your profile...</Typography>
      </Box>
    );
  }

  if (roles.length > 0 && !roles.includes(profile?.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

export default ProtectedRoute;
