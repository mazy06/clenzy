import { useState } from 'react';
import {
  BrushCleaningIcon,
  InboxIcon,
  LinkIcon,
  MapPinIcon,
  PlugZapIcon,
  RocketIcon,
  SearchIcon,
  SettingsIcon,
  TrendingUpIcon,
} from 'lucide-react';
import {
  Badge,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Skeleton,
  Switch,
} from '../../../components/ui';
import PageHeader from '../../../components/baitly/PageHeader';
import OnboardingChecklist from '../../../components/baitly/OnboardingChecklist';
import OnboardingDock from '../../../components/baitly/OnboardingDock';
import ShowcaseEmpty from '../../../components/baitly/ShowcaseEmpty';
import SettingSentence from '../../../components/baitly/SettingSentence';
import OptionalSection from '../../../components/baitly/OptionalSection';
import ChannelBadges from '../../../components/baitly/ChannelBadges';
import CornerRibbon from '../../../components/baitly/CornerRibbon';
import airbnbLogo from '../../../assets/logo/airbnb-logo-small.svg';
import bookingLogo from '../../../assets/logo/booking-logo-small.svg';
import vrboLogo from '../../../assets/logo/vrbo-logo-small.svg';
import abritelLogo from '../../../assets/logo/abritel-logo-small.svg';

/**
 * Projections d'écran issues du teardown concurrentiel
 * (analyse-concurrentielle/46-teardown-guesty-produit.md).
 *
 * Elles complètent les projections existantes en montrant les primitives de la
 * vague « teardown » en situation, pas isolées sur un canevas.
 */

// ─── Onboarding : guide de démarrage + découverte contextuelle ───────────────

/**
 * Parcours de démarrage Baitly, **rôle HOST**, regroupé en trois thèmes.
 *
 * Les clés reprennent celles du parcours réel (`config/onboardingConfig.ts`,
 * miroir de `UserOnboardingService.STEPS_BY_ROLE`, progression persistée dans la
 * table `user_onboarding`). Trois étapes marquées `manquante` n'existent PAS
 * encore dans le parcours réel — elles sont issues de la comparaison avec le
 * concurrent (cf. analyse-concurrentielle/46-teardown-guesty-produit.md §4) et
 * couvrent des modules entiers du produit qu'aucun parcours de démarrage
 * n'atteint aujourd'hui : site de réservation directe, automatisation des
 * messages, équipe de ménage.
 */
export const ONBOARDING_GROUPS = [
  {
    key: 'account',
    title: 'Ouvrir votre compte',
    media: <RocketIcon />,
    steps: [
      {
        key: 'complete_profile',
        title: 'Compléter votre profil',
        state: 'done' as const,
        description:
          'Téléphone, adresse et photo de profil. Validée automatiquement dès que les champs sont remplis.',
      },
      {
        key: 'create_property',
        title: 'Créer votre premier logement',
        description:
          'Baitly a besoin d’au moins un logement pour ouvrir le planning, la tarification et les canaux.',
        duration: '≈ 5 min',
        action: { label: 'Créer un logement' },
      },
      {
        key: 'configure_details',
        title: 'Renseigner les détails du logement',
        description: 'Chambres, équipements, horaires d’arrivée et de départ.',
        duration: '≈ 8 min',
        action: { label: 'Compléter la fiche' },
        onSkip: () => {},
      },
    ],
  },
  {
    key: 'revenue',
    title: 'Vendre et encaisser',
    media: <TrendingUpIcon />,
    steps: [
      {
        key: 'define_pricing',
        title: 'Définir votre tarification',
        description: 'Le moteur de prix part de ce tarif de base pour bâtir ses recommandations.',
        duration: '≈ 5 min',
        action: { label: 'Définir les tarifs' },
      },
      {
        key: 'connect_channels',
        title: 'Connecter un canal de distribution',
        description:
          'Import iCal pour démarrer, ou channel manager Channex pour une synchronisation deux sens.',
        duration: '≈ 3 min',
        action: { label: 'Connecter un canal' },
        onSkip: () => {},
      },
      {
        key: 'setup_payouts',
        title: 'Configurer vos reversements',
        description: 'Coordonnées bancaires et vérification d’identité du bénéficiaire.',
        duration: '≈ 4 min',
        action: { label: 'Configurer les reversements' },
        onSkip: () => {},
      },
      {
        // manquante — module Booking Engine / Studio, jamais atteint au démarrage
        key: 'booking_engine',
        title: 'Publier votre site de réservation directe',
        badge: <Badge variant="secondary">Add-on</Badge>,
        state: 'locked' as const,
        description:
          'Vendre en direct, sans commission de plateforme. Disponible avec l’add-on Site de réservation.',
        action: { label: 'Découvrir l’add-on' },
      },
    ],
  },
  {
    key: 'ops',
    title: 'Automatiser l’exploitation',
    media: <BrushCleaningIcon />,
    steps: [
      {
        key: 'setup_notifications',
        title: 'Choisir vos notifications',
        description: 'Email, push et alertes temps réel — vous pourrez affiner plus tard.',
        duration: '≈ 2 min',
        action: { label: 'Régler les notifications' },
        onSkip: () => {},
      },
      {
        // manquante — module Automatisations, jamais atteint au démarrage
        key: 'automate_messages',
        title: 'Automatiser vos messages voyageurs',
        description: 'Confirmation, instructions d’arrivée, relance d’avis.',
        duration: '≈ 4 min',
        action: { label: 'Créer une automatisation' },
        onSkip: () => {},
      },
      {
        // manquante — l'étape équipe n'existe que pour le rôle SUPERVISOR
        key: 'cleaning_team',
        title: 'Constituer votre équipe de ménage',
        description: 'Inviter vos intervenants et planifier le ménage entre deux séjours.',
        duration: '≈ 3 min',
        action: { label: 'Inviter un intervenant' },
        onSkip: () => {},
      },
    ],
  },
];

