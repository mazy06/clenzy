import React from 'react';
import StatusChip, { type StatusTone } from '../../../components/StatusChip';
import { Badge } from '../../../components/ui';
import { Spinner } from '../../../components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/ui';
import { Button } from '../../../components/ui';
import {
  Card,
  CardContent,
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  Switch,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../components/ui';
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

// Mode de synchronisation → ton de la primitive StatusChip, qui porte deja le
// couple Baitly UI conforme AA (encre `-ink` sur fond `-soft`).
const CALENDAR_SYNC_TONE: Record<string, StatusTone> = {
  sync: 'accent',
  manuel: 'info',
  non: 'neutral',
};

// Statut de paiement d'une intervention → meme grille de tons.
const PAYMENT_STATUS_TONE: Record<string, StatusTone> = {
  PAID: 'ok',
  PROCESSING: 'info',
};

// Douze champs partagent exactement le meme couple libelle/valeur : une seule
// definition, plutot que la meme chaine recopiee douze fois.
const FIELD_LABEL_CLASS = 'm-0 text-xs font-medium text-muted-foreground';
const FIELD_VALUE_CLASS = 'm-0 mb-3 text-sm text-foreground';

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
    <Card className="rounded-lg bg-card ring-0 border border-solid border-border p-0">
      <CardContent className="p-3">
        <div className="grid grid-cols-12 gap-3">
      <div className="col-span-12">
        {/* `m-0` sur les <h6>/<p> natifs : sans preflight Tailwind, ils reprennent
            sinon les marges du navigateur que `cn-text-*` neutralisait. */}
        <h6 className="m-0 mb-2 text-sm font-semibold text-primary">
          Profil proprietaire
        </h6>
      </div>

      {user.companyName && (
        <div className="col-span-12 min-[900px]:col-span-6">
          <h6 className={FIELD_LABEL_CLASS}>Entreprise</h6>
          <p className={FIELD_VALUE_CLASS}>{user.companyName}</p>
        </div>
      )}

      {user.forfait && (
        <div className="col-span-12 min-[900px]:col-span-6">
          <h6 className={FIELD_LABEL_CLASS}>Forfait souscrit</h6>
          <Badge variant="secondary" className="mt-0.5 mb-3 text-primary bg-primary-soft [&>svg]:text-primary"><Star />{user.forfait.charAt(0).toUpperCase() + user.forfait.slice(1)}</Badge>
        </div>
      )}

      {(user.city || user.postalCode) && (
        <div className="col-span-12 min-[900px]:col-span-6">
          <h6 className={FIELD_LABEL_CLASS}>Localisation</h6>
          <p className={FIELD_VALUE_CLASS}>
            {[user.city, user.postalCode].filter(Boolean).join(' - ')}
          </p>
        </div>
      )}

      {user.propertyType && (
        <div className="col-span-12 min-[900px]:col-span-6">
          <h6 className={FIELD_LABEL_CLASS}>Type de propriete</h6>
          <p className={FIELD_VALUE_CLASS}>
            {PROPERTY_TYPE_LABELS[user.propertyType] || user.propertyType}
          </p>
        </div>
      )}

      {user.propertyCount != null && (
        <div className="col-span-12 min-[900px]:col-span-6">
          <h6 className={FIELD_LABEL_CLASS}>Nombre de proprietes</h6>
          <p className={`${FIELD_VALUE_CLASS} tabular-nums`}>{user.propertyCount}</p>
        </div>
      )}

      {user.surface != null && (
        <div className="col-span-12 min-[900px]:col-span-6">
          <h6 className={FIELD_LABEL_CLASS}>Surface</h6>
          <p className={`${FIELD_VALUE_CLASS} tabular-nums`}>{user.surface} m2</p>
        </div>
      )}

      {user.guestCapacity != null && (
        <div className="col-span-12 min-[900px]:col-span-6">
          <h6 className={FIELD_LABEL_CLASS}>Capacite d'accueil</h6>
          <p className={`${FIELD_VALUE_CLASS} tabular-nums`}>
            {user.guestCapacity} {user.guestCapacity > 1 ? 'personnes' : 'personne'}
          </p>
        </div>
      )}

      {user.bookingFrequency && (
        <div className="col-span-12 min-[900px]:col-span-6">
          <h6 className={FIELD_LABEL_CLASS}>Frequence de reservation</h6>
          <p className={FIELD_VALUE_CLASS}>
            {BOOKING_FREQUENCY_LABELS[user.bookingFrequency] || user.bookingFrequency}
          </p>
        </div>
      )}

      {user.cleaningSchedule && (
        <div className="col-span-12 min-[900px]:col-span-6">
          <h6 className={FIELD_LABEL_CLASS}>Planning menage</h6>
          <p className={FIELD_VALUE_CLASS}>
            {CLEANING_SCHEDULE_LABELS[user.cleaningSchedule] || user.cleaningSchedule}
          </p>
        </div>
      )}

      {user.calendarSync && (
        <div className="col-span-12 min-[900px]:col-span-6">
          <h6 className={FIELD_LABEL_CLASS}>Synchronisation calendrier</h6>
          <StatusChip tone={CALENDAR_SYNC_TONE[user.calendarSync] ?? 'neutral'} label={CALENDAR_SYNC_LABELS[user.calendarSync] || user.calendarSync} className="mt-0.5 mb-3" />
        </div>
      )}

      {user.services && (
        <div className="col-span-12">
          <h6 className={FIELD_LABEL_CLASS}>Services forfait</h6>
          <div className="flex flex-wrap gap-0.5 mt-0.5 mb-3">
            {user.services.split(',').map((s) => (
              <Badge variant="secondary" className="text-primary bg-primary-soft" key={s}>{SERVICE_LABELS[s.trim()] || s.trim()}</Badge>
            ))}
          </div>
        </div>
      )}

      {user.servicesDevis && (
        <div className="col-span-12">
          <h6 className={FIELD_LABEL_CLASS}>Services sur devis</h6>
          <div className="flex flex-wrap gap-0.5 mt-0.5 mb-3">
            {user.servicesDevis.split(',').map((s) => (
              // Encre `-ink` et non la teinte vive : sur fond pastel, #D4A574 en
              // texte plafonne tres en dessous du 4,5:1.
              <Badge variant="secondary" className="text-warning-ink bg-warning-soft" key={s}>{SERVICE_DEVIS_LABELS[s.trim()] || s.trim()}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Toggle paiement differe (ADMIN/MANAGER uniquement) */}
      {isAdminOrManager && (
        <div className="col-span-12">
          <div className="border border-solid border-border rounded-lg p-3 mb-1.5">
            <Field orientation="horizontal">
              <Switch
                id="deferred-payment"
                checked={user.deferredPayment || false}
                onCheckedChange={onToggleDeferredPayment}
                disabled={deferredToggling}
              />
              <FieldContent>
                <FieldLabel htmlFor="deferred-payment" className="text-xs font-medium">
                  Paiement differe
                </FieldLabel>
                <FieldDescription>
                  Les interventions auto (iCal / Channel Manager) demarrent sans attente de paiement.
                  Le cumul impaye sera visible ci-dessous.
                </FieldDescription>
              </FieldContent>
            </Field>
          </div>
        </div>
      )}

      {/* Carte cumul impayes */}
      {isAdminOrManager && (
        <div className="col-span-12">
          <div className="border border-solid border-border rounded-lg p-3">
            <div className="flex justify-between items-center mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex text-muted-foreground"><Payment size={20} strokeWidth={1.75} /></span>
                <p className="m-0 text-sm font-semibold text-foreground">Solde impaye</p>
              </div>
              {balance && balance.totalUnpaid > 0 && (
                <Badge variant="secondary" className="font-bold tabular-nums text-destructive-ink bg-destructive-soft [&>svg]:text-destructive-ink"><Warning size={14} strokeWidth={1.75} />{`${balance.totalUnpaid.toFixed(2)} EUR`}</Badge>
              )}
              {balance && balance.totalUnpaid === 0 && (
                <Badge variant="secondary" className="text-success-ink bg-success-soft">Aucun impaye</Badge>
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
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={expandedProperty === prop.propertyId
                                ? `Masquer le detail de ${prop.propertyName}`
                                : `Afficher le detail de ${prop.propertyName}`}
                              onClick={() => onExpandProperty(
                                expandedProperty === prop.propertyId ? null : prop.propertyId
                              )}
                            >
                              {expandedProperty === prop.propertyId
                                ? <ExpandLess size={18} strokeWidth={1.75} />
                                : <ExpandMore size={18} strokeWidth={1.75} />}
                            </Button>
                          </TableCell>
                        </TableRow>
                        {expandedProperty === prop.propertyId && prop.interventions.map((iv) => (
                          // `ps` (padding-inline-start) plutot que `pl` : le kit raisonne en
                          // proprietes logiques, l'indentation doit suivre le sens de lecture.
                          <TableRow key={iv.id} className="bg-muted">
                            <TableCell className="text-[0.75rem] ps-6">{iv.title}</TableCell>
                            <TableCell className="text-center text-[0.75rem]">
                              {iv.scheduledDate ? new Date(iv.scheduledDate).toLocaleDateString('fr-FR') : '-'}
                            </TableCell>
                            <TableCell className="text-end text-[0.75rem]">
                              {iv.estimatedCost.toFixed(2)} EUR
                            </TableCell>
                            <TableCell className="text-center">
                              <StatusChip tone={PAYMENT_STATUS_TONE[iv.paymentStatus ?? ''] ?? 'neutral'} label={iv.paymentStatus || 'N/A'} className="h-[20px] text-[0.65rem]" />
                            </TableCell>
                          </TableRow>
                        ))}
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>

                <div className="flex justify-end mt-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {/* Le Button du kit ne transmet pas de ref : le span
                          intercalaire porte celle que Radix pose. */}
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
                    </TooltipTrigger>
                    <TooltipContent>Cree un lien Stripe et le copie dans le presse-papier</TooltipContent>
                  </Tooltip>
                </div>
              </>
            )}

            {!balanceLoading && (!balance || balance.properties.length === 0) && (
              <p className="m-0 py-1.5 text-center text-xs text-muted-foreground">
                Aucune intervention impayee pour ce proprietaire.
              </p>
            )}
          </div>
        </div>
      )}
        </div>
      </CardContent>
    </Card>
  );
};

export default UserHostProfileCard;
