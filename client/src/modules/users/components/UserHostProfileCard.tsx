import React from 'react';
import StatusChip from '../../../components/StatusChip';
import { Badge } from '../../../components/ui';
import { Spinner } from '../../../components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/ui';
import { Button } from '../../../components/ui';
import { Grid, Switch, FormControlLabel, IconButton, Tooltip, Card, CardContent } from '@mui/material';
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
          <Badge variant="secondary" className="mt-0.5 mb-3 text-[var(--accent)] bg-[var(--accent-soft)] [&>svg]:text-[var(--accent)]"><Star />{user.forfait.charAt(0).toUpperCase() + user.forfait.slice(1)}</Badge>
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
          <StatusChip tokens={{ color: (CALENDAR_SYNC_TOKEN[user.calendarSync] ?? CALENDAR_SYNC_TOKEN.non).fg, bg: (CALENDAR_SYNC_TOKEN[user.calendarSync] ?? CALENDAR_SYNC_TOKEN.non).bg }} label={CALENDAR_SYNC_LABELS[user.calendarSync] || user.calendarSync} className="mt-0.5 mb-3" />
        </Grid>
      )}

      {user.services && (
        <Grid item xs={12}>
          <h6 className="cn-text-subtitle2 text-muted-foreground">Services forfait</h6>
          <div className="flex flex-wrap gap-0.5 mt-0.5 mb-3">
            {user.services.split(',').map((s) => (
              <Badge variant="secondary" className="text-[var(--accent)] bg-[var(--accent-soft)]" key={s}>{SERVICE_LABELS[s.trim()] || s.trim()}</Badge>
            ))}
          </div>
        </Grid>
      )}

      {user.servicesDevis && (
        <Grid item xs={12}>
          <h6 className="cn-text-subtitle2 text-muted-foreground">Services sur devis</h6>
          <div className="flex flex-wrap gap-0.5 mt-0.5 mb-3">
            {user.servicesDevis.split(',').map((s) => (
              <Badge variant="secondary" className="text-[var(--warn)] bg-[var(--warn-soft)]" key={s}>{SERVICE_DEVIS_LABELS[s.trim()] || s.trim()}</Badge>
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
                <Badge variant="secondary" className="font-bold tabular-nums text-[var(--err)] bg-[var(--err-soft)] [&>svg]:text-[var(--err)]"><Warning size={14} strokeWidth={1.75} />{`${balance.totalUnpaid.toFixed(2)} EUR`}</Badge>
              )}
              {balance && balance.totalUnpaid === 0 && (
                <Badge variant="secondary" className="text-[var(--ok)] bg-[var(--ok-soft)]">Aucun impaye</Badge>
              )}
            </div>

            {balanceLoading && (
              <div className="flex justify-center py-3">
                <Spinner className="size-6" />
              </div>
            )}

            {!balanceLoading && balance && balance.properties.length > 0 && (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Propriete</TableHead>
                      <TableHead className="text-center">Interventions</TableHead>
                      <TableHead className="text-end">Montant</TableHead>
                      <TableHead className="text-center">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {balance.properties.map((prop) => (
                      <React.Fragment key={prop.propertyId}>
                        <TableRow>
                          <TableCell className="text-[0.8rem]">{prop.propertyName}</TableCell>
                          <TableCell className="text-center text-[0.8rem]">{prop.interventionCount}</TableCell>
                          <TableCell className="text-end text-[0.8rem] font-semibold tabular-nums">
                            {prop.unpaidAmount.toFixed(2)} EUR
                          </TableCell>
                          <TableCell className="text-center">
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
                          // `ps` (padding-inline-start) plutot que `pl` : le kit raisonne en
                          // proprietes logiques, l'indentation doit suivre le sens de lecture.
                          <TableRow key={iv.id} className="bg-[var(--hover)]">
                            <TableCell className="text-[0.75rem] ps-6">{iv.title}</TableCell>
                            <TableCell className="text-center text-[0.75rem]">
                              {iv.scheduledDate ? new Date(iv.scheduledDate).toLocaleDateString('fr-FR') : '-'}
                            </TableCell>
                            <TableCell className="text-end text-[0.75rem]">
                              {iv.estimatedCost.toFixed(2)} EUR
                            </TableCell>
                            <TableCell className="text-center">
                              <StatusChip tokens={{ color: iv.paymentStatus === 'PAID' ? 'var(--ok)' : iv.paymentStatus === 'PROCESSING' ? 'var(--info)' : 'var(--muted)', bg: iv.paymentStatus === 'PAID' ? 'var(--ok-soft)' : iv.paymentStatus === 'PROCESSING' ? 'var(--info-soft)' : 'var(--hover)' }} label={iv.paymentStatus || 'N/A'} className="h-[20px] text-[0.65rem]" />
                            </TableCell>
                          </TableRow>
                        ))}
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>

                <div className="flex justify-end mt-2">
                  {/* Le Button du kit ne transmet pas de ref : le Tooltip MUI pose la
                      sienne sur le span intercalaire. */}
                  <Tooltip title="Cree un lien Stripe et le copie dans le presse-papier">
                    <span className="inline-flex">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={onSendPaymentLink}
                        disabled={paymentLinkLoading || balance.totalUnpaid === 0}
                      >
                        <ContentCopy size={16} strokeWidth={1.75} />
                        {paymentLinkLoading ? 'Creation...' : 'Envoyer lien de paiement'}
                      </Button>
                    </span>
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
