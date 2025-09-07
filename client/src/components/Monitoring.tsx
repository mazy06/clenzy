import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
} from '@mui/material';
import {
  Security,
} from '@mui/icons-material';
import TokenMonitoring from './TokenMonitoring';

interface MonitoringProps {
  isAdmin?: boolean;
}

const Monitoring: React.FC<MonitoringProps> = ({ isAdmin = false }) => {
  if (!isAdmin) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" color="textSecondary">
            Monitoring
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Accès réservé aux administrateurs
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box>
      <Card>
        <CardContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: 'text.primary', display: 'flex', alignItems: 'center' }}>
              <Security sx={{ mr: 1, color: 'text.secondary' }} />
              Monitoring des Tokens
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Surveillance des tokens JWT et gestion des sessions.
            </Typography>
          </Box>
          
          <TokenMonitoring />
        </CardContent>
      </Card>
    </Box>
  );
};

export default Monitoring;
