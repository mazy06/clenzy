import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Chip,
  Switch,
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  Star,
  Payment,
  Warning,
  ExpandMore,
  ExpandLess,
  ContentCopy,
} from '@mui/icons-material';
import type { HostBalanceSummary } from '../../../services/api';
import type { UserDetailsData } from './userDetailsTypes';

interface UserHostProfileCardProps {
  user: UserDetailsData;
  isAdminOrManager: boolean;
  // Deferred payment
  deferredToggling: boolean;
  onToggleDeferredPayment: () => void;
  // Balance
  balance: HostBalanceSummary | null;
  balanceLoading: boolean;
  expandedProperty: number | null;
  onExpandProperty: (id: number | null) => void;
  // Payment link
  paymentLinkLoading: boolean;
  onSendPaymentLink: () => void;
}

const SERVICE_LABELS: Record<string, string> = {
  'menage-complet': 'Menage complet',
  'linge': 'Changement du linge',
  'poubelles': 'Gestion des poubelles',
  'desinfection': 'Desinfection',
  'reassort': 'Reassort consommables',
};

const SERVICE_DEVIS_LABELS: Record<string, string> = {
  'repassage': 'Repassage',
  'vitres': 'Nettoyage des vitres',
  'blanchisserie': 'Blanchisserie',
  'pressing': 'Pressing',
  'plomberie': 'Plomberie',
  'electricite': 'Electricite',
  'serrurerie': 'Serrurerie',
  'bricolage': 'Petit bricolage',
  'autre-maintenance': 'Autre intervention',
};

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  studio: 'Studio',
  appartement: 'Appartement',
  maison: 'Maison',
  duplex: 'Duplex',
  villa: 'Villa',
  autre: 'Autre',
};

const BOOKING_FREQUENCY_LABELS: Record<string, string> = {
  'tres-frequent': 'Tres frequent (3+ / semaine)',
  'regulier': 'Regulier (1-2 / semaine)',
  'occasionnel': 'Occasionnel (quelques / mois)',
  'nouvelle-annonce': 'Nouvelle annonce',
};

const CLEANING_SCHEDULE_LABELS: Record<string, string> = {
  'entre-voyageurs': 'Entre chaque voyageur',
  'hebdomadaire': 'Hebdomadaire',
  'bi-mensuel': 'Bi-mensuel',
  'mensuel': 'Mensuel',
  'ponctuel': 'Ponctuel',
};

const CALENDAR_SYNC_LABELS: Record<string, string> = {
  sync: 'Synchronisation automatique',
  manuel: 'Gestion manuelle',
  non: 'Pas de calendrier',
};

const CALENDAR_SYNC_COLORS: Record<string, 'primary' | 'info' | 'default'> = {
  sync: 'primary',
  manuel: 'info',
  non: 'default',
};

const hasHostData = (user: UserDetailsData): boolean =>
  user.role === 'HOST' &&
  !!(user.forfait || user.city || user.propertyType || user.surface || user.companyName || user.bookingFrequency || user.calendarSync || user.services);

