import React from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../utils/cn';
import {
  Badge,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../components/ui';
import {
  ArrowBack,
  Close,
  DeleteOutline,
  ExpandMore,
  OpenInNew,
  Settings as SettingsIcon,
} from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../contexts/AuthContext';
import { SCREEN_ICON, sizedIcon } from '../../config/navigationIcons';
import { Money } from '../../components/baitly/Money';
import RatingStars from '../../components/baitly/RatingStars';
import { businessActionsFor } from './notificationActions';
import NotificationDevicePanel, {
  NotificationDeviceSkeleton,
  deviceIdOf,
  useNotificationDevice,
} from './NotificationDevicePanel';
import NotificationReviewPanel, {
  NotificationReviewSkeleton,
  reviewIdOf,
  useNotificationReview,
} from './NotificationReviewPanel';
import NotificationAccessCodePanel, {
  NotificationAccessCodeSkeleton,
  accessCodePropertyIdOf,
  useNotificationAccessCode,
} from './NotificationAccessCodePanel';
import NotificationPricingPanel, {
  NotificationPricingSkeleton,
  pricingCardOf,
  useNotificationPricing,
} from './NotificationPricingPanel';
import NotificationStayPanel, {
  NotificationStayActions,
  NotificationStaySkeleton,
  reservationIdOf,
  useNotificationStay,
} from './NotificationStayPanel';
import { resolveSubject } from './NotificationSubjectPanel';
import type { Notification } from '../../services/api';
import {
  FACT_ICON,
  TYPE_BADGE_VARIANT,
  categoryStyle,
  formatFactDate,
  fullTimestamp,
  resolveDestination,
  resolveMetadataFacts,
  timeAgo,
  type NotificationFact,
} from './notificationMeta';

interface NotificationDetailCardProps {
  notification: Notification;
  /** Retour mobile vers la liste (master-detail) ; sinon simple fermeture. */
  showBack?: boolean;
  onClose: () => void;
  onDelete: (id: number) => void;
}

/**
 * Un fait du dossier : intitule a gauche, valeur a droite. La grille en deux
 * colonnes se lit en descendant la colonne des valeurs — l'empilement
 * intitule-au-dessus-de-la-valeur obligeait a lire en zigzag.
 */
function Fact({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <>
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {/* Icone et intitule dans la MEME encre : l'icone prolonge le mot, elle
            ne se pose pas a cote comme une decoration. */}
        {icon && <span className="inline-flex shrink-0">{sizedIcon(icon, 14, 1.75)}</span>}
        {label}
      </dt>
      <dd className="m-0 min-w-0 text-sm break-words text-foreground">{children}</dd>
    </>
  );
}

/** Un fait du dossier, rendu selon sa nature — texte, date, sejour, montant. */
function FactValue({ fact, lang }: { fact: NotificationFact; lang: string }) {
  if (fact.kind === 'money') {
    return (
      <span className="font-medium tabular-nums">
        <Money value={fact.value} from={fact.currency} />
      </span>
    );
  }
  if (fact.kind === 'stay') {
    return (
      <span className="tabular-nums">
        {formatFactDate(fact.from, lang)} → {formatFactDate(fact.to, lang)}
      </span>
    );
  }
  if (fact.kind === 'date') {
    return <span className="tabular-nums">{formatFactDate(fact.value, lang)}</span>;
  }
  if (fact.kind === 'decibels') {
    return <span className="tabular-nums">{Math.round(fact.value)} dB</span>;
  }
  if (fact.kind === 'rating') {
    return (
      <span className="inline-flex items-center gap-1.5">
        <RatingStars value={fact.value} />
        <span className="font-medium tabular-nums">{fact.value}/5</span>
      </span>
    );
  }
  return <>{fact.value}</>;
}

/** Intitule de section : discret, il ne doit pas concurrencer son contenu. */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="m-0 text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </h3>
  );
}

/**
 * Volet droit de l'ecran Notifications : ce qui s'est passe, sur quoi, et ce
 * qu'il reste a faire.
 *
 * <p><b>Hierarchie.</b> Le metier d'abord — le message, le dossier concerne, la
 * lecture de l'evenement, le geste attendu. La plomberie ensuite : le code
 * d'evenement, la reference interne, l'ecran vise ne disent rien a un hote et
 * encombraient le haut de la fiche. Ils vivent desormais dans un repli, et
 * seulement pour le staff plateforme (SUPER_ADMIN / SUPER_MANAGER) qui en a
 * besoin pour un diagnostic.</p>
 *
 * <p><b>Les gestes sont ancres en pied.</b> Colles au bas du volet plutot que
 * flottant apres le texte : ils restent atteignables quel que soit la longueur
 * du message, et la fiche ne se termine plus sur une grande zone vide.</p>
 */
