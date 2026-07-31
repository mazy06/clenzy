import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, CircularProgress } from '@mui/material';
import { Cancel, Save } from '../../icons';
import PropertyForm from './PropertyForm';
import PageHeader from '../../components/PageHeader';
import { useTranslation } from '../../hooks/useTranslation';

// ─── Stable sx constants ────────────────────────────────────────────────────

const ACTION_BUTTON_SX = {
  textTransform: 'none',
  fontSize: '0.75rem',
  fontWeight: 600,
  letterSpacing: '0.01em',
  height: 28,
  px: 1.5,
  '& .MuiButton-startIcon': { mr: 0.5 },
  '& .MuiSvgIcon-root': { fontSize: 14 },
} as const;

// ─── Component ──────────────────────────────────────────────────────────────

const PropertyEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0">
        <PageHeader
          title={t('properties.modify')}
          subtitle={t('properties.subtitle')}
          backPath={`/properties/${id}`}
          backLabel={t('properties.backToDetails') || 'Retour aux détails'}
          showBackButton={true}
          actions={
            <div className="flex gap-1">
              <Button
                variant="outlined"
                onClick={() => navigate(`/properties/${id}`)}
                startIcon={<Cancel size={18} strokeWidth={1.75} />}
                size="small"
                sx={ACTION_BUTTON_SX}
                title={t('common.cancel')}
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="contained"
                onClick={() => {
                  const submitButton = document.querySelector('[data-submit-property]') as HTMLButtonElement;
                  if (submitButton) submitButton.click();
                }}
                startIcon={<Save size={18} strokeWidth={1.75} />}
                size="small"
                sx={ACTION_BUTTON_SX}
                title={t('common.save')}
              >
                {t('common.save')}
              </Button>
            </div>
          }
        />
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <PropertyForm propertyId={Number(id)} mode="edit" />
      </div>
    </div>
  );
};

export default PropertyEdit;
