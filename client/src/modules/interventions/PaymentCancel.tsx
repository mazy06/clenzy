import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, CardContent } from '../../components/ui';
import { Cancel, ArrowBack } from "../../icons";
import { useTranslation } from '../../hooks/useTranslation';

const PaymentCancel: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="max-w-[600px] mx-auto mt-6">
      <Card>
        {/* p: 4 = 24 px (spacing MUI 6). */}
        <CardContent className="text-center p-6">
          <span className="inline-flex text-[var(--err)] mb-3"><Cancel size={80} strokeWidth={1.5} /></span>
          <h4 className="cn-text-h4 mb-[0.35em]">
            Paiement annulé
          </h4>
          <p className="cn-text-body1 text-muted-foreground mb-4">
            Le paiement a ete annule. Vous pouvez reessayer depuis la page de facturation.
          </p>
          <Button onClick={() => navigate('/billing')}>
            <ArrowBack size={18} strokeWidth={1.75} />
            Retour a la facturation
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentCancel;