const UserHostProfileCard: React.FC<UserHostProfileCardProps> = ({
  user,
  isAdminOrManager,
  deferredToggling,
  onToggleDeferredPayment,
  balance,
  balanceLoading,
  expandedProperty,
  onExpandProperty,
  paymentLinkLoading,
  onSendPaymentLink,
}) => {
  if (!hasHostData(user)) return null;

  return (
    <>
      <Grid item xs={12}>
        <Typography variant="subtitle1" sx={{ mb: 1.5, color: 'primary.main', fontWeight: 600 }}>
          Profil proprietaire
        </Typography>
      </Grid>

      {user.companyName && (
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" color="text.secondary">Entreprise</Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>{user.companyName}</Typography>
        </Grid>
      )}

      {user.forfait && (
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" color="text.secondary">Forfait souscrit</Typography>
          <Chip
            icon={<Star />}
            label={user.forfait.charAt(0).toUpperCase() + user.forfait.slice(1)}
            color="primary"
            variant="outlined"
            size="small"
            sx={{ mt: 0.5, mb: 2 }}
          />
        </Grid>
      )}

      {(user.city || user.postalCode) && (
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" color="text.secondary">Localisation</Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            {[user.city, user.postalCode].filter(Boolean).join(' - ')}
          </Typography>
        </Grid>
      )}

      {user.propertyType && (
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" color="text.secondary">Type de propriete</Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            {PROPERTY_TYPE_LABELS[user.propertyType] || user.propertyType}
          </Typography>
        </Grid>
      )}

      {user.propertyCount != null && (
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" color="text.secondary">Nombre de proprietes</Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>{user.propertyCount}</Typography>
        </Grid>
      )}

      {user.surface != null && (
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" color="text.secondary">Surface</Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>{user.surface} m2</Typography>
        </Grid>
      )}

      {user.guestCapacity != null && (
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" color="text.secondary">Capacite d'accueil</Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            {user.guestCapacity} {user.guestCapacity > 1 ? 'personnes' : 'personne'}
          </Typography>
        </Grid>
      )}

      {user.bookingFrequency && (
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" color="text.secondary">Frequence de reservation</Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            {BOOKING_FREQUENCY_LABELS[user.bookingFrequency] || user.bookingFrequency}
          </Typography>
        </Grid>
      )}

      {user.cleaningSchedule && (
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" color="text.secondary">Planning menage</Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            {CLEANING_SCHEDULE_LABELS[user.cleaningSchedule] || user.cleaningSchedule}
          </Typography>
        </Grid>
      )}

      {user.calendarSync && (
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" color="text.secondary">Synchronisation calendrier</Typography>
          <Chip
            label={CALENDAR_SYNC_LABELS[user.calendarSync] || user.calendarSync}
            color={CALENDAR_SYNC_COLORS[user.calendarSync] || 'default'}
            variant="outlined"
            size="small"
            sx={{ mt: 0.5, mb: 2 }}
          />
        </Grid>
      )}

      {user.services && (
        <Grid item xs={12}>
          <Typography variant="subtitle2" color="text.secondary">Services forfait</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5, mb: 2 }}>
            {user.services.split(',').map((s) => (
              <Chip
                key={s}
                label={SERVICE_LABELS[s.trim()] || s.trim()}
                size="small"
                color="primary"
                variant="outlined"
              />
            ))}
          </Box>
        </Grid>
      )}

      {user.servicesDevis && (
        <Grid item xs={12}>
          <Typography variant="subtitle2" color="text.secondary">Services sur devis</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5, mb: 2 }}>
            {user.servicesDevis.split(',').map((s) => (
              <Chip
                key={s}
                label={SERVICE_DEVIS_LABELS[s.trim()] || s.trim()}
                size="small"
                color="warning"
                variant="outlined"
              />
            ))}
          </Box>
        </Grid>
      )}

      {/* Toggle paiement differe (ADMIN/MANAGER uniquement) */}
      {isAdminOrManager && (
        <Grid item xs={12}>
          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2, mb: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={user.deferredPayment || false}
                  onChange={onToggleDeferredPayment}
                  disabled={deferredToggling}
                />
              }
              label={
                <Box>
                  <Typography variant="body2" fontWeight={500}>
                    Paiement differe
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Les interventions auto (iCal / Channel Manager) demarrent sans attente de paiement.
                    Le cumul impaye sera visible ci-dessous.
                  </Typography>
                </Box>
              }
            />
          </Box>
        </Grid>
      )}

      {/* Carte cumul impayes */}
      {isAdminOrManager && (
        <Grid item xs={12}>
          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Payment sx={{ fontSize: 20, color: 'text.secondary' }} />
                <Typography variant="body1" fontWeight={600}>Solde impaye</Typography>
              </Box>
              {balance && balance.totalUnpaid > 0 && (
                <Chip
                  icon={<Warning sx={{ fontSize: 14 }} />}
                  label={`${balance.totalUnpaid.toFixed(2)} EUR`}
                  color="error"
                  size="small"
                  sx={{ fontWeight: 700 }}
                />
              )}
              {balance && balance.totalUnpaid === 0 && (
                <Chip label="Aucun impaye" color="success" size="small" variant="outlined" />
              )}
            </Box>

            {balanceLoading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={24} />
              </Box>
            )}

            {!balanceLoading && balance && balance.properties.length > 0 && (
              <>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Propriete</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Interventions</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Montant</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Details</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {balance.properties.map((prop) => (
                        <React.Fragment key={prop.propertyId}>
                          <TableRow>
                            <TableCell sx={{ fontSize: '0.8rem' }}>{prop.propertyName}</TableCell>
                            <TableCell align="center" sx={{ fontSize: '0.8rem' }}>{prop.interventionCount}</TableCell>
                            <TableCell align="right" sx={{ fontSize: '0.8rem', fontWeight: 600 }}>
                              {prop.unpaidAmount.toFixed(2)} EUR
                            </TableCell>
                            <TableCell align="center">
                              <IconButton
                                size="small"
                                onClick={() => onExpandProperty(
                                  expandedProperty === prop.propertyId ? null : prop.propertyId
                                )}
                              >
                                {expandedProperty === prop.propertyId
                                  ? <ExpandLess sx={{ fontSize: 18 }} />
                                  : <ExpandMore sx={{ fontSize: 18 }} />}
                              </IconButton>
                            </TableCell>
                          </TableRow>
                          {expandedProperty === prop.propertyId && prop.interventions.map((iv) => (
                            <TableRow key={iv.id} sx={{ bgcolor: 'action.hover' }}>
                              <TableCell sx={{ fontSize: '0.75rem', pl: 4 }}>{iv.title}</TableCell>
                              <TableCell align="center" sx={{ fontSize: '0.75rem' }}>
                                {iv.scheduledDate ? new Date(iv.scheduledDate).toLocaleDateString('fr-FR') : '-'}
                              </TableCell>
                              <TableCell align="right" sx={{ fontSize: '0.75rem' }}>
                                {iv.estimatedCost.toFixed(2)} EUR
                              </TableCell>
                              <TableCell align="center">
                                <Chip
                                  label={iv.paymentStatus || 'N/A'}
                                  size="small"
                                  color={iv.paymentStatus === 'PAID' ? 'success' : iv.paymentStatus === 'PROCESSING' ? 'info' : 'default'}
                                  variant="outlined"
                                  sx={{ height: 20, fontSize: '0.65rem' }}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.5 }}>
                  <Tooltip title="Cree un lien Stripe et le copie dans le presse-papier">
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<ContentCopy sx={{ fontSize: 16 }} />}
                      onClick={onSendPaymentLink}
                      disabled={paymentLinkLoading || balance.totalUnpaid === 0}
                      sx={{ fontSize: '0.8rem' }}
                    >
                      {paymentLinkLoading ? 'Creation...' : 'Envoyer lien de paiement'}
                    </Button>
                  </Tooltip>
                </Box>
              </>
            )}

            {!balanceLoading && (!balance || balance.properties.length === 0) && (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 1 }}>
                Aucune intervention impayee pour ce proprietaire.
              </Typography>
            )}
          </Box>
        </Grid>
      )}
    </>
  );
};

export default UserHostProfileCard;