/** Le bandeau de découverte suit le groupe sélectionné — il n'est pas figé. */
const DISCOVERY_BY_GROUP: Record<string, { title: string; cards: string[] }> = {
  account: {
    title: 'Découvrez la gestion centralisée de vos annonces',
    cards: ['Voir le planning multi-logements', 'Ouvrir la messagerie unifiée', 'Parcourir vos logements'],
  },
  revenue: {
    title: 'Découvrez les leviers de revenu de Baitly',
    cards: ['Simuler une grille tarifaire', 'Comparer au marché local', 'Activer les ventes additionnelles'],
  },
  ops: {
    title: 'Découvrez l’exploitation au quotidien',
    cards: ['Suivre les interventions', 'Gérer l’équipe de ménage', 'Configurer les serrures connectées'],
  },
};

export function BOnboardingChecklistProjectionDemo() {
  const [group, setGroup] = useState('account');
  const discovery = DISCOVERY_BY_GROUP[group];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Bienvenue, Toufik"
        subtitle="Trois étapes vous séparent d’un compte pleinement opérationnel"
        iconBadge={<RocketIcon />}
        showBackButton={false}
        className="mb-0"
      />

      <OnboardingChecklist
        groups={ONBOARDING_GROUPS}
        groupKey={group}
        onGroupChange={setGroup}
        actions={
          <>
            <Button variant="outline" size="sm">
              Voir le tutoriel
            </Button>
            <Button variant="outline" size="sm">
              Réserver un accompagnement
            </Button>
            <Button variant="outline" size="sm">
              Centre d’aide
            </Button>
          </>
        }
      />

      <section className="flex flex-col gap-3">
        <h3 className="cn-font-heading m-0 text-base font-semibold text-foreground">
          {discovery.title}
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {discovery.cards.map((label) => (
            <div
              key={label}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3"
            >
              <div className="aspect-[16/10] w-full rounded-lg bg-gradient-to-br from-primary-soft to-muted" />
              <a
                href="#"
                onClick={(e) => e.preventDefault()}
                className="text-sm font-medium text-primary underline underline-offset-4"
              >
                {label}
              </a>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ─── Intégrations : catalogue de partenaires ────────────────────────────────

const PARTNER_SECTIONS = [
  {
    title: 'Mis en avant',
    partners: [
      {
        name: 'Turno',
        summary: 'Planifier, payer et trouver des prestataires de ménage.',
        tags: 'Ménage, Prestataires, Maintenance',
        ribbon: { label: 'Exclusif', tone: 'exclusive' as const },
        cta: 'Connecter',
      },
      {
        name: 'Minut',
        summary: 'Capteurs de bruit, d’occupation et de température.',
        tags: 'Prévention des fêtes, Domotique',
        ribbon: { label: 'Exclusif', tone: 'exclusive' as const },
        cta: 'Connecter',
      },
    ],
  },
  {
    title: 'Nouveautés',
    partners: [
      {
        name: 'Chekin',
        summary: 'Enregistrement en ligne, fiche de police et caution.',
        tags: 'Arrivée, Conformité',
        ribbon: { label: 'Nouveau', tone: 'new' as const },
        cta: 'Connecter',
      },
      {
        name: 'Baitly PriceEngine',
        summary: 'Moteur de prix maison, synchronisé sur tous vos canaux.',
        tags: 'Tarification, Analytique',
        cta: 'En savoir plus',
      },
    ],
  },
];

export function BIntegrationsMarketplaceProjectionDemo() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Catalogue de partenaires"
        subtitle="12 intégrations disponibles"
        iconBadge={<PlugZapIcon />}
        showBackButton={false}
        className="mb-0"
      />

      <div className="grid gap-6 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
        {/* Rail de filtres à facettes, dans la page (≠ navigation latérale) */}
        <aside className="flex flex-col gap-4">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Rechercher une intégration…" className="ps-9" />
          </div>
          <Separator />
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Catégorie
            </span>
            {['Ménage', 'Domotique', 'Conformité', 'Tarification'].map((cat) => (
              <label key={cat} className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                <input type="checkbox" className="size-4 accent-[var(--bui-primary)]" />
                {cat}
              </label>
            ))}
          </div>
        </aside>

        <div className="flex flex-col gap-6">
          {PARTNER_SECTIONS.map((section) => (
            <section key={section.title} className="flex flex-col gap-3">
              <h3 className="cn-font-heading m-0 text-base font-semibold text-foreground">
                {section.title}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {section.partners.map((partner) => (
                  <div
                    key={partner.name}
                    className="relative flex flex-col overflow-hidden rounded-xl border border-border bg-card"
                  >
                    {partner.ribbon && (
                      <CornerRibbon label={partner.ribbon.label} tone={partner.ribbon.tone} />
                    )}
                    <div className="flex min-h-24 items-center justify-center px-6 pt-8 pb-4">
                      <span className="cn-font-heading text-lg font-semibold text-foreground">
                        {partner.name}
                      </span>
                    </div>
                    <p className="m-0 px-4 pb-4 text-sm text-muted-foreground">{partner.summary}</p>
                    <Separator />
                    <div className="flex items-center justify-between gap-3 p-3">
                      <span className="truncate text-xs text-muted-foreground">{partner.tags}</span>
                      <Button size="sm" variant="outline" className="shrink-0">
                        {partner.cta}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Paramètres : réglages en phrase ────────────────────────────────────────

export function BSettingsSentenceProjectionDemo() {
  const [status, setStatus] = useState('inconnu');
  const [days, setDays] = useState('5');

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Paramètres du compte"
        subtitle="Ces réglages s’appliquent à toute l’organisation"
        iconBadge={<SettingsIcon />}
        showBackButton={false}
        className="mb-0"
      />

      {/* Colonne étroite : la densité de lecture prime sur la largeur disponible. */}
      <div className="flex max-w-2xl flex-col gap-6">
        <section className="flex flex-col gap-3">
          <h3 className="cn-font-heading m-0 text-sm font-semibold text-foreground">
            Statut de ménage
          </h3>
          {/* Liste d'interrupteurs compacte : une seule explication pour le groupe. */}
          <p className="m-0 text-sm text-muted-foreground">
            Baitly suit l’état de propreté de chaque logement entre deux séjours.
          </p>
          <div className="flex flex-col gap-2.5">
            {[
              { label: 'Marquer le logement à nettoyer après chaque départ', on: true },
              { label: 'Afficher l’état de ménage sur le planning', on: true },
              { label: 'Requalifier automatiquement après un délai', on: true },
            ].map((row) => (
              <label
                key={row.label}
                className="flex cursor-pointer items-center gap-3 text-sm text-foreground"
              >
                <Switch defaultChecked={row.on} />
                {row.label}
              </label>
            ))}
          </div>
          <SettingSentence>
            Marquer le logement
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inconnu">inconnu</SelectItem>
                <SelectItem value="à nettoyer">à nettoyer</SelectItem>
              </SelectContent>
            </Select>
            après
            <Input
              type="number"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="w-16 text-center tabular-nums"
            />
            jours sans séjour.
          </SettingSentence>
        </section>

        <Separator />

        <section className="flex flex-col gap-3">
          <h3 className="cn-font-heading m-0 text-sm font-semibold text-foreground">
            Modifications du planning
          </h3>
          <SettingSentence description="Utile pour tracer qui a fermé une date et pourquoi.">
            Exiger une note lors d’un blocage
            <Select defaultValue="manuel">
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manuel">manuel uniquement</SelectItem>
                <SelectItem value="tous">sur tous les blocages</SelectItem>
              </SelectContent>
            </Select>
            .
          </SettingSentence>

          <OptionalSection
            title="Restrictions avancées"
            description="Limiter les modifications de tarif à certains rôles."
            addLabel="Ajouter une restriction"
          >
            <div className="rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">
              Modification de tarif réservée aux rôles{' '}
              <span className="font-medium text-foreground">Hôte</span> et{' '}
              <span className="font-medium text-foreground">Superviseur</span>.
            </div>
          </OptionalSection>
        </section>
      </div>
    </div>
  );
}

// ─── Messagerie : état vide vitrine ─────────────────────────────────────────

export function BMessagingShowcaseProjectionDemo() {
  return (
    <ShowcaseEmpty
      eyebrow={{ icon: <InboxIcon />, label: 'Messagerie unifiée' }}
      title="Répondez à vos voyageurs de tous les canaux depuis une seule boîte"
      description="Connectez un canal de distribution pour commencer à recevoir les messages dans Baitly."
      action={<Button>Connecter un canal</Button>}
      fallback={
        <>
          Pas encore de canal connecté ?{' '}
          <a href="#" onClick={(e) => e.preventDefault()}>
            Créer une réservation directe
          </a>
        </>
      }
      preview={
        <div className="flex flex-col gap-2">
          {[
            { name: 'Amina B.', logo: airbnbLogo, active: true },
            { name: 'Lucas M.', logo: bookingLogo },
            { name: 'Sofia R.', logo: vrboLogo },
            { name: 'Yanis K.', logo: abritelLogo },
          ].map((row) => (
            <div
              key={row.name}
              className={`flex items-center gap-3 rounded-lg border p-3 ${
                row.active ? 'border-primary/40 bg-card' : 'border-transparent bg-card/60'
              }`}
            >
              <img src={row.logo} alt="" className="size-5 shrink-0 object-contain" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="text-xs font-medium text-foreground">{row.name}</span>
                <Skeleton className="h-2 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      }
    />
  );
}

// ─── Logements : diffusion multi-canal lisible sur la vignette ──────────────

const PROPERTY_CARDS = [
  {
    name: 'Riad Yasmine',
    address: 'Médina, Marrakech',
    status: 'Publié',
    channels: [
      { key: 'airbnb', label: 'Airbnb', logo: airbnbLogo, connected: true },
      { key: 'booking', label: 'Booking.com', logo: bookingLogo, connected: true },
      { key: 'vrbo', label: 'Vrbo', logo: vrboLogo },
      { key: 'abritel', label: 'Abritel', logo: abritelLogo },
    ],
  },
  {
    name: 'Duplex Guéliz',
    address: 'Guéliz, Marrakech',
    status: 'Publié',
    channels: [
      { key: 'airbnb', label: 'Airbnb', logo: airbnbLogo, connected: true },
      { key: 'booking', label: 'Booking.com', logo: bookingLogo },
      { key: 'vrbo', label: 'Vrbo', logo: vrboLogo },
      { key: 'abritel', label: 'Abritel', logo: abritelLogo },
    ],
  },
  {
    name: 'Appartement Maârif',
    address: 'Maârif, Casablanca',
    status: 'Brouillon',
    channels: [
      { key: 'airbnb', label: 'Airbnb', logo: airbnbLogo },
      { key: 'booking', label: 'Booking.com', logo: bookingLogo },
      { key: 'vrbo', label: 'Vrbo', logo: vrboLogo },
      { key: 'abritel', label: 'Abritel', logo: abritelLogo },
    ],
  },
];

export function BPropertyChannelsProjectionDemo() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {PROPERTY_CARDS.map((property) => (
        <div key={property.name} className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="relative">
            <div className="aspect-[16/10] w-full bg-gradient-to-br from-primary-soft to-muted" />
            {/* L'état de diffusion se lit sur la vignette, sans ouvrir la fiche. */}
            <div className="absolute top-3 end-3">
              <ChannelBadges channels={property.channels} size="sm" overlay />
            </div>
            <span className="absolute bottom-3 start-3 rounded-full bg-foreground/75 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-background uppercase">
              {property.status}
            </span>
          </div>
          <div className="p-3">
            <div className="text-sm font-semibold text-foreground">{property.name}</div>
            <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPinIcon className="size-3.5" />
              {property.address}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Onboarding : dock flottant persistant — parcours complet ────────────────

/** États successifs traversés par le dock, rejouables dans la démo. */
type DockStage = 'collapsed' | 'expanded' | 'progress' | 'locked' | 'done' | 'dismissed';

const DOCK_STAGES: Array<{ key: DockStage; label: string; hint: string }> = [
  { key: 'collapsed', label: '1 · Replié', hint: 'État par défaut sur tous les écrans : le guide rappelle sa présence et la progression globale, sans masquer le travail en cours.' },
  { key: 'expanded', label: '2 · Déplié', hint: 'Les étapes du groupe courant, la première non terminée dépliée d’office. Le pager en pied change de groupe.' },
  { key: 'progress', label: '3 · En cours', hint: 'Une étape terminée barre son titre et fait avancer les DEUX compteurs : celui du groupe (pager) et le global (barre du bas).' },
  { key: 'locked', label: '4 · Étape verrouillée', hint: 'Une étape réservée à une offre supérieure reste visible, avec cadenas et badge — jamais un item grisé qu’on croit cassé.' },
  { key: 'done', label: '5 · Terminé', hint: 'Le guide a une fin visible : bandeau de fin, et c’est à ce moment qu’il propose de disparaître.' },
  { key: 'dismissed', label: '6 · Masqué', hint: 'Rejeté par l’utilisateur : le dock disparaît et la reprise se fait depuis le guide plein écran.' },
];

/** Applique un état de démonstration aux groupes de référence. */
function groupsForStage(stage: DockStage) {
  const mark = (groupKey: string, stepKey: string, state: 'done' | 'locked' | 'todo') =>
    (g: (typeof ONBOARDING_GROUPS)[number]) =>
      g.key !== groupKey
        ? g
        : { ...g, steps: g.steps.map((s) => (s.key === stepKey ? { ...s, state } : s)) };

  if (stage === 'done') {
    return ONBOARDING_GROUPS.map((g) => ({
      ...g,
      steps: g.steps.map((s) => ({ ...s, state: 'done' as const })),
    }));
  }
  if (stage === 'progress') {
    return ONBOARDING_GROUPS.map(mark('account', 'create_property', 'done'));
  }
  return ONBOARDING_GROUPS;
}

export function BOnboardingDockProjectionDemo() {
  const [stage, setStage] = useState<DockStage>('collapsed');
  const current = DOCK_STAGES.find((s) => s.key === stage) ?? DOCK_STAGES[0];

  return (
    <div className="flex flex-col gap-4">
      {/* Sélecteur d'étape du parcours — la démo montre le workflow, pas un instantané. */}
      <div className="flex flex-wrap gap-2">
        {DOCK_STAGES.map((item) => (
          <Button
            key={item.key}
            size="sm"
            variant={item.key === stage ? 'default' : 'outline'}
            onClick={() => setStage(item.key)}
          >
            {item.label}
          </Button>
        ))}
      </div>
      <p className="m-0 text-sm text-muted-foreground">{current.hint}</p>

      {/* Fenêtre applicative simulée : le dock se lit en contexte, pas isolé. */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-background">
        <div className="flex items-center gap-2 bg-primary px-4 py-3 text-primary-foreground">
          <RocketIcon className="size-4" />
          <span className="cn-font-heading text-sm font-semibold">Baitly</span>
        </div>
        <div className="grid min-h-[26rem] grid-cols-[minmax(0,10rem)_minmax(0,1fr)]">
          <div className="flex flex-col gap-2 border-e border-border p-3">
            {['Tableau de bord', 'Planning', 'Réservations', 'Logements', 'Messagerie'].map(
              (item, index) => (
                <div
                  key={item}
                  className={`rounded-md px-2 py-1.5 text-xs ${
                    index === 1 ? 'bg-accent font-medium text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {item}
                </div>
              )
            )}
          </div>
          <div className="flex flex-col gap-3 p-4">
            <Skeleton className="h-6 w-48" />
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
            <Skeleton className="h-40 w-full" />
          </div>
        </div>

        {stage !== 'dismissed' && (
          <div className="absolute bottom-4 start-4 w-[min(24rem,calc(100%-2rem))]">
            <OnboardingDock
              floating={false}
              groups={groupsForStage(stage)}
              open={stage !== 'collapsed'}
              onOpenChange={(open) => setStage(open ? 'expanded' : 'collapsed')}
              defaultGroupKey={stage === 'locked' ? 'revenue' : 'account'}
              key={stage}
              onDismiss={() => setStage('dismissed')}
              completion="Votre compte est opérationnel : logements publiés, tarifs actifs et messages automatisés."
            />
          </div>
        )}

        {stage === 'dismissed' && (
          <div className="absolute bottom-4 start-4 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
            Guide masqué — reprise depuis <span className="font-medium text-foreground">Aide › Guide de démarrage</span>.
          </div>
        )}
      </div>
    </div>
  );
}
