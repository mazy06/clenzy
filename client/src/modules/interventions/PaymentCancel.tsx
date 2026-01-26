import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Card, CardContent } from '@mui/material';
import { Cancel, ArrowBack } from '@mui/icons-material';
import { useTranslation } from '../../hooks/useTranslation';

const PaymentCancel: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
      <Card>
        <CardContent sx={{ textAlign: 'center', p: 4 }}>
          <Cancel sx={{ fontSize: 80, color: 'error.main', mb: 2 }} />
          <Typography variant="h4" gutterBottom>
            Paiement annulé
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Le paiement a été annulé. L'intervention n'a pas été créée.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<ArrowBack />}
            onClick={() => navigate('/interventions/new')}
          >
            Réessayer
          </Button>
          <Button
            variant="outlined"
            sx={{ ml: 2 }}
            onClick={() => navigate('/interventions')}
          >
            Retour aux interventions
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
};

export default PaymentCancel;
