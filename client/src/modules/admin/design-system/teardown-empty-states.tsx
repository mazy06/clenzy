import { useEffect, useState } from 'react';
import {
  BellIcon,
  BuildingIcon,
  CalendarDaysIcon,
  EuroIcon,
  FileTextIcon,
  HomeIcon,
  LayoutDashboardIcon,
  PlugZapIcon,
  RadioTowerIcon,
  SparklesIcon,
  TagIcon,
  TrendingUpIcon,
  UsersIcon,
  WrenchIcon,
} from 'lucide-react';
import { Button, Skeleton } from '../../../components/ui';
import ShowcaseEmpty from '../../../components/baitly/ShowcaseEmpty';
import ShowcaseCycler, { usePrefersReducedMotion } from '../../../components/baitly/ShowcaseCycler';
import Reveal from '../../../components/baitly/Reveal';
import MockupSlot from '../../../components/baitly/MockupSlot';
import ChannelBadges from '../../../components/baitly/ChannelBadges';
import airbnbLogo from '../../../assets/logo/airbnb-logo-small.svg';
import bookingLogo from '../../../assets/logo/booking-logo-small.svg';
import vrboLogo from '../../../assets/logo/vrbo-logo-small.svg';

/**
 * États vides « vitrine » de tous les écrans du PMS.
 *
 * Constat de l'audit (46-teardown-guesty-produit.md) : un état vide qui annonce
 * « Aucun élément » gaspille le seul moment où l'utilisateur regarde vraiment
 * l'écran. Ici chaque écran vide **explique ce qu'il fera**, en montre un
 * aperçu, et propose une sortie de secours.
 *
 * Trois règles tenues partout :
 *  1. le titre est la **proposition de valeur** de l'écran, jamais un constat ;
 *  2. l'aperçu utilise des **barres de squelette** pour le texte secondaire —
 *     rien à traduire, aucune fausse donnée crédible à maintenir ;
 *  3. une **sortie de secours** quand l'action principale suppose un prérequis.
 */

// ─── Briques d'aperçu réutilisables ─────────────────────────────────────────

function PreviewCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-border bg-card p-3 ${className}`}>{children}</div>
  );
}

/** Liste de lignes : conversations, voyageurs, documents, notifications… */
function ListPreview({ rows = 4, withLogos = false }: { rows?: number; withLogos?: boolean }) {
  const logos = [airbnbLogo, bookingLogo, vrboLogo];
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }).map((_, index) => (
        <PreviewCard key={index} className={index === 0 ? 'border-primary/40' : 'bg-card/60'}>
          <div className="flex items-center gap-3">
            {withLogos ? (
              <img src={logos[index % logos.length]} alt="" className="size-5 shrink-0 object-contain" />
            ) : (
              <span className="size-6 shrink-0 rounded-full bg-primary-soft" />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-2 w-24" />
              <Skeleton className="h-2 w-3/4" />
            </div>
          </div>
        </PreviewCard>
      ))}
    </div>
  );
}

/** Mini-planning : colonne de logements + bandes d'occupation. */
function CalendarPreview() {
  const bars = [
    { start: 1, span: 3, tone: 'bg-primary' },
    { start: 4, span: 2, tone: 'bg-success' },
    { start: 0, span: 2, tone: 'bg-warning' },
  ];
  return (
    <PreviewCard>
      <div className="flex gap-2">
        <div className="flex w-16 shrink-0 flex-col gap-3 pt-5">
          {bars.map((_, index) => (
            <Skeleton key={index} className="h-2 w-full" />
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 7 }).map((_, index) => (
              <Skeleton key={index} className="h-2 w-full" />
            ))}
          </div>
          {bars.map((bar, index) => (
            <div key={index} className="grid grid-cols-7 gap-1">
              {Array.from({ length: 7 }).map((_, cell) => (
                <div
                  key={cell}
                  className={`h-4 rounded-sm ${
                    cell >= bar.start && cell < bar.start + bar.span ? bar.tone : 'bg-muted'
                  }`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </PreviewCard>
  );
}

/** Fiche logement avec sa diffusion multi-canal. */
function PropertyPreview({ connected = 2 }: { connected?: number }) {
  const channels = [
    { key: 'airbnb', label: 'Airbnb', logo: airbnbLogo },
    { key: 'booking', label: 'Booking.com', logo: bookingLogo },
    { key: 'vrbo', label: 'Vrbo', logo: vrboLogo },
  ].map((channel, index) => ({ ...channel, connected: index < connected }));

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="relative">
        <div className="aspect-[16/9] w-full bg-gradient-to-br from-primary-soft to-muted" />
        <div className="absolute top-2 end-2">
          <ChannelBadges channels={channels} size="sm" overlay />
        </div>
      </div>
      <div className="flex flex-col gap-1.5 p-3">
        <Skeleton className="h-2.5 w-28" />
        <Skeleton className="h-2 w-40" />
      </div>
    </div>
  );
}

/** Courbe de revenus / occupation. */
function ChartPreview({ tone = 'bg-primary' }: { tone?: string }) {
  const heights = [38, 52, 44, 66, 58, 78, 71];
  return (
    <PreviewCard>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-2 w-24" />
        <div className="flex h-28 items-end gap-2">
          {heights.map((height, index) => (
            <div
              key={index}
              className={`flex-1 rounded-sm ${index === heights.length - 1 ? tone : 'bg-primary-soft'}`}
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
      </div>
    </PreviewCard>
  );
}

/** Rangée de tuiles KPI. */
function KpiPreview() {
  return (
    <div className="grid grid-cols-3 gap-2">
      {Array.from({ length: 3 }).map((_, index) => (
        <PreviewCard key={index}>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-2 w-12" />
            <Skeleton className="h-5 w-16" />
          </div>
        </PreviewCard>
      ))}
    </div>
  );
}

// ─── Onboarding : écran de première arrivée ─────────────────────────────────

const ONBOARDING_MILESTONES = [
  {
    key: 'property',
    label: 'Vos logements, décrits une seule fois',
    detail: 'Photos, équipements, horaires — repris tels quels par tous les canaux.',
  },
  {
    key: 'calendar',
    label: 'Un planning, tous les canaux',
    detail: 'Les disponibilités se synchronisent dans les deux sens. Plus de double réservation.',
  },
  {
    key: 'revenue',
    label: 'Vos revenus, sans tableur',
    detail: 'Encaissements, reversements et factures conformes, générés au fil des séjours.',
  },
];

/**
 * Écran d'arrivée sur l'onboarding, compte entièrement vide.
 *
 * L'animation sert la compréhension : les jalons défilent, et **chaque jalon
 * pilote l'aperçu de droite**, de sorte que la promesse et sa démonstration
 * restent synchronisées. Le défilement s'arrête dès que l'utilisateur choisit
 * lui-même un jalon — on ne se bat pas avec lui.
 */
export function BOnboardingEmptyProjectionDemo() {
  const reducedMotion = usePrefersReducedMotion();
  const [active, setActive] = useState(0);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (touched || reducedMotion) return;
    const id = window.setInterval(
      () => setActive((current) => (current + 1) % ONBOARDING_MILESTONES.length),
      4200
    );
    return () => window.clearInterval(id);
  }, [touched, reducedMotion]);

  const select = (index: number) => {
    setTouched(true);
    setActive(index);
  };

  return (
    <div className="grid items-center gap-10 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-14">
      <div className="min-w-0">
        <Reveal>
          <p className="m-0 mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <SparklesIcon className="size-4 text-primary" />
            Premiers pas
          </p>
        </Reveal>

        <Reveal delay={70}>
          <h2 className="cn-font-heading m-0 text-3xl leading-tight font-semibold text-balance text-foreground sm:text-4xl">
            Votre compte est prêt. Il ne lui manque que vos logements.
          </h2>
        </Reveal>

        <Reveal delay={140}>
          <p className="m-0 mt-4 max-w-xl text-base text-muted-foreground">
            Comptez une vingtaine de minutes pour un premier logement en ligne, synchronisé et
            encaissable. Vous pourrez tout reprendre plus tard&nbsp;: rien n’est verrouillé.
          </p>
        </Reveal>

        {/* Jalons — liste verticale, pas une grille de cartes identiques. */}
        <ul className="m-0 mt-8 flex list-none flex-col gap-1 p-0">
          {ONBOARDING_MILESTONES.map((milestone, index) => {
            const selected = index === active;
            return (
              <li key={milestone.key}>
                <Reveal delay={210 + index * 70}>
                  <button
                    type="button"
                    aria-current={selected || undefined}
                    onClick={() => select(index)}
                    className={`flex w-full cursor-pointer items-start gap-4 rounded-lg p-3 text-start outline-none transition-colors duration-200 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 ${
                      selected ? 'bg-accent' : ''
                    }`}
                  >
                    <span
                      className={`mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-colors duration-200 ${
                        selected
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">
                        {milestone.label}
                      </span>
                      <span
                        className={`block text-sm text-muted-foreground transition-opacity duration-200 ${
                          selected ? 'opacity-100' : 'opacity-70'
                        }`}
                      >
                        {milestone.detail}
                      </span>
                    </span>
                  </button>
                </Reveal>
              </li>
            );
          })}
        </ul>

        <Reveal delay={450}>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button size="lg">Créer mon premier logement</Button>
            <Button size="lg" variant="ghost">
              Parcourir le guide de démarrage
            </Button>
          </div>
        </Reveal>

        <Reveal delay={520}>
          <p className="m-0 mt-4 text-sm text-muted-foreground">
            Vous arrivez d’un autre PMS&nbsp;?{' '}
            <a
              href="#"
              onClick={(event) => event.preventDefault()}
              className="font-medium text-primary underline underline-offset-4"
            >
              Importer vos logements et votre historique
            </a>
          </p>
        </Reveal>
      </div>

      <Reveal delay={280}>
        <div aria-hidden className="rounded-2xl bg-muted/60 p-6 select-none">
          {/* Emplacement du futur mockup animé. L'animation devra rester
              PILOTÉE par le jalon actif (prop `index`), sinon la promesse et sa
              démonstration se désynchronisent. */}
          <MockupSlot
            brief="Trois séquences enchaînables, une par jalon : (1) une fiche logement se compose et ses canaux s'allument ; (2) une réservation se pose sur le planning et se propage aux canaux ; (3) un séjour se termine et son encaissement puis sa facture se génèrent. Chaque séquence doit pouvoir être jouée seule, à la demande du jalon sélectionné."
            poster={
              <ShowcaseCycler
                index={active}
                frames={[
                  { key: 'property', node: <PropertyPreview connected={2} /> },
                  { key: 'calendar', node: <CalendarPreview /> },
                  { key: 'revenue', node: <ChartPreview /> },
                ]}
              />
            }
          />
        </div>
      </Reveal>
    </div>
  );
}

