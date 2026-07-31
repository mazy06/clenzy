import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, CardContent } from '@mui/material';
import { Cancel, ArrowBack } from "../../icons";
import { useTranslation } from '../../hooks/useTranslation';

const PaymentCancel: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="max-w-[600px] mx-auto mt-6">
      <Card>
        <CardContent sx={{ textAlign: 'center', p: 4 }}>
          <span className="inline-flex text-[var(--err)] mb-3"><Cancel size={80} strokeWidth={1.5} /></span>
          <h4 className="cn-text-h4 mb-[0.35em]">
            Paiement annulé
          </h4>
          <p className="cn-text-body1 text-muted-foreground mb-4">
            Le paiement a ete annule. Vous pouvez reessayer depuis la page de facturation.
          </p>
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
    </div>
  );
};

export default PaymentCancel;