export default function NotificationDetailCard({
  notification,
  showBack = false,
  onClose,
  onDelete,
}: NotificationDetailCardProps) {
  const navigate = useNavigate();
  const { t, currentLanguage } = useTranslation();
  const { isPlatformStaff } = useAuth();
  const showTechnical = isPlatformStaff();
  const [technicalOpen, setTechnicalOpen] = React.useState(false);

  const style = categoryStyle(notification.category);
  const businessActions = businessActionsFor(notification);

  // Une notification de reputation designe un avis : la fiche va le chercher et
  // le MONTRE — visage, etoiles, logo du canal, commentaire cite — au lieu de
  // laisser lire la phrase qui le resume. Tant que l'avis n'est pas la (ou s'il
  // ne se charge pas), c'est bien cette phrase qui reste affichee.
  const reviewId = reviewIdOf(notification);
  const { review, loading: reviewLoading } = useNotificationReview(reviewId);
  const showsReview = reviewId !== null && (reviewLoading || review !== null);

  // Meme principe pour un objet connecte : « Batterie serrure a 12 % » se lit,
  // mais ne se voit pas. Le panneau vient ICI EN PLUS du message — contrairement
  // a l'avis, ou le message ne faisait que redire le contenu de la fiche : ici
  // il nomme le geste (« Planifier » cree l'intervention), ce que l'etat du
  // materiel ne dit pas.
  const deviceId = deviceIdOf(notification);
  const { device, loading: deviceLoading } = useNotificationDevice(deviceId);

  const reservationId = reservationIdOf(notification);
  const { stay, loading: stayLoading, reload: reloadStay } = useNotificationStay(reservationId);

  const accessCodePropertyId = accessCodePropertyIdOf(notification);
  const { instructions, loading: accessCodeLoading } = useNotificationAccessCode(accessCodePropertyId);

  const pricingCard = React.useMemo(() => pricingCardOf(notification), [notification]);
  const { plan, loading: pricingLoading } = useNotificationPricing(pricingCard);

  const destination = resolveDestination(notification.actionUrl);
  const destinationLabel = destination?.translationKey
    ? t(destination.translationKey, destination.fallbackLabel ?? '')
    : null;
  const destinationIcon = destination?.screenPath ? SCREEN_ICON[destination.screenPath] : undefined;

  // Le logement remonte dans l'entete : c'est la premiere question qu'on se
  // pose devant une alerte. Il quitte donc le releve, ou il ferait doublon.
  const allFacts = resolveMetadataFacts(notification.metadata);
  const propertyFact = allFacts.find((fact) => fact.key === 'property');
  const propertyName = propertyFact?.kind === 'text' ? propertyFact.value : null;
  const facts = allFacts.filter((fact) => fact.key !== 'property');

  // Le reste des notifications n'a pas d'objet a aller chercher : leurs faits
  // suffisent a en dessiner un — un sejour, un montant, une mission.
  const subject = resolveSubject(facts, notification);

  // Un fait deja dit par un panneau ne se redit pas dans le releve. La fiche de
  // l'avis absorbe le voyageur et la note ; le panneau de sujet declare ce qu'il
  // consomme. Quand il ne reste rien, la section entiere disparait.
  const spoken = new Set<string>(subject?.consumed ?? []);
  if (review) {
    spoken.add('guest');
    spoken.add('rating');
  }
  const remainingFacts = facts.filter((fact) => !spoken.has(fact.key));

  const title = notification.notificationKey
    ? t(`notifications.keys.${notification.notificationKey}`, { defaultValue: notification.title })
    : notification.title;

  const categoryLabel = t(`notifications.categories.${notification.category}`, notification.category);
  const typeLabel = t(`notifications.levels.${notification.type}`, notification.type);
  const receivedAt = fullTimestamp(notification.createdAt, currentLanguage);

  // La CLE d'abord, la categorie ensuite. Une carte de la constellation est
  // rangee en categorie « systeme » : sans cette priorite, la fiche d'un stock
  // bas annoncait « evenement de plateforme : synchronisation d'un canal » et
  // concluait « rien a faire » — juste au-dessus d'un bouton « Commander ».
  const byKeyThenCategory = (kind: 'explain' | 'nextStep', fallback: string) => {
    const byCategory = t(`notifications.detail.${kind}.${notification.category}`,
      t(`notifications.detail.${kind}.default`, fallback));
    return notification.notificationKey
      ? t(`notifications.detail.${kind}.${notification.notificationKey}`, byCategory)
      : byCategory;
  };
  /** Un panneau porte deja le motif : la fiche ne le redit pas au-dessus de lui. */
  const messageTakenOver = stay !== null || instructions !== null || plan !== null;

  const explanation = byKeyThenCategory('explain', 'Cet événement a été enregistré par la plateforme.');
  const nextStep = byKeyThenCategory(
    'nextStep',
    "Ouvrez l'écran concerné pour agir sur l'élément à l'origine de cette notification.",
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
      {/* ── Entete : quoi, sur quoi, quand ─────────────────────────────────── */}
      <header className="flex items-start gap-3 border-b border-border px-5 py-4">
        {showBack && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('common.back', 'Retour')}
            onClick={onClose}
            className="-ms-1.5 mt-0.5"
          >
            <ArrowBack size={18} strokeWidth={1.75} />
          </Button>
        )}

        <span
          className={cn(
            'mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg',
            style.accent,
          )}
        >
          {style.icon}
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-lg leading-snug font-semibold text-balance text-foreground">
            {title}
          </h2>

          {/* Une seule ligne de contexte, dans l'ordre ou on la lit : gravite,
              logement, anciennete. L'horodatage complet reste au survol. */}
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-muted-foreground">
            <Badge variant={TYPE_BADGE_VARIANT[notification.type] ?? 'info'}>{typeLabel}</Badge>
            {propertyName && (
              <>
                <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                  <span className="inline-flex shrink-0 text-muted-foreground">
                    {sizedIcon(FACT_ICON.property, 14, 1.75)}
                  </span>
                  {propertyName}
                </span>
                <span aria-hidden="true">·</span>
              </>
            )}
            <time dateTime={notification.createdAt} title={receivedAt}>
              {timeAgo(notification.createdAt, t, currentLanguage)}
            </time>
            {!notification.read && (
              <Badge variant="secondary">{t('notifications.detail.unreadBadge', 'Non lue')}</Badge>
            )}
          </div>
        </div>

        {!showBack && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('common.close', 'Fermer')}
            onClick={onClose}
            className="-me-1.5"
          >
            <Close size={18} strokeWidth={1.75} />
          </Button>
        )}
      </header>

      {/* ── Corps : le metier ──────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 py-5">
        {deviceId !== null &&
          (device ? (
            <NotificationDevicePanel device={device} />
          ) : deviceLoading ? (
            <NotificationDeviceSkeleton />
          ) : null)}

        {reservationId !== null &&
          (stay ? (
            <NotificationStayPanel stay={stay} observation={notification.message} />
          ) : stayLoading ? (
            <NotificationStaySkeleton />
          ) : null)}

        {pricingCard &&
          (plan ? (
            <NotificationPricingPanel
              plan={plan}
              propertyId={pricingCard.propertyId}
              propertyName={propertyName}
              observation={notification.message}
            />
          ) : pricingLoading ? (
            <NotificationPricingSkeleton />
          ) : null)}

        {accessCodePropertyId !== null &&
          (instructions ? (
            <NotificationAccessCodePanel
              instructions={instructions}
              propertyName={propertyName}
              observation={notification.message}
            />
          ) : accessCodeLoading ? (
            <NotificationAccessCodeSkeleton />
          ) : null)}

        {showsReview ? (
          review ? <NotificationReviewPanel review={review} /> : <NotificationReviewSkeleton />
        ) : (
          /* Le motif n'est rendu ici que si aucun panneau ne l'a PRIS : ceux qui
             ouvrent un dossier le portent desormais en pied de carte, et le lire
             deux fois au meme ecran n'apprenait rien. */
          !messageTakenOver && (
            <p className="m-0 text-[15px] leading-relaxed whitespace-pre-line text-foreground">
              {notification.message}
            </p>
          )
        )}

        {subject?.node}

        {remainingFacts.length > 0 && (
          <section className="flex flex-col gap-2.5">
            <SectionTitle>{t('notifications.detail.subject', 'Ce qui est concerné')}</SectionTitle>
            <dl className="m-0 grid grid-cols-[minmax(0,max-content)_minmax(0,1fr)] items-baseline gap-x-4 gap-y-2">
              {remainingFacts.map((fact) => (
                <Fact
                  key={fact.key}
                  label={t(`notifications.detail.metadata.${fact.key}`, fact.key)}
                  icon={FACT_ICON[fact.key]}
                >
                  <FactValue fact={fact} lang={currentLanguage} />
                </Fact>
              ))}
            </dl>
          </section>
        )}

        <section className="flex flex-col gap-2">
          <SectionTitle>{t('notifications.detail.meaning', 'Ce que cela signifie')}</SectionTitle>
          <p className="m-0 text-sm leading-relaxed text-muted-foreground">{explanation}</p>
        </section>

        {/* ── Plomberie : staff plateforme, et replie ────────────────────── */}
        {showTechnical && (
          <Collapsible open={technicalOpen} onOpenChange={setTechnicalOpen} className="mt-auto pt-2">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="-ms-2 text-muted-foreground">
                <ExpandMore
                  size={15}
                  strokeWidth={1.75}
                  className={cn(
                    'transition-transform duration-200 motion-reduce:transition-none',
                    technicalOpen && 'rotate-180',
                  )}
                />
                {t('notifications.detail.technical', 'Détails techniques')}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <dl className="m-0 mt-2 grid grid-cols-[minmax(0,max-content)_minmax(0,1fr)] items-baseline gap-x-4 gap-y-2 rounded-lg border border-border bg-muted/40 px-4 py-3">
                <Fact label={t('notifications.detail.receivedAt', 'Reçue le')}>
                  <span className="tabular-nums">{receivedAt}</span>
                </Fact>
                <Fact label={t('notifications.detail.reference', 'Référence')}>
                  <span className="tabular-nums">#{notification.id}</span>
                </Fact>
                <Fact label={t('notifications.detail.category', 'Catégorie')}>{categoryLabel}</Fact>
                {notification.notificationKey && (
                  <Fact label={t('notifications.detail.event', 'Événement')}>
                    <span className="font-mono text-xs">{notification.notificationKey}</span>
                  </Fact>
                )}
                <Fact label={t('notifications.detail.destination', 'Destination')}>
                  {destination ? (
                    <span className="inline-flex items-center gap-1.5">
                      {destinationIcon && (
                        <span className="inline-flex shrink-0 text-muted-foreground">
                          {sizedIcon(destinationIcon, 14, 1.75)}
                        </span>
                      )}
                      {destinationLabel ?? t('notifications.detail.destinationUnknown', 'Écran lié')}
                    </span>
                  ) : (
                    t('notifications.detail.noDestination', 'Aucun écran lié — information seule')
                  )}
                </Fact>
              </dl>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>

      {/* ── Pied : le geste attendu, toujours atteignable ──────────────────── */}
      <footer className="shrink-0 border-t border-border bg-card px-5 py-4">
        <p className="m-0 text-sm leading-relaxed text-muted-foreground">{nextStep}</p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {businessActions.map(({ action, href }, index) => (
            <Button
              key={action.labelKey + href}
              variant={index === 0 ? 'default' : 'outline'}
              onClick={() => navigate(href)}
            >
              <action.Icon size={15} strokeWidth={1.75} />
              {t(action.labelKey, action.fallback)}
            </Button>
          ))}

          {stay && <NotificationStayActions stay={stay} onChanged={reloadStay} />}

          {destination && businessActions.length === 0 && (
            <Button onClick={() => navigate(destination.path)}>
              {/* L'ecran vise se presente avec SON icone — celle de la barre
                  laterale — plutot qu'avec un glyphe « lien externe » qui ne
                  dit rien de la destination. */}
              {destinationIcon
                ? sizedIcon(destinationIcon, 15, 1.75)
                : <OpenInNew size={15} strokeWidth={1.75} />}
              {destinationLabel
                ? t('notifications.detail.openTarget', 'Ouvrir {{target}}', { target: destinationLabel })
                : t('notifications.detail.openGeneric', "Ouvrir l'écran concerné")}
            </Button>
          )}

          {/* Utilitaires : ils accompagnent la fiche, ils ne sont pas la
              decision. Reduits en icones, ils cessent de concurrencer le
              geste metier dans la rangee. */}
          <div className="ms-auto flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('notifications.detail.tune', "Régler ce type d'alerte")}
                  onClick={() => navigate('/settings?tab=notifications')}
                  className="text-muted-foreground"
                >
                  <SettingsIcon size={16} strokeWidth={1.75} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('notifications.detail.tune', "Régler ce type d'alerte")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('notifications.detail.delete', 'Supprimer la notification')}
                  onClick={() => onDelete(notification.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <DeleteOutline size={16} strokeWidth={1.75} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('notifications.detail.delete', 'Supprimer la notification')}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </footer>
    </div>
  );
}