// ─── États vides des autres écrans ──────────────────────────────────────────

interface ScreenEmptyState {
  eyebrowIcon: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  action: string;
  fallbackLead: string;
  fallbackLink: string;
  frames: React.ReactNode[];
  /** Ce que le futur mockup animé devra démontrer sur cet écran. */
  mockupBrief: string;
}

const SCREEN_EMPTY_STATES: Record<string, ScreenEmptyState> = {
  dashboard: {
    eyebrowIcon: <LayoutDashboardIcon />,
    eyebrow: 'Tableau de bord',
    title: 'Vos indicateurs apparaîtront ici dès la première réservation',
    description:
      'Occupation, revenu par logement, provenance des séjours : tout se calcule automatiquement, sans saisie.',
    action: 'Créer mon premier logement',
    fallbackLead: 'Vous voulez voir à quoi ça ressemble avant ?',
    fallbackLink: 'Afficher le jeu de démonstration',
    mockupBrief:
      "Les tuiles KPI se remplissent une à une à mesure qu'une première réservation entre, puis la courbe de revenu se trace.",
    frames: [<KpiPreview key="kpi" />, <ChartPreview key="chart" />],
  },
  planning: {
    eyebrowIcon: <CalendarDaysIcon />,
    eyebrow: 'Planning',
    title: 'Un seul calendrier pour tous vos logements et tous vos canaux',
    description:
      'Les disponibilités se synchronisent dans les deux sens avec Airbnb, Booking et les autres. Plus de double réservation.',
    action: 'Connecter un canal',
    fallbackLead: 'Pas encore de canal ?',
    fallbackLink: 'Saisir une réservation directe',
    mockupBrief:
      "Une réservation glisse sur la grille, la barre se pose sur les bonnes nuits, et le badge du canal d'origine apparaît en bout de barre.",
    frames: [<CalendarPreview key="cal" />, <ListPreview key="list" rows={3} withLogos />],
  },
  properties: {
    eyebrowIcon: <HomeIcon />,
    eyebrow: 'Logements',
    title: 'Décrivez un logement une fois, diffusez-le partout',
    description:
      'Photos, équipements et horaires sont repris tels quels par chaque canal connecté, sans ressaisie.',
    action: 'Ajouter un logement',
    fallbackLead: 'Vous avez déjà des annonces en ligne ?',
    fallbackLink: 'Les importer depuis Airbnb',
    mockupBrief:
      "Une fiche logement se compose (photo, titre, adresse), puis les pastilles de canaux s'allument une à une avec leur coche de validation.",
    frames: [<PropertyPreview key="p0" connected={2} />, <PropertyPreview key="p1" connected={3} />],
  },
  guests: {
    eyebrowIcon: <UsersIcon />,
    eyebrow: 'Voyageurs',
    title: 'Chaque voyageur, son historique et ses préférences au même endroit',
    description:
      'Les fiches se créent toutes seules à partir des réservations, quel que soit le canal d’origine.',
    action: 'Importer mes réservations',
    fallbackLead: 'Vous préférez commencer à la main ?',
    fallbackLink: 'Créer une fiche voyageur',
    mockupBrief:
      "Une réservation arrive par un canal et fait naître la fiche voyageur correspondante, qui vient s'empiler dans la liste.",
    frames: [<ListPreview key="l0" rows={4} />, <ListPreview key="l1" rows={4} withLogos />],
  },
  interventions: {
    eyebrowIcon: <WrenchIcon />,
    eyebrow: 'Interventions',
    title: 'Le ménage et la maintenance se planifient depuis les départs',
    description:
      'Une intervention est créée à chaque fin de séjour et assignée à l’intervenant disponible.',
    action: 'Configurer le ménage',
    fallbackLead: 'Vous n’avez pas encore d’équipe ?',
    fallbackLink: 'Inviter un intervenant',
    mockupBrief:
      "Un départ sur le planning déclenche la création d'une intervention de ménage, qui s'assigne à un intervenant disponible.",
    frames: [<ListPreview key="l0" rows={4} />, <CalendarPreview key="cal" />],
  },
  pricing: {
    eyebrowIcon: <TagIcon />,
    eyebrow: 'Tarification',
    title: 'Un tarif de base, et le moteur s’occupe du reste',
    description:
      'Saisons, dernière minute, longs séjours, règles de rendement : les prix se recalculent et repartent vers les canaux.',
    action: 'Définir un tarif de base',
    fallbackLead: 'Vous voulez d’abord comprendre le calcul ?',
    fallbackLink: 'Voir comment un prix est construit',
    mockupBrief:
      "Un tarif de base est saisi, puis les prix des nuits se recalculent en cascade sur le calendrier (saison, dernière minute) et repartent vers les canaux.",
    frames: [<ChartPreview key="c0" />, <CalendarPreview key="cal" />],
  },
  reports: {
    eyebrowIcon: <TrendingUpIcon />,
    eyebrow: 'Rapports',
    title: 'Vos performances, prêtes à exporter pour votre comptable',
    description:
      'Occupation, revenu par canal, taxe de séjour et déclarations : les rapports se composent depuis vos données réelles.',
    action: 'Créer mon premier logement',
    fallbackLead: 'Vous cherchez un rapport précis ?',
    fallbackLink: 'Parcourir les modèles de rapport',
    mockupBrief:
      "Des lignes de réservation se déversent dans un rapport, les totaux s'incrémentent, et le bouton d'export s'active.",
    frames: [<ChartPreview key="c0" />, <KpiPreview key="kpi" />],
  },
  billing: {
    eyebrowIcon: <EuroIcon />,
    eyebrow: 'Facturation',
    title: 'Des factures conformes, générées au fil des séjours',
    description:
      'Numérotation séquentielle inaltérable, mentions légales et taxe de séjour appliquées automatiquement.',
    action: 'Configurer la facturation',
    fallbackLead: 'Vous facturez encore ailleurs ?',
    fallbackLink: 'Importer un historique de factures',
    mockupBrief:
      "Un séjour se termine et sa facture se génère : numéro séquentiel, mentions légales et taxe de séjour se remplissent tour à tour.",
    frames: [<ListPreview key="l0" rows={4} />, <KpiPreview key="kpi" />],
  },
  documents: {
    eyebrowIcon: <FileTextIcon />,
    eyebrow: 'Documents',
    title: 'Contrats, mandats et pièces d’identité, classés par séjour',
    description:
      'Chaque document est rattaché à sa réservation et à son logement, et reste accessible au propriétaire.',
    action: 'Téléverser un document',
    fallbackLead: 'Vous voulez faire signer un mandat ?',
    fallbackLink: 'Envoyer un contrat à signer',
    mockupBrief:
      "Un contrat est envoyé, la signature se dépose, et le document se range automatiquement sous la réservation concernée.",
    frames: [<ListPreview key="l0" rows={4} />],
  },
  integrations: {
    eyebrowIcon: <PlugZapIcon />,
    eyebrow: 'Intégrations',
    title: 'Reliez vos canaux, vos serrures et vos encaissements',
    description:
      'Un canal connecté synchronise disponibilités, tarifs et réservations sans intervention de votre part.',
    action: 'Connecter un canal',
    fallbackLead: 'Votre outil n’est pas dans la liste ?',
    fallbackLink: 'Utiliser un lien iCal',
    mockupBrief:
      "Un canal se connecte : la pastille passe de grise à colorée, la coche apparaît, et les disponibilités se propagent vers le planning.",
    frames: [<ListPreview key="l0" rows={4} withLogos />, <PropertyPreview key="p" connected={3} />],
  },
  notifications: {
    eyebrowIcon: <BellIcon />,
    eyebrow: 'Notifications',
    title: 'Soyez prévenu de ce qui compte, pas du reste',
    description:
      'Nouvelle réservation, annulation, incident de paiement, alerte de bruit : vous choisissez le canal et la fréquence.',
    action: 'Régler mes notifications',
    fallbackLead: 'Vous voulez tout recevoir pour commencer ?',
    fallbackLink: 'Activer les alertes essentielles',
    mockupBrief:
      "Un événement (nouvelle réservation, alerte de bruit) déclenche la notification correspondante, qui glisse dans la liste avec son canal d'envoi.",
    frames: [<ListPreview key="l0" rows={4} />],
  },
  devices: {
    eyebrowIcon: <RadioTowerIcon />,
    eyebrow: 'Objets connectés',
    title: 'Serrures, capteurs de bruit et thermostats, pilotés depuis les séjours',
    description:
      'Les codes d’accès se génèrent à la réservation et expirent au départ. Les alertes remontent dans le planning.',
    action: 'Ajouter un appareil',
    fallbackLead: 'Vous ne savez pas quel matériel choisir ?',
    fallbackLink: 'Voir les appareils compatibles',
    mockupBrief:
      "Une réservation est confirmée : un code d'accès se génère sur la serrure, puis expire visiblement au départ du voyageur.",
    frames: [<ListPreview key="l0" rows={4} />],
  },
  ownerPortal: {
    eyebrowIcon: <BuildingIcon />,
    eyebrow: 'Portail propriétaire',
    title: 'Vos propriétaires suivent leurs biens sans vous appeler',
    description:
      'Occupation, revenus, reversements et documents, dans un espace dédié que vous ouvrez bien par bien.',
    action: 'Inviter un propriétaire',
    fallbackLead: 'Vous gérez vos propres biens ?',
    fallbackLink: 'Comprendre les contrats de gestion',
    mockupBrief:
      "La vue bascule côté propriétaire : occupation, revenus et reversement du mois se composent dans son espace dédié.",
    frames: [<KpiPreview key="kpi" />, <ChartPreview key="c0" />],
  },
};

