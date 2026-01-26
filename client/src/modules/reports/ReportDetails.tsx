import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Alert,
  Chip
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Download as DownloadIcon,
  Assessment as AssessmentIcon,
  Euro as EuroIcon,
  Schedule as ScheduleIcon,
  People as PeopleIcon,
  Home as HomeIcon
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import PageHeader from '../../components/PageHeader';
import { API_CONFIG } from '../../config/api';

interface ReportItem {
  id: string;
  title: string;
  description: string;
  type: string;
  dateRange: string;
  status: 'available' | 'generating' | 'error';
}

const ReportDetails: React.FC = () => {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const { user, hasPermissionAsync, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);

  const reportTypes = {
    financial: {
      title: t('reports.sections.financial.title'),
      icon: <EuroIcon color="primary" />,
      permission: 'reports:view',
      reports: [
        {
          id: 'revenue',
          title: t('reports.financial.revenue.title'),
          description: t('reports.financial.revenue.description'),
          type: 'financial',
          dateRange: 'monthly',
          status: 'available' as const
        },
        {
          id: 'costs',
          title: t('reports.financial.costs.title'),
          description: t('reports.financial.costs.description'),
          type: 'financial',
          dateRange: 'monthly',
          status: 'available' as const
        },
        {
          id: 'profit',
          title: t('reports.financial.profit.title'),
          description: t('reports.financial.profit.description'),
          type: 'financial',
          dateRange: 'monthly',
          status: 'available' as const
        }
      ]
    },
    interventions: {
      title: t('reports.sections.interventions.title'),
      icon: <ScheduleIcon color="success" />,
      permission: 'reports:view',
      reports: [
        {
          id: 'performance',
          title: t('reports.interventions.performance.title'),
          description: t('reports.interventions.performance.description'),
          type: 'interventions',
          dateRange: 'monthly',
          status: 'available' as const
        },
        {
          id: 'planning',
          title: t('reports.interventions.planning.title'),
          description: t('reports.interventions.planning.description'),
          type: 'interventions',
          dateRange: 'weekly',
          status: 'available' as const
        },
        {
          id: 'completion',
          title: t('reports.interventions.completion.title'),
          description: t('reports.interventions.completion.description'),
          type: 'interventions',
          dateRange: 'monthly',
          status: 'available' as const
        }
      ]
    },
    teams: {
      title: t('reports.sections.teams.title'),
      icon: <PeopleIcon color="info" />,
      permission: 'teams:view',
      reports: [
        {
          id: 'performance',
          title: t('reports.teams.performance.title'),
          description: t('reports.teams.performance.description'),
          type: 'teams',
          dateRange: 'monthly',
          status: 'available' as const
        },
        {
          id: 'availability',
          title: t('reports.teams.availability.title'),
          description: t('reports.teams.availability.description'),
          type: 'teams',
          dateRange: 'weekly',
          status: 'available' as const
        },
        {
          id: 'workload',
          title: t('reports.teams.workload.title'),
          description: t('reports.teams.workload.description'),
          type: 'teams',
          dateRange: 'monthly',
          status: 'available' as const
        }
      ]
    },
    properties: {
      title: t('reports.sections.properties.title'),
      icon: <HomeIcon color="warning" />,
      permission: 'reports:view',
      reports: [
        {
          id: 'status',
          title: t('reports.properties.status.title'),
          description: t('reports.properties.status.description'),
          type: 'properties',
          dateRange: 'current',
          status: 'available' as const
        },
        {
          id: 'maintenance',
          title: t('reports.properties.maintenance.title'),
          description: t('reports.properties.maintenance.description'),
          type: 'properties',
          dateRange: 'monthly',
          status: 'available' as const
        },
        {
          id: 'costs',
          title: t('reports.properties.costs.title'),
          description: t('reports.properties.costs.description'),
          type: 'properties',
          dateRange: 'monthly',
          status: 'available' as const
        }
      ]
    }
  };

  const currentReportType = type && reportTypes[type as keyof typeof reportTypes];

  useEffect(() => {
    // Attendre que l'authentification soit terminée ET que l'utilisateur soit disponible
    if (authLoading || !user) {
      if (authLoading) {
        console.log('🔍 ReportDetails - En attente du chargement de l\'authentification...');
      } else if (!user) {
        console.log('🔍 ReportDetails - En attente du chargement de l\'utilisateur...');
      }
      return;
    }

    if (!currentReportType) {
      setError(t('reports.invalidType'));
      return;
    }

    const checkPermission = async () => {
      // Triple vérification : s'assurer que user est toujours défini
      if (!user) {
        console.warn('🔍 ReportDetails - Utilisateur non disponible lors de la vérification');
        setError(t('reports.noPermission'));
        setReports([]);
        return;
      }

      console.log('🔍 ReportDetails - Vérification permission', { 
        permission: currentReportType.permission,
        type,
        userId: user.id,
        userPermissions: user.permissions,
        userRoles: user.roles
      });
      
      try {
        const hasPermission = await hasPermissionAsync(currentReportType.permission);
        console.log('🔍 ReportDetails - Résultat permission', { hasPermission });
        
        if (!hasPermission) {
          console.warn('🔍 ReportDetails - Permission refusée', {
            permission: currentReportType.permission,
            userPermissions: user.permissions
          });
          setError(t('reports.noPermission'));
          setReports([]); // S'assurer que les rapports sont vidés
          return;
        }
        console.log('🔍 ReportDetails - Permission accordée, chargement des rapports', { 
          reportsCount: currentReportType.reports.length 
        });
        setReports(currentReportType.reports);
        setError(null); // S'assurer que l'erreur est effacée
      } catch (err) {
        console.error('🔍 ReportDetails - Erreur lors de la vérification de permission:', err);
        setError(t('reports.noPermission'));
        setReports([]);
      }
    };

    checkPermission();
  }, [type, currentReportType, hasPermissionAsync, t, user, authLoading]);

  const handleGenerateReport = async (reportId: string) => {
    console.log('🔍 ReportDetails - handleGenerateReport appelé', { type, reportId, currentReportType });
    
    if (!type || !currentReportType) {
      console.error('🔍 ReportDetails - Paramètres manquants', { type, currentReportType });
      setError('Type de rapport ou catégorie manquant');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('kc_access_token');
      console.log('🔍 ReportDetails - Token récupéré', { hasToken: !!token });
      
      if (!token) {
        console.error('🔍 ReportDetails - Pas de token d\'authentification');
        setError(t('reports.authenticationError'));
        setLoading(false);
        return;
      }

      // Calculer les dates (dernier mois par défaut)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);
      
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      const apiUrl = `${API_CONFIG.BASE_URL}/api/reports/${type}/${reportId}?startDate=${startDateStr}&endDate=${endDateStr}`;
      console.log('🔍 ReportDetails - Appel API', { apiUrl, type, reportId, startDateStr, endDateStr });

      // Appeler l'API pour générer le rapport avec timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 secondes timeout

      let response: Response;
      try {
        response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        });
        clearTimeout(timeoutId);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error('La génération du rapport a pris trop de temps. Veuillez réessayer.');
        }
        throw new Error(`Erreur de connexion: ${fetchError.message || 'Impossible de contacter le serveur'}`);
      }

      console.log('🔍 ReportDetails - Réponse API', { 
        status: response.status, 
        statusText: response.statusText,
        contentType: response.headers.get('content-type'),
        ok: response.ok 
      });

      if (!response.ok) {
        let errorText = '';
        try {
          errorText = await response.text();
        } catch (e) {
          errorText = 'Erreur lors de la lecture de la réponse';
        }
        
        console.error('🔍 ReportDetails - Erreur API', { 
          status: response.status, 
          statusText: response.statusText,
          errorText 
        });
        
        let errorMessage = `Erreur ${response.status}: ${response.statusText}`;
        try {
          if (errorText) {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.message || errorJson.error || errorMessage;
          }
        } catch (e) {
          // Si ce n'est pas du JSON, utiliser le texte brut
          if (errorText) {
            errorMessage = errorText.length > 200 ? errorText.substring(0, 200) + '...' : errorText;
          }
        }
        
        throw new Error(errorMessage);
      }

      // Vérifier que c'est bien un PDF
      const contentType = response.headers.get('content-type');
      console.log('🔍 ReportDetails - Content-Type', { contentType });
      
      if (!contentType || !contentType.includes('pdf')) {
        console.warn('🔍 ReportDetails - Le contenu n\'est pas un PDF', { contentType });
        // Ne pas bloquer, certains serveurs peuvent ne pas envoyer le bon content-type
      }

      // Récupérer le PDF avec gestion d'erreur
      let blob: Blob;
      try {
        blob = await response.blob();
      } catch (blobError: any) {
        throw new Error(`Erreur lors de la récupération du fichier: ${blobError.message}`);
      }
      
      console.log('🔍 ReportDetails - Blob créé', { size: blob.size, type: blob.type });
      
      if (blob.size === 0) {
        throw new Error('Le fichier PDF généré est vide');
      }

      // Créer et télécharger le fichier avec gestion d'erreur
      try {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rapport-${type}-${reportId}-${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        
        // Nettoyer après un court délai
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }, 100);
        
        console.log('🔍 ReportDetails - Téléchargement déclenché');
      } catch (downloadError: any) {
        throw new Error(`Erreur lors du téléchargement: ${downloadError.message}`);
      }
      
    } catch (err: any) {
      console.error('🔍 ReportDetails - Erreur génération rapport:', err);
      const errorMessage = err?.message || err?.toString() || t('reports.generationError');
      setError(errorMessage);
      // Ne pas relancer l'erreur pour éviter un écran blanc
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReport = async (reportId: string) => {
    // Même logique que handleGenerateReport
    await handleGenerateReport(reportId);
  };

  if (!currentReportType) {
    return (
      <Box>
        <Alert severity="error">{t('reports.invalidType')}</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/reports')}>
          {t('common.back')}
        </Button>
      </Box>
    );
  }

  // Afficher un loader pendant le chargement de l'authentification
  if (authLoading) {
    return (
      <Box>
        <PageHeader
          title={currentReportType?.title || t('reports.title')}
          subtitle={t('reports.selectReport')}
          backPath="/reports"
          showBackButton={true}
        />
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title={currentReportType.title}
        subtitle={t('reports.selectReport')}
        backPath="/reports"
        showBackButton={true}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Box sx={{ textAlign: 'center', p: 4 }}>
          <Typography variant="body1" color="text.secondary">
            {t('reports.noPermissionMessage')}
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {reports.map((report) => (
            <Grid item xs={12} md={6} lg={4} key={report.id}>
              <Card 
                sx={{ 
                  height: '100%', 
                  position: 'relative',
                  '&:hover': {
                    boxShadow: 3
                  }
                }}
                onClick={(e) => {
                  // Empêcher le Card de capturer les clics sur les boutons
                  e.stopPropagation();
                }}
              >
                <CardContent sx={{ position: 'relative', zIndex: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box>
                      <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600, mb: 1 }}>
                        {report.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem', mb: 1 }}>
                        {report.description}
                      </Typography>
                      <Chip
                        label={t(`reports.dateRange.${report.dateRange}`)}
                        size="small"
                        sx={{ fontSize: '0.6875rem' }}
                        color="primary"
                        variant="outlined"
                      />
                    </Box>
                    <Chip
                      label={t(`reports.status.${report.status}`)}
                      size="small"
                      sx={{ fontSize: '0.6875rem' }}
                      color={report.status === 'available' ? 'success' : 'default'}
                    />
                  </Box>
                  <Box 
                    sx={{ 
                      display: 'flex', 
                      gap: 1, 
                      mt: 2,
                      position: 'relative',
                      zIndex: 2
                    }}
                    onClick={(e) => {
                      // Empêcher la propagation vers le Card
                      e.stopPropagation();
                    }}
                  >
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<AssessmentIcon />}
                      onClick={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('🔍 ReportDetails - Bouton Generate cliqué', { 
                          reportId: report.id,
                          reportStatus: report.status,
                          loading,
                          disabled: report.status !== 'available' || loading
                        });
                        
                        // Vérifier la permission de génération
                        const canGenerate = await hasPermissionAsync('reports:generate');
                        if (!canGenerate) {
                          console.warn('🔍 ReportDetails - Permission reports:generate refusée');
                          setError(t('reports.noPermission'));
                          return;
                        }
                        
                        if (report.status === 'available' && !loading) {
                          handleGenerateReport(report.id);
                        } else {
                          console.warn('🔍 ReportDetails - Bouton désactivé', { 
                            status: report.status, 
                            loading 
                          });
                        }
                      }}
                      disabled={report.status !== 'available' || loading}
                      sx={{ 
                        flex: 1, 
                        pointerEvents: (report.status !== 'available' || loading) ? 'none' : 'auto',
                        position: 'relative',
                        zIndex: 3
                      }}
                    >
                      {loading ? t('common.loading') : t('reports.generate')}
                    </Button>
                    {report.status === 'available' && (
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<DownloadIcon />}
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('🔍 ReportDetails - Bouton Download cliqué', { 
                            reportId: report.id,
                            loading,
                            disabled: loading
                          });
                          
                          // Vérifier la permission de téléchargement
                          const canDownload = await hasPermissionAsync('reports:download');
                          if (!canDownload) {
                            console.warn('🔍 ReportDetails - Permission reports:download refusée');
                            setError(t('reports.noPermission'));
                            return;
                          }
                          
                          if (!loading) {
                            handleDownloadReport(report.id);
                          } else {
                            console.warn('🔍 ReportDetails - Bouton désactivé (loading)');
                          }
                        }}
                        disabled={loading}
                        sx={{ 
                          flex: 1, 
                          pointerEvents: loading ? 'none' : 'auto',
                          position: 'relative',
                          zIndex: 3
                        }}
                      >
                        {t('reports.download')}
                      </Button>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {reports.length === 0 && !loading && !error && (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            {t('reports.noReportsAvailable')}
          </Typography>
        </Paper>
      )}
    </Box>
  );
};

export default ReportDetails;
