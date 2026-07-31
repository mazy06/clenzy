import React from 'react';
import { Spinner } from '../../../components/ui';
import { Grid, Chip, Switch, FormControlLabel, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, IconButton, Tooltip, Card, CardContent } from '@mui/material';
import {
  Star,
  Payment,
  Warning,
  ExpandMore,
  ExpandLess,
  ContentCopy,
} from '../../../icons';
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

// Mode de synchronisation → tokens (chips -soft : texte couleur + fond -soft)
const CALENDAR_SYNC_TOKEN: Record<string, { fg: string; bg: string }> = {
  sync: { fg: 'var(--accent)', bg: 'var(--accent-soft)' },
  manuel: { fg: 'var(--info)', bg: 'var(--info-soft)' },
  non: { fg: 'var(--muted)', bg: 'var(--hover)' },
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
    <Card variant="outlined" sx={{ borderRadius: 'var(--radius-lg)', bgcolor: 'var(--card)', borderColor: 'var(--line)' }}>
      <CardContent sx={{ p: 2 }}>
        <Grid container spacing={2}>
      <Grid item xs={12}>
        <h6 className="cn-text-subtitle1 mb-2 text-[var(--accent)] font-semibold">
          Profil proprietaire
        </h6>
      </Grid>

      {user.companyName && (
        <Grid item xs={12} md={6}>
          <h6 className="cn-text-subtitle2 text-muted-foreground">Entreprise</h6>
          <p className="cn-text-body1 mb-3">{user.companyName}</p>
        </Grid>
      )}

      {user.forfait && (
        <Grid item xs={12} md={6}>
          <h6 className="cn-text-subtitle2 text-muted-foreground">Forfait souscrit</h6>
          <Chip
            icon={<Star />}
            label={user.forfait.charAt(0).toUpperCase() + user.forfait.slice(1)}
            size="small"
            sx={{ mt: 0.5, mb: 2, color: 'var(--accent)', backgroundColor: 'var(--accent-soft)', '& .MuiChip-icon': { color: 'var(--accent)' } }}
          />
        </Grid>
      )}

      {(user.city || user.postalCode) && (
        <Grid item xs={12} md={6}>
          <h6 className="cn-text-subtitle2 text-muted-foreground">Localisation</h6>
          <p className="cn-text-body1 mb-3">
            {[user.city, user.postalCode].filter(Boolean).join(' - ')}
          </p>
        </Grid>
      )}

      {user.propertyType && (
        <Grid item xs={12} md={6}>
          <h6 className="cn-text-subtitle2 text-muted-foreground">Type de propriete</h6>
          <p className="cn-text-body1 mb-3">
            {PROPERTY_TYPE_LABELS[user.propertyType] || user.propertyType}
          </p>
        </Grid>
      )}

      {user.propertyCount != null && (
        <Grid item xs={12} md={6}>
          <h6 className="cn-text-subtitle2 text-muted-foreground">Nombre de proprietes</h6>
          <p className="cn-text-body1 mb-3">{user.propertyCount}</p>
        </Grid>
      )}

      {user.surface != null && (
        <Grid item xs={12} md={6}>
          <h6 className="cn-text-subtitle2 text-muted-foreground">Surface</h6>
          <p className="cn-text-body1 mb-3">{user.surface} m2</p>
        </Grid>
      )}

      {user.guestCapacity != null && (
        <Grid item xs={12} md={6}>
          <h6 className="cn-text-subtitle2 text-muted-foreground">Capacite d'accueil</h6>
          <p className="cn-text-body1 mb-3">
            {user.guestCapacity} {user.guestCapacity > 1 ? 'personnes' : 'personne'}
          </p>
        </Grid>
      )}

      {user.bookingFrequency && (
        <Grid item xs={12} md={6}>
          <h6 className="cn-text-subtitle2 text-muted-foreground">Frequence de reservation</h6>
          <p className="cn-text-body1 mb-3">
            {BOOKING_FREQUENCY_LABELS[user.bookingFrequency] || user.bookingFrequency}
          </p>
        </Grid>
      )}

      {user.cleaningSchedule && (
        <Grid item xs={12} md={6}>
          <h6 className="cn-text-subtitle2 text-muted-foreground">Planning menage</h6>
          <p className="cn-text-body1 mb-3">
            {CLEANING_SCHEDULE_LABELS[user.cleaningSchedule] || user.cleaningSchedule}
          </p>
        </Grid>
      )}

      {user.calendarSync && (
        <Grid item xs={12} md={6}>
          <h6 className="cn-text-subtitle2 text-muted-foreground">Synchronisation calendrier</h6>
          <Chip
            label={CALENDAR_SYNC_LABELS[user.calendarSync] || user.calendarSync}
            size="small"
            sx={{
              mt: 0.5,
              mb: 2,
              color: (CALENDAR_SYNC_TOKEN[user.calendarSync] ?? CALENDAR_SYNC_TOKEN.non).fg,
              backgroundColor: (CALENDAR_SYNC_TOKEN[user.calendarSync] ?? CALENDAR_SYNC_TOKEN.non).bg,
            }}
          />
        </Grid>
      )}

      {user.services && (
        <Grid item xs={12}>
          <h6 className="cn-text-subtitle2 text-muted-foreground">Services forfait</h6>
          <div className="flex flex-wrap gap-0.5 mt-0.5 mb-3">
            {user.services.split(',').map((s) => (
              <Chip
                key={s}
                label={SERVICE_LABELS[s.trim()] || s.trim()}
                size="small"
                sx={{ color: 'var(--accent)', backgroundColor: 'var(--accent-soft)' }}
              />
            ))}
          </div>
        </Grid>
      )}

      {user.servicesDevis && (
        <Grid item xs={12}>
          <h6 className="cn-text-subtitle2 text-muted-foreground">Services sur devis</h6>
          <div className="flex flex-wrap gap-0.5 mt-0.5 mb-3">
            {user.servicesDevis.split(',').map((s) => (
              <Chip
                key={s}
                label={SERVICE_DEVIS_LABELS[s.trim()] || s.trim()}
                size="small"
                sx={{ color: 'var(--warn)', backgroundColor: 'var(--warn-soft)' }}
              />
            ))}
          </div>
        </Grid>
      )}

      {/* Toggle paiement differe (ADMIN/MANAGER uniquement) */}
      {isAdminOrManager && (
        <Grid item xs={12}>
          <div className="border border-[var(--line)] rounded-[12px] p-3 mb-1.5">
            <FormControlLabel
              control={
                <Switch
                  checked={user.deferredPayment || false}
                  onChange={onToggleDeferredPayment}
                  disabled={deferredToggling}
                />
              }
              label={
                <div>
                  <p className="cn-text-body2 font-medium">
                    Paiement differe
                  </p>
                  <span className="cn-text-caption text-muted-foreground">
                    Les interventions auto (iCal / Channel Manager) demarrent sans attente de paiement.
                    Le cumul impaye sera visible ci-dessous.
                  </span>
                </div>
              }
            />
          </div>
        </Grid>
      )}

      {/* Carte cumul impayes */}
      {isAdminOrManager && (
        <Grid item xs={12}>
          <div className="border border-[var(--line)] rounded-[12px] p-3">
            <div className="flex justify-between items-center mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex text-muted-foreground"><Payment size={20} strokeWidth={1.75} /></span>
                <p className="cn-text-body1 font-semibold">Solde impaye</p>
              </div>
              {balance && balance.totalUnpaid > 0 && (
                <Chip
                  icon={<Warning size={14} strokeWidth={1.75} />}
                  label={`${balance.totalUnpaid.toFixed(2)} EUR`}
                  size="small"
                  sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--err)', backgroundColor: 'var(--err-soft)', '& .MuiChip-icon': { color: 'var(--err)' } }}
                />
              )}
              {balance && balance.totalUnpaid === 0 && (
                <Chip label="Aucun impaye" size="small" sx={{ color: 'var(--ok)', backgroundColor: 'var(--ok-soft)' }} />
              )}
            </div>

            {balanceLoading && (
              <div className="flex justify-center py-3">
                <Spinner className="size-6" />
              </div>
            )}

            {!balanceLoading && balance && balance.properties.length > 0 && (
              <>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Propriete</TableCell>
                        <TableCell align="center">Interventions</TableCell>
                        <TableCell align="right">Montant</TableCell>
                        <TableCell align="center">Details</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {balance.properties.map((prop) => (
                        <React.Fragment key={prop.propertyId}>
                          <TableRow>
                            <TableCell sx={{ fontSize: '0.8rem' }}>{prop.propertyName}</TableCell>
                            <TableCell align="center" sx={{ fontSize: '0.8rem' }}>{prop.interventionCount}</TableCell>
                            <TableCell align="right" sx={{ fontSize: '0.8rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
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
                                  ? <ExpandLess size={18} strokeWidth={1.75} />
                                  : <ExpandMore size={18} strokeWidth={1.75} />}
                              </IconButton>
                            </TableCell>
                          </TableRow>
                          {expandedProperty === prop.propertyId && prop.interventions.map((iv) => (
                            <TableRow key={iv.id} sx={{ bgcolor: 'var(--hover)' }}>
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
                                  sx={{
                                    height: 20,
                                    fontSize: '0.65rem',
                                    color: iv.paymentStatus === 'PAID' ? 'var(--ok)' : iv.paymentStatus === 'PROCESSING' ? 'var(--info)' : 'var(--muted)',
                                    backgroundColor: iv.paymentStatus === 'PAID' ? 'var(--ok-soft)' : iv.paymentStatus === 'PROCESSING' ? 'var(--info-soft)' : 'var(--hover)',
                                  }}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                <div className="flex justify-end mt-2">
                  <Tooltip title="Cree un lien Stripe et le copie dans le presse-papier">
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<ContentCopy size={16} strokeWidth={1.75} />}
                      onClick={onSendPaymentLink}
                      disabled={paymentLinkLoading || balance.totalUnpaid === 0}
                      sx={{ fontSize: '0.8rem' }}
                    >
                      {paymentLinkLoading ? 'Creation...' : 'Envoyer lien de paiement'}
                    </Button>
                  </Tooltip>
                </div>
              </>
            )}

            {!balanceLoading && (!balance || balance.properties.length === 0) && (
              <p className="cn-text-body2 text-muted-foreground text-center py-1.5">
                Aucune intervention impayee pour ce proprietaire.
              </p>
            )}
          </div>
        </Grid>
      )}
        </Grid>
      </CardContent>
    </Card>
  );
};

export default UserHostProfileCard;