/** Fabrique la démo d'un écran — même gabarit partout, contenu propre à l'écran. */
function makeEmptyStateDemo(key: keyof typeof SCREEN_EMPTY_STATES) {
  const screen = SCREEN_EMPTY_STATES[key];
  return function ScreenEmptyStateDemo() {
    return (
      <ShowcaseEmpty
        eyebrow={{ icon: screen.eyebrowIcon, label: screen.eyebrow }}
        title={screen.title}
        description={screen.description}
        action={<Button>{screen.action}</Button>}
        fallback={
          <>
            {screen.fallbackLead}{' '}
            <a href="#" onClick={(event) => event.preventDefault()}>
              {screen.fallbackLink}
            </a>
          </>
        }
        preview={
          // Emplacement du futur mockup animé : tant qu'il n'existe pas, on rend
          // l'aperçu statique actuel. Le jour où l'animation arrive, elle passe
          // en `children` sans toucher à l'écran.
          <MockupSlot
            brief={screen.mockupBrief}
            poster={
              <ShowcaseCycler
                frames={screen.frames.map((node, index) => ({ key: String(index), node }))}
              />
            }
          />
        }
      />
    );
  };
}

export const BDashboardEmptyDemo = makeEmptyStateDemo('dashboard');
export const BPlanningEmptyDemo = makeEmptyStateDemo('planning');
export const BPropertiesEmptyDemo = makeEmptyStateDemo('properties');
export const BGuestsEmptyDemo = makeEmptyStateDemo('guests');
export const BInterventionsEmptyDemo = makeEmptyStateDemo('interventions');
export const BPricingEmptyDemo = makeEmptyStateDemo('pricing');
export const BReportsEmptyDemo = makeEmptyStateDemo('reports');
export const BBillingEmptyDemo = makeEmptyStateDemo('billing');
export const BDocumentsEmptyDemo = makeEmptyStateDemo('documents');
export const BIntegrationsEmptyDemo = makeEmptyStateDemo('integrations');
export const BNotificationsEmptyDemo = makeEmptyStateDemo('notifications');
export const BDevicesEmptyDemo = makeEmptyStateDemo('devices');
export const BOwnerPortalEmptyDemo = makeEmptyStateDemo('ownerPortal');
