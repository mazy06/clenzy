import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Typography,
} from '@mui/material';
import {
  Assignment as AssignmentIcon,
  Build as BuildIcon,
  Group as GroupIcon,
  LocationOn as LocationIcon,
  Person as PersonIcon,
  PriorityHigh as PriorityHighIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import {
  InterventionDetailsData,
  formatDate,
  formatDuration,
  formatCurrency,
} from './interventionUtils';

interface InterventionSidebarProps {
  intervention: InterventionDetailsData;
}

const InterventionSidebar: React.FC<InterventionSidebarProps> = ({ intervention }) => {
  return (
    <Grid item xs={12} md={4}>
      <Card
        sx={{
          position: 'sticky',
          top: 16,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          borderRadius: 2
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Typography
            variant="h6"
            fontWeight={700}
            gutterBottom
            sx={{
              mb: 3,
              fontSize: '1.1rem',
              color: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}
          >
            <AssignmentIcon sx={{ fontSize: 24 }} />
            Informations de l'intervention
          </Typography>

          {/* Section Propriété */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <LocationIcon sx={{ fontSize: 20, color: 'primary.main' }} />
              <Typography variant="subtitle2" fontWeight={600} sx={{ fontSize: '0.9rem', color: 'text.primary' }}>
                Propriété
              </Typography>
            </Box>
            <Box sx={{ pl: 4 }}>
              <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.9rem', mb: 0.5, color: 'text.primary' }}>
                {intervention.propertyName}
              </Typography>
              <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1.5 }}>
                {intervention.propertyAddress}, {intervention.propertyCity} {intervention.propertyPostalCode}, {intervention.propertyCountry}
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ my: 2.5 }} />

          {/* Section Personnes */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <PersonIcon sx={{ fontSize: 20, color: 'primary.main' }} />
              <Typography variant="subtitle2" fontWeight={600} sx={{ fontSize: '0.9rem', color: 'text.primary' }}>
                Demandeur
              </Typography>
            </Box>
            <Box sx={{ pl: 4 }}>
              <Typography variant="body2" sx={{ fontSize: '0.85rem', color: 'text.primary' }}>
                {intervention.requestorName}
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ my: 2.5 }} />

          {/* Section Assignation */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              {intervention.assignedToType === 'team' ? (
                <GroupIcon sx={{ fontSize: 20, color: 'primary.main' }} />
              ) : (
                <PersonIcon sx={{ fontSize: 20, color: 'primary.main' }} />
              )}
              <Typography variant="subtitle2" fontWeight={600} sx={{ fontSize: '0.9rem', color: 'text.primary' }}>
                Assignation
              </Typography>
            </Box>
            <Box sx={{ pl: 4 }}>
              <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.85rem', mb: 0.25, color: 'text.primary' }}>
                {intervention.assignedToName}
              </Typography>
              <Chip
                label={intervention.assignedToType === 'team' ? 'Équipe' : 'Utilisateur'}
                size="small"
                variant="outlined"
                sx={{
                  height: 20,
                  fontSize: '0.65rem',
                  mt: 0.5
                }}
              />
            </Box>
          </Box>

          <Divider sx={{ my: 2.5 }} />

          {/* Section Détails techniques */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <BuildIcon sx={{ fontSize: 20, color: 'primary.main' }} />
              <Typography variant="subtitle2" fontWeight={600} sx={{ fontSize: '0.9rem', color: 'text.primary' }}>
                Détails techniques
              </Typography>
            </Box>
            <Box sx={{ pl: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                <ScheduleIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                <Box>
                  <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary', display: 'block' }}>
                    Durée estimée
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: '0.85rem', color: 'text.primary' }}>
                    {formatDuration(intervention.estimatedDurationHours)}
                  </Typography>
                </Box>
              </Box>
              {intervention.estimatedCost && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <PriorityHighIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <Box>
                    <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary', display: 'block' }}>
                      Coût estimé
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '0.85rem', color: 'text.primary' }}>
                      {formatCurrency(intervention.estimatedCost)}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>
          </Box>

          <Divider sx={{ my: 2.5 }} />

          {/* Section Informations temporelles */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <ScheduleIcon sx={{ fontSize: 20, color: 'primary.main' }} />
              <Typography variant="subtitle2" fontWeight={600} sx={{ fontSize: '0.9rem', color: 'text.primary' }}>
                Informations temporelles
              </Typography>
            </Box>
            <Box sx={{ pl: 4 }}>
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary', display: 'block', mb: 0.5 }}>
                  Créée le
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.85rem', color: 'text.primary' }}>
                  {formatDate(intervention.createdAt)}
                </Typography>
              </Box>
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary', display: 'block', mb: 0.5 }}>
                  Dernière mise à jour
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.85rem', color: 'text.primary' }}>
                  {intervention.updatedAt ? formatDate(intervention.updatedAt) : 'Aucune'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary', display: 'block', mb: 0.5 }}>
                  Terminée le
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.85rem', color: 'text.primary' }}>
                  {intervention.completedAt ? formatDate(intervention.completedAt) : 'Non terminée'}
                </Typography>
              </Box>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Grid>
  );
};

export default InterventionSidebar;
