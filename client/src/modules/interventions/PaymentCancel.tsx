import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Card, CardContent } from '@mui/material';
import { Cancel, ArrowBack } from "../../icons";
import { useTranslation } from '../../hooks/useTranslation';

const PaymentCancel: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
      <Card>
        <CardContent sx={{ textAlign: 'center', p: 4 }}>
          <Box component="span" sx={{ display: "inline-flex", color: "error.main", mb: 2 }}><Cancel size={80} strokeWidth={1.5} /></Box>
          <Typography variant="h4" gutterBottom>
            Paiement annulé
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Le paiement a ete annule. Vous pouvez reessayer depuis la page de facturation.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<ArrowBack size={18} strokeWidth={1.75} />}
            onClick={() => navigate('/billing')}
          >
            Retour a la facturation
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
};

export default PaymentCancel;
