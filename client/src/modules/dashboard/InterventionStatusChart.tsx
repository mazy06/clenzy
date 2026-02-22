import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress,
  Alert,
  LinearProgress
} from '@mui/material';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import { interventionsApi, Intervention } from '../../services/api';
import { extractApiList } from '../../types';

interface StatusCount {
  status: string;
  count: number;
  color: string;
}

const COLORS = {
  PENDING: '#FFA726',
  AWAITING_VALIDATION: '#FFB74D',
  AWAITING_PAYMENT: '#EF5350',
  IN_PROGRESS: '#42A5F5',
  COMPLETED: '#66BB6A',
  CANCELLED: '#BDBDBD'
};

export default function InterventionStatusChart() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [statusData, setStatusData] = useState<StatusCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canViewInterventions = user?.permissions?.includes('interventions:view') || false;

  useEffect(() => {
    // Ne pas charger les données si l'utilisateur n'a pas la permission
    if (!canViewInterventions) {
      setLoading(false);
      return;
    }

    const loadStatusData = async () => {
      try {
        const data = await interventionsApi.getAll({ size: 1000 });
        const items = extractApiList<Intervention>(data);

        // Compter les interventions par statut
        const statusCounts: { [key: string]: number } = {};
        items.forEach((item) => {
          const status = item.status || 'PENDING';
          statusCounts[status] = (statusCounts[status] || 0) + 1;
        });

        // Créer les données pour le graphique
        const chartData: StatusCount[] = Object.entries(statusCounts).map(([status, count]) => ({
          status,
          count: count as number,
          color: COLORS[status as keyof typeof COLORS] || '#9E9E9E'
        }));

        setStatusData(chartData);
      } catch (err) {
        setError('Erreur de connexion');
      } finally {
        setLoading(false);
      }
    };

    loadStatusData();
  }, []);

  const getStatusLabel = (status: string) => {
    return t(`interventions.statuses.${status}`) || status;
  };

  const total = statusData.reduce((sum, item) => sum + item.count, 0);

  // Ne pas afficher le widget si l'utilisateur n'a pas la permission
  if (!canViewInterventions) {
    return null;
  }

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600, mb: 2 }}>
          {t('dashboard.interventionStatusDistribution')}
        </Typography>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={32} />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ fontSize: '0.8125rem' }}>
            {error}
          </Alert>
        ) : statusData.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3, fontSize: '0.8125rem' }}>
            {t('dashboard.noData')}
          </Typography>
        ) : (
          <Box>
            {/* Graphique simple avec barres */}
            <Box sx={{ mb: 2 }}>
              {statusData.map((item) => {
                const percentage = (item.count / total) * 100;
                return (
                  <Box key={item.status} sx={{ mb: 1.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ fontSize: '0.8125rem', fontWeight: 500 }}>
                        {getStatusLabel(item.status)}
                      </Typography>
                      <Typography variant="body2" sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                        {item.count} ({percentage.toFixed(0)}%)
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={percentage}
                      sx={{
                        height: 8,
                        borderRadius: 1,
                        bgcolor: 'grey.200',
                        '& .MuiLinearProgress-bar': {
                          bgcolor: item.color,
                          borderRadius: 1
                        }
                      }}
                    />
                  </Box>
                );
              })}
            </Box>

          </Box>
        )}
      </CardContent>
    </Card>
  );
}
