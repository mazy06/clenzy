import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
  BanknoteIcon,
  BotIcon,
  CalendarClockIcon,
  CalendarSyncIcon,
  CameraIcon,
  CheckIcon,
  ConciergeBellIcon,
  EyeIcon,
  HandIcon,
  HandshakeIcon,
  LayoutGridIcon,
  MegaphoneIcon,
  MessageSquareIcon,
  MousePointerClickIcon,
  OrbitIcon,
  PackageIcon,
  PencilIcon,
  PenLineIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  StarIcon,
  TimerIcon,
  TrendingUpIcon,
  WrenchIcon,
  XIcon,
} from 'lucide-react';
import {
  Badge,
  Button,
  Progress,
  Switch,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../components/ui';
import PageHeader from '../../../components/baitly/PageHeader';
import { Money } from '../../../components/baitly/Money';
import { MARK_PATH, MARK_VIEWBOX, STROKE_WIDTH } from '../../../components/BaitlyMarkLogo';
import { cn } from '../../../utils/cn';

/**
 * Projection — Constellation des agents IA : les agents, le feed d'activité et
 * la file de cartes HITL (validation humaine). Galerie only.
 *
 * <h3>Parti pris visuel</h3>
 * Langage inspiré de Notion, appliqué au registre « product » :
 * <ul>
 *   <li><b>La surface signale l'action.</b> Seuls les blocs sur lesquels on agit
 *       reçoivent un fond : les propositions à valider, et les cartes agent qui
 *       portent l'interrupteur auto/validation. Ce qui se lit seulement (feed,
 *       diagramme) vit sur le fond de page, séparé par des filets d'1px. Une
 *       surface n'existe que si l'élévation porte du sens.</li>
 *   <li><b>Un seul accent.</b> L'ambre ne désigne QUE « ça attend une décision
 *       de votre part ». Tout le reste est neutre — y compris les états
 *       « actif » et « auto », qui sont la norme et n'ont donc pas à être
 *       colorés. On signale l'exception, pas la règle.</li>
 *   <li><b>Le mouvement porte un état, jamais l'ambiance.</b> Deux boucles
 *       seulement : le halo de l'agent qui attend une validation, et le relais
 *       de données de l'agent SÉLECTIONNÉ — noyau → agent → cartes HITL, celui
 *       dont la file est ouverte à droite. Le survol n'anime rien : il isole
 *       et renseigne (infobulle). Un écran de supervision reste ouvert toute
 *       la journée : l'animation ambiante y est une fatigue, pas une
 *       qualité.</li>
 * </ul>
 */

// ─── Données ─────────────────────────────────────────────────────────────────

interface AgentNode {
  name: string;
  role: string;
  icon: React.ReactNode;
  status: 'active' | 'idle' | 'waiting';
  tasksToday: number;
  lastRun: string;
  auto: boolean;
}

const AGENTS: AgentNode[] = [
  { name: 'Revenue', role: 'Yield & tarifs', icon: <TrendingUpIcon />, status: 'waiting', tasksToday: 6, lastRun: 'il y a 4 min', auto: false },
  { name: 'Messaging', role: 'Relances & réponses guests', icon: <MessageSquareIcon />, status: 'active', tasksToday: 14, lastRun: 'à l\'instant', auto: true },
  { name: 'Ops', role: 'Interventions & équipes', icon: <WrenchIcon />, status: 'active', tasksToday: 9, lastRun: 'il y a 12 min', auto: true },
  { name: 'Sync', role: 'Canaux & calendriers', icon: <CalendarSyncIcon />, status: 'idle', tasksToday: 31, lastRun: 'il y a 25 min', auto: true },
  // Agents à venir — modélisés ici AVANT leur implémentation, pour éprouver le
  // langage (cartes, actions, feed) sur tout le spectre du produit.
  { name: 'Finance', role: 'Paiements & risques', icon: <BanknoteIcon />, status: 'waiting', tasksToday: 7, lastRun: 'il y a 9 min', auto: false },
  { name: 'Compliance', role: 'Conformité & sécurité', icon: <ShieldCheckIcon />, status: 'waiting', tasksToday: 5, lastRun: 'il y a 31 min', auto: false },
  { name: 'Guest', role: 'Expérience voyageur', icon: <ConciergeBellIcon />, status: 'waiting', tasksToday: 11, lastRun: 'il y a 6 min', auto: false },
  { name: 'Owner', role: 'Relation propriétaire', icon: <HandshakeIcon />, status: 'waiting', tasksToday: 4, lastRun: 'il y a 48 min', auto: false },
  { name: 'Growth', role: 'Distribution & croissance', icon: <MegaphoneIcon />, status: 'waiting', tasksToday: 3, lastRun: 'il y a 2 h', auto: false },
];

/**
 * Statuts : une pastille + un mot. Seul « attend validation » sort du gris,
 * c'est le seul état qui appelle une action humaine. La pastille porte l'ambre
 * clair (elle est pleine, donc lisible), le texte porte l'encre ambrée
 * (`warning-ink`) : écrire en `text-warning` donnerait 2,17:1 sur fond clair.
 */
const AGENT_STATUS = {
  active: { label: 'Actif', dot: 'bg-foreground/45', text: 'text-muted-foreground' },
  idle: { label: 'En veille', dot: 'bg-muted-foreground/30', text: 'text-muted-foreground' },
  waiting: { label: 'Attend validation', dot: 'bg-warning', text: 'text-warning-ink' },
};

// ─── File de propositions ────────────────────────────────────────────────────

/** [libellé du bouton, icône, participe passé pour la trace]. */
interface Action {
  label: string;
  icon: React.ReactNode;
  done: string;
}

interface PendingItem {
  id: string;
  agent: string;
  title: string;
  motif: string;
  /**
   * Minutes restantes avant échéance. C'est le pendant de `expiresAt` du module
   * de supervision réel, en valeur relative pour que la démo reste stable.
   */
  expiresInMin: number;
  actions: [primary: Action, secondary: Action, dismiss: Action];
  /** Contenu enrichi propre à la proposition (chiffres, message proposé). */
  extra?: React.ReactNode;
}

/** Action déjà lancée par l'agent : elle s'observe, elle ne se valide pas. */
interface RunningItem {
  agent: string;
  label: string;
}

const VALIDATE: Action = { label: 'Appliquer', icon: <CheckIcon />, done: 'appliquée' };
const ADJUST: Action = { label: 'Ajuster', icon: <SlidersHorizontalIcon />, done: 'ouverte pour ajustement' };
const REFUSE: Action = { label: 'Refuser', icon: <XIcon />, done: 'refusée' };
const SEND: Action = { label: 'Envoyer', icon: <CheckIcon />, done: 'envoyée' };
const EDIT: Action = { label: 'Modifier', icon: <PencilIcon />, done: 'ouverte en édition' };
const IGNORE: Action = { label: 'Ignorer', icon: <XIcon />, done: 'ignorée' };
// Vocabulaire élargi — chaque nature d'action est un verbe métier, pas un
// « OK » générique : c'est lui qui devra piloter le rendu (icône, ton,
// confirmation éventuelle) quand ces cartes seront implémentées.
const APPROVE: Action = { label: 'Approuver', icon: <CheckIcon />, done: 'approuvée' };
const PUBLISH: Action = { label: 'Publier', icon: <CheckIcon />, done: 'publiée' };
const PAY: Action = { label: 'Verser', icon: <BanknoteIcon />, done: 'versée' };
const REFUND: Action = { label: 'Rembourser', icon: <BanknoteIcon />, done: 'remboursée' };
const WITHHOLD: Action = { label: 'Retenir', icon: <BanknoteIcon />, done: 'retenue' };
const BLOCK: Action = { label: 'Bloquer', icon: <ShieldAlertIcon />, done: 'bloquée' };
const ALLOW: Action = { label: 'Autoriser', icon: <CheckIcon />, done: 'autorisée' };
const VERIFY: Action = { label: 'Vérifier', icon: <EyeIcon />, done: 'ouverte pour vérification' };
const RETRY: Action = { label: 'Relancer', icon: <RefreshCwIcon />, done: 'relancée' };
const REPUBLISH: Action = { label: 'Republier', icon: <RefreshCwIcon />, done: 'republiée' };
const RESOLVE: Action = { label: 'Résoudre', icon: <CheckIcon />, done: 'résolue' };
const SNOOZE: Action = { label: 'Reporter', icon: <TimerIcon />, done: 'reportée à demain' };
const DECLARE: Action = { label: 'Télédéclarer', icon: <CheckIcon />, done: 'télédéclarée' };
const SIGN_SEND: Action = { label: 'Envoyer pour signature', icon: <PenLineIcon />, done: 'envoyée pour signature' };
const TAKEOVER: Action = { label: 'Reprendre la main', icon: <HandIcon />, done: 'reprise en main' };
const ORDER: Action = { label: 'Commander', icon: <PackageIcon />, done: 'commandée' };
const ACCEPT: Action = { label: 'Accepter', icon: <CheckIcon />, done: 'acceptée' };
const SCHEDULE: Action = { label: 'Planifier', icon: <CalendarClockIcon />, done: 'planifiée' };
const SUBMIT: Action = { label: 'Soumettre', icon: <CheckIcon />, done: 'soumise' };
const ROTATE: Action = { label: 'Renouveler', icon: <RefreshCwIcon />, done: 'renouvelée' };

const PENDING: PendingItem[] = [
  {
    id: 'rev-block',
    agent: 'Revenue',
    title: 'Blocage calendrier sur Villa Palmeraie',
    motif: 'Trois nuits isolées entre deux séjours, invendables en l\'état. Blocage proposé pour éviter un ménage à perte.',
    expiresInMin: 55,
    actions: [VALIDATE, ADJUST, REFUSE],
  },
  {
    id: 'rev-weekend',
    agent: 'Revenue',
    title: 'Hausse sur les week-ends de septembre',
    motif: 'Occupation à 88 % sur les 4 week-ends. Hausse de 8 % proposée, plafond de gamme respecté.',
    expiresInMin: 300,
    actions: [VALIDATE, ADJUST, REFUSE],
  },
  {
    id: 'rev-yield',
    agent: 'Revenue',
    title: 'Baisse tarifaire sur Riad Yasmine',
    motif: '9 nuits invendues du 18 au 27 août. Baisse de 12 % sur ces dates seulement, prix plancher respecté.',
    expiresInMin: 1320,
    actions: [VALIDATE, ADJUST, REFUSE],
    extra: (
      <>
        {/* Chiffres en ligne : un encadré gris dans un bloc déjà surfacé serait
            une surface imbriquée. La hiérarchie passe par la graisse.
            Le revenu attendu est l'espérance réelle (9 nuits × 70 € × 74 %). */}
        <p className="m-0 mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs">
          <span className="text-muted-foreground">
            Nuitée <span className="tabular-nums"><Money value={80} decimals={0} /></span>
            <span className="mx-1">→</span>
            <span className="font-medium text-foreground tabular-nums"><Money value={70} decimals={0} /></span>
          </span>
          <span className="text-muted-foreground">
            Revenu attendu{' '}
            <span className="font-medium text-foreground tabular-nums">
              +<Money value={466} decimals={0} />
            </span>
          </span>
        </p>
        <div className="mt-2.5 flex items-center gap-2.5">
          <Progress value={74} className="h-1 w-28 shrink-0" />
          <span className="text-xs text-muted-foreground tabular-nums">
            74 % de probabilité de remplissage
          </span>
        </div>
      </>
    ),
  },
  {
    id: 'com-late',
    agent: 'Messaging',
    title: 'Demande de départ tardif — Sofia Marchetti',
    motif: 'Départ à 15 h demandé sur le Duplex Guéliz. Aucune arrivée le jour même, le ménage reste tenable.',
    expiresInMin: 175,
    actions: [SEND, EDIT, IGNORE],
  },
  {
    id: 'com-cart',
    agent: 'Messaging',
    title: 'Relance de Karim El Fassi',
    motif: '2 nuits au Duplex Guéliz, 940 €, panier abandonné il y a 26 h. Message proposé :',
    expiresInMin: 700,
    actions: [SEND, EDIT, IGNORE],
    extra: (
      <blockquote className="m-0 mt-2 rounded-sm bg-muted px-2.5 py-2 text-xs text-foreground">
        Bonjour Karim, votre séjour du 14 au 16 août au Duplex Guéliz est toujours disponible.
        Réservez avant ce soir et profitez du petit-déjeuner offert.
      </blockquote>
    ),
  },
  {
    id: 'ops-clean',
    agent: 'Ops',
    title: 'Réaffectation du ménage de RES-1042',
    motif: 'Nadia Berrada est déjà sur deux départs à 11 h. Bascule proposée vers Youssef Amrani, disponible et à 900 m.',
    expiresInMin: 40,
    actions: [VALIDATE, EDIT, REFUSE],
  },

  // ── Catalogue élargi — comportements existants non modélisés, ou à venir ──
  // Chaque carte éprouve une NATURE différente : restriction, alignement
  // marché, avis public, upsell, escalade humaine, payout gated, devis,
  // capteur, stock, overbooking, parité, flux mort, fraude, impayé, caution,
  // geste commercial, fiche police, taxe de séjour, e-signature.

  {
    id: 'rev-minstay',
    agent: 'Revenue',
    title: 'Séjour minimum 2 nuits sur les ponts de mai',
    motif: 'Les nuits orphelines des ponts (1ᵉʳ, 8 et 29 mai) partent en séjours d\'une nuit à fort coût de ménage. Restriction proposée sur ces trois week-ends seulement.',
    expiresInMin: 2820,
    actions: [VALIDATE, ADJUST, REFUSE],
  },
  {
    id: 'rev-market',
    agent: 'Revenue',
    title: 'Alignement marché — festival de Marrakech',
    motif: 'Du 12 au 15 : le compset médian est monté à 96 € la nuit, vous êtes à 84 €. Hausse alignée proposée, plafond de gamme respecté.',
    expiresInMin: 400,
    actions: [VALIDATE, ADJUST, REFUSE],
    extra: (
      <p className="m-0 mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs">
        <span className="text-muted-foreground">
          Compset médian{' '}
          <span className="font-medium text-foreground tabular-nums"><Money value={96} decimals={0} /></span>
        </span>
        <span className="text-muted-foreground">
          Vous <span className="tabular-nums"><Money value={84} decimals={0} /></span>
        </span>
        <span className="text-muted-foreground">
          Proposé{' '}
          <span className="font-medium text-foreground tabular-nums"><Money value={94} decimals={0} /></span>
        </span>
      </p>
    ),
  },
  {
    id: 'com-review',
    agent: 'Messaging',
    title: 'Réponse à l\'avis 3★ de John Smith',
    motif: 'Publier une réponse engage la marque : l\'agent rédige, vous relisez. Réponse proposée :',
    expiresInMin: 2100,
    actions: [PUBLISH, EDIT, IGNORE],
    extra: (
      <>
        <p className="m-0 mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-0.5 text-warning" aria-hidden>
            <StarIcon className="size-3 fill-current" />
            <StarIcon className="size-3 fill-current" />
            <StarIcon className="size-3 fill-current" />
            <StarIcon className="size-3" />
            <StarIcon className="size-3" />
          </span>
          « Bel emplacement, mais la climatisation était bruyante. » — Booking
        </p>
        <blockquote className="m-0 mt-2 rounded-sm bg-muted px-2.5 py-2 text-xs text-foreground">
          Merci John. Le climatiseur du séjour a été révisé dès votre signalement — au plaisir de
          vous accueillir à nouveau.
        </blockquote>
      </>
    ),
  },
  {
    id: 'com-upsell',
    agent: 'Messaging',
    title: 'Early check-in proposé à Léa Martin',
    motif: 'Arrivée prévue à 15 h, logement prêt dès 11 h (départ la veille, ménage fait). Check-in anticipé à 15 € proposé.',
    expiresInMin: 480,
    actions: [SEND, EDIT, IGNORE],
  },
  {
    id: 'com-risk',
    agent: 'Messaging',
    title: 'Conversation à risque — ton négatif détecté',
    motif: 'Trois messages de Sofia Marchetti en 20 min sur la climatisation, sentiment en baisse. L\'agent suggère une reprise en main humaine avant sa prochaine réponse.',
    expiresInMin: 25,
    actions: [TAKEOVER, VERIFY, IGNORE],
  },
  {
    id: 'ops-payout',
    agent: 'Ops',
    title: 'Versement ménage — preuve photo reçue',
    motif: 'Youssef Amrani a livré la checklist complète et 3 photos sur RES-1040. Versement de 180 € prêt.',
    expiresInMin: 2600,
    actions: [PAY, VERIFY, REFUSE],
    extra: (
      <p className="m-0 mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <CameraIcon className="size-3.5" aria-hidden /> 3 photos horodatées
        </span>
        <span className="flex items-center gap-1.5">
          <CheckIcon className="size-3.5" aria-hidden /> 8/8 points de contrôle
        </span>
        <span>
          Montant{' '}
          <span className="font-medium text-foreground tabular-nums"><Money value={180} decimals={0} /></span>
        </span>
      </p>
    ),
  },
  {
    id: 'ops-devis',
    agent: 'Ops',
    title: 'Devis fuite d\'eau — Villa Palmeraie',
    motif: 'Fuite signalée au check-out. Deux devis reçus ; l\'agent recommande le plus rapide, une arrivée a lieu jeudi.',
    expiresInMin: 320,
    actions: [APPROVE, ADJUST, REFUSE],
    extra: (
      <div className="mt-2 flex flex-col gap-1 text-xs">
        <p className="m-0 flex items-baseline justify-between gap-3">
          <span className="font-medium text-foreground">Plomberie Atlas — demain 9 h</span>
          <span className="text-foreground tabular-nums"><Money value={320} decimals={0} /></span>
        </p>
        <p className="m-0 flex items-baseline justify-between gap-3 text-muted-foreground">
          <span>SOS Fuites — vendredi</span>
          <span className="tabular-nums"><Money value={280} decimals={0} /></span>
        </p>
      </div>
    ),
  },
  {
    id: 'ops-noise',
    agent: 'Ops',
    title: 'Bruit prolongé au Duplex Guéliz',
    motif: '78 dB depuis 35 min (seuil : 70). Message d\'avertissement WhatsApp prêt pour le guest, ton courtois.',
    expiresInMin: 15,
    actions: [SEND, EDIT, IGNORE],
  },
  {
    id: 'ops-stock',
    agent: 'Ops',
    title: 'Stock linge sous le seuil au Riad Yasmine',
    motif: 'Plus que 4 parures pour 6 lits après les trois départs de samedi. Commande de 12 parures proposée chez le fournisseur habituel.',
    expiresInMin: 4200,
    actions: [ORDER, ADJUST, IGNORE],
  },
  {
    id: 'sync-overlap',
    agent: 'Sync',
    title: 'Chevauchement RES-1044 × Booking HM-2210',
    motif: 'Deux séjours se recouvrent d\'une nuit sur le Riad (annulation Airbnb rejouée). L\'agent propose de garder le séjour Booking, déjà payé, et de replacer l\'autre.',
    expiresInMin: 30,
    actions: [RESOLVE, VERIFY, SNOOZE],
  },
  {
    id: 'sync-parity',
    agent: 'Sync',
    title: 'Écart de parité sur Booking — Riad Yasmine',
    motif: 'Booking affiche 71 € contre 80 € partout ailleurs (promotion de canal résiduelle). Republication du prix proposée.',
    expiresInMin: 250,
    actions: [REPUBLISH, ADJUST, IGNORE],
    extra: (
      <p className="m-0 mt-2 text-xs text-muted-foreground">
        Booking <span className="tabular-nums"><Money value={71} decimals={0} /></span>
        <span className="mx-1">→</span>
        <span className="font-medium text-foreground tabular-nums"><Money value={80} decimals={0} /></span>{' '}
        partout ailleurs
      </p>
    ),
  },
  {
    id: 'sync-ical',
    agent: 'Sync',
    title: 'Flux iCal Vrbo muet depuis 26 h',
    motif: 'Trois tentatives en échec (délai dépassé). Reconnexion forcée proposée ; en cas de nouvel échec, gel des disponibilités Vrbo par précaution.',
    expiresInMin: 90,
    actions: [RETRY, VERIFY, SNOOZE],
  },
  {
    id: 'fin-fraud',
    agent: 'Finance',
    title: 'Réservation à risque — score 82/100',
    motif: 'Créée il y a 12 min : carte étrangère, une nuit ce soir, e-mail jetable. Blocage avant confirmation proposé.',
    expiresInMin: 20,
    actions: [BLOCK, VERIFY, ALLOW],
    extra: (
      <div className="mt-2.5 flex items-center gap-2.5">
        <Progress
          value={82}
          className="h-1 w-28 shrink-0 [&_[data-slot=progress-indicator]]:bg-warning"
        />
        <span className="text-xs text-muted-foreground tabular-nums">82/100 · 3 signaux</span>
      </div>
    ),
  },
  {
    id: 'fin-balance',
    agent: 'Finance',
    title: 'Solde impayé RES-1051 — 868 €',
    motif: 'Échu depuis 2 jours, deux rappels restés sans réponse. Lien de paiement régénéré et dernière relance prêts.',
    expiresInMin: 620,
    actions: [SEND, EDIT, SNOOZE],
  },
  {
    id: 'fin-caution',
    agent: 'Finance',
    title: 'Retenue de caution — verre de table brisé',
    motif: 'Signalé par le ménage au départ de RES-1037, photo à l\'appui. Retenue de 120 € sur la pré-autorisation proposée, justificatif joint au guest.',
    expiresInMin: 1100,
    actions: [WITHHOLD, ADJUST, REFUSE],
  },
  {
    id: 'fin-gesture',
    agent: 'Finance',
    title: 'Geste commercial après panne d\'eau chaude',
    motif: 'Deux nuits sans eau chaude documentées au Studio Anfa. Avoir de 45 € (15 %) proposé avant que le guest ne dépose son avis.',
    expiresInMin: 900,
    actions: [REFUND, ADJUST, REFUSE],
  },
  {
    id: 'cmp-police',
    agent: 'Compliance',
    title: '2 fiches police à télédéclarer avant minuit',
    motif: 'Arrivées du jour (Benali, Smith) : fiches DGSN pré-remplies depuis les passeports scannés. Dépôt sur le portail proposé.',
    expiresInMin: 190,
    actions: [DECLARE, VERIFY, SNOOZE],
  },
  {
    id: 'cmp-tax',
    agent: 'Compliance',
    title: 'Taxe de séjour T3 prête — 4 380 MAD',
    motif: '212 nuitées taxables sur le trimestre, exonérations enfants déduites. Déclaration et ordre de paiement prêts.',
    expiresInMin: 5600,
    actions: [APPROVE, VERIFY, SNOOZE],
  },
  {
    id: 'cmp-mandat',
    agent: 'Compliance',
    title: 'Mandat de gestion Studio Anfa à signer',
    motif: 'Le propriétaire a accepté l\'offre par e-mail. Mandat généré (le gestionnaire encaisse, reversement mensuel), prêt pour la signature électronique.',
    expiresInMin: 2900,
    actions: [SIGN_SEND, EDIT, SNOOZE],
  },

  // ── Couverture exhaustive des métiers ────────────────────────────────────
  // Cycle de vie réservation, IoT serrures, maintenance préventive, sécurité
  // de compte, RGPD, licences, litiges bancaires, relation propriétaire,
  // expérience voyageur, distribution multi-canal et croissance.

  {
    id: 'rev-promocancel',
    agent: 'Revenue',
    title: 'Promotions qui se cannibalisent — Riad Yasmine',
    motif: 'Early bird et last-minute se cumulent sur 4 nuits (−27 % au total). Désactivation de l\'early bird sur ces dates proposée.',
    expiresInMin: 720,
    actions: [VALIDATE, ADJUST, REFUSE],
  },
  {
    id: 'ops-preventive',
    agent: 'Ops',
    title: 'Entretien climatisation avant l\'été — 3 logements',
    motif: 'Aucune révision depuis 11 mois sur Riad, Duplex et Villa. Tournée unique proposée le 12 (créneau creux commun aux trois calendriers).',
    expiresInMin: 8600,
    actions: [SCHEDULE, ADJUST, SNOOZE],
  },
  {
    id: 'ops-lock',
    agent: 'Ops',
    title: 'Batterie serrure Nuki à 12 % — Villa Palmeraie',
    motif: 'Autonomie estimée : 6 jours. Remplacement à planifier avant l\'arrivée de samedi, créneau technicien disponible jeudi 14 h.',
    expiresInMin: 1700,
    actions: [SCHEDULE, VERIFY, SNOOZE],
  },
  {
    id: 'sync-noshow',
    agent: 'Sync',
    title: 'No-show à déclarer sur Airbnb — RES-1053',
    motif: 'Guest injoignable depuis 22 h, logement non occupé. Déclaration dans la fenêtre des 48 h pour récupérer les frais et libérer les nuits.',
    expiresInMin: 2300,
    actions: [DECLARE, VERIFY, SNOOZE],
  },
  {
    id: 'fin-chargeback',
    agent: 'Finance',
    title: 'Contestation bancaire reçue — 412 €',
    motif: 'Chargeback sur RES-1029. Dossier de preuves assemblé (contrat, journal de check-in, messages) — à soumettre avant le 12.',
    expiresInMin: 4100,
    actions: [SUBMIT, VERIFY, SNOOZE],
  },
  {
    id: 'fin-apikey',
    agent: 'Finance',
    title: 'Clé API Stripe restreinte expire dans 7 jours',
    motif: 'La clé du terminal de paiement arrive à échéance. Rotation sans coupure proposée (nouvelle clé testée, bascule, révocation).',
    expiresInMin: 9800,
    actions: [ROTATE, VERIFY, SNOOZE],
  },
  {
    id: 'cmp-gdpr',
    agent: 'Compliance',
    title: 'Demande d\'effacement RGPD — John Smith',
    motif: 'Purge des données personnelles au-delà de la rétention légale ; les factures et fiches police sont conservées (obligation). Rapport d\'effacement joint.',
    expiresInMin: 41000,
    actions: [APPROVE, VERIFY, SNOOZE],
  },
  {
    id: 'cmp-license',
    agent: 'Compliance',
    title: 'Licence courte durée expire dans 30 j — Riad Yasmine',
    motif: 'Dossier de renouvellement pré-rempli depuis les pièces du logement. Dépôt en ligne proposé, accusé attendu sous 10 jours.',
    expiresInMin: 15000,
    actions: [SUBMIT, VERIFY, SNOOZE],
  },
  {
    id: 'cmp-login',
    agent: 'Compliance',
    title: 'Connexion inhabituelle sur le compte de Nadia',
    motif: 'Nouvel appareil à Casablanca à 3 h 12, hors de ses horaires habituels. Verrouillage préventif + réinitialisation 2FA proposés.',
    expiresInMin: 35,
    actions: [BLOCK, VERIFY, ALLOW],
  },
  {
    id: 'gst-datechange',
    agent: 'Guest',
    title: 'Modification de séjour demandée — Amina Benali',
    motif: 'Décalage du 12-19 au 13-20 août demandé. Calendrier libre, différentiel de +20 € au tarif en vigueur. Accord et avenant prêts.',
    expiresInMin: 240,
    actions: [ACCEPT, ADJUST, REFUSE],
    extra: (
      <p className="m-0 mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs">
        <span className="text-muted-foreground">
          12 → 19 août <span className="mx-1">devient</span>
          <span className="font-medium text-foreground">13 → 20 août</span>
        </span>
        <span className="text-muted-foreground">
          Différentiel{' '}
          <span className="font-medium text-foreground tabular-nums">
            +<Money value={20} decimals={0} />
          </span>
        </span>
      </p>
    ),
  },
  {
    id: 'gst-latecheckout',
    agent: 'Guest',
    title: 'Late checkout à 30 € proposable — RES-1048',
    motif: 'Aucune arrivée le lendemain au Duplex, le ménage peut glisser à 16 h. Proposition de départ tardif prête à partir la veille du départ.',
    expiresInMin: 1500,
    actions: [SEND, EDIT, IGNORE],
  },
  {
    id: 'gst-guide',
    agent: 'Guest',
    title: 'Livret d\'accueil à envoyer — arrivée Smith demain',
    motif: 'Lien sécurisé borné au séjour, wifi et code boîte à clés vérifiés à l\'instant. Envoi avec le message de veille d\'arrivée.',
    expiresInMin: 380,
    actions: [SEND, VERIFY, SNOOZE],
  },
  {
    id: 'gst-relodge',
    agent: 'Guest',
    title: 'Relogement après panne de climatisation',
    motif: 'Studio Anfa inhabitable ce soir (38 °C annoncés). Villa Palmeraie libre 2 nuits : transfert au même tarif proposé, taxi offert.',
    expiresInMin: 70,
    actions: [VALIDATE, ADJUST, REFUSE],
  },
  {
    id: 'gst-reviewask',
    agent: 'Guest',
    title: 'Demande d\'avis post-séjour — Fatima Zahra',
    motif: 'Séjour sans incident, deux compliments en messagerie. Demande d\'avis proposée 24 h après le départ, lien direct Booking.',
    expiresInMin: 1250,
    actions: [SEND, EDIT, IGNORE],
  },
  {
    id: 'own-statement',
    agent: 'Owner',
    title: 'Relevé mensuel de juillet prêt — M. Alaoui',
    motif: '3 séjours, 2 340 € encaissés, commission et ménages déduits. Relevé PDF généré, prêt à partir sur le portail propriétaire.',
    expiresInMin: 2000,
    actions: [SEND, VERIFY, SNOOZE],
    extra: (
      <p className="m-0 mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs">
        <span className="text-muted-foreground">
          Encaissé{' '}
          <span className="font-medium text-foreground tabular-nums"><Money value={2340} decimals={0} /></span>
        </span>
        <span className="text-muted-foreground">
          Commission <span className="tabular-nums">−<Money value={468} decimals={0} /></span>
        </span>
        <span className="text-muted-foreground">
          Net propriétaire{' '}
          <span className="font-medium text-foreground tabular-nums"><Money value={1872} decimals={0} /></span>
        </span>
      </p>
    ),
  },
  {
    id: 'own-payout',
    agent: 'Owner',
    title: 'Versement propriétaire — 1 872 €',
    motif: 'Relevé de juillet approuvé par M. Alaoui hier. Virement SEPA prêt vers son IBAN habituel.',
    expiresInMin: 3100,
    actions: [PAY, VERIFY, SNOOZE],
  },
  {
    id: 'own-works',
    agent: 'Owner',
    title: 'Accord travaux à demander — étanchéité terrasse',
    motif: 'Infiltration constatée par le ménage à la Villa. Devis de 780 € à la charge du propriétaire : demande d\'accord rédigée, photos jointes.',
    expiresInMin: 5200,
    actions: [SEND, EDIT, SNOOZE],
  },
  {
    id: 'own-alert',
    agent: 'Owner',
    title: 'Baisse de revenus à expliquer — Studio Anfa (−32 %)',
    motif: 'Juillet en retrait vs N−1 : saisonnalité Casablanca + 12 jours archivés. Note d\'analyse rédigée pour devancer la question du propriétaire.',
    expiresInMin: 6500,
    actions: [SEND, EDIT, IGNORE],
  },
  {
    id: 'gro-listing',
    agent: 'Growth',
    title: 'Annonce Expedia prête à publier — Riad Yasmine',
    motif: 'Mappée depuis le catalogue : 28 photos, équipements, tarifs et disponibilités synchronisés. Publication sur le nouveau canal proposée.',
    expiresInMin: 7000,
    actions: [PUBLISH, VERIFY, SNOOZE],
  },
  {
    id: 'gro-photos',
    agent: 'Growth',
    title: 'Score photo faible — Studio Anfa (41/100)',
    motif: 'Photos sombres et sans grand angle, conversion 2× sous la moyenne du portefeuille. Shooting professionnel à 350 MAD proposé.',
    expiresInMin: 12000,
    actions: [SCHEDULE, ADJUST, IGNORE],
    extra: (
      <div className="mt-2.5 flex items-center gap-2.5">
        <Progress
          value={41}
          className="h-1 w-28 shrink-0 [&_[data-slot=progress-indicator]]:bg-warning"
        />
        <span className="text-xs text-muted-foreground tabular-nums">41/100 · moyenne portefeuille 74</span>
      </div>
    ),
  },
  {
    id: 'gro-translate',
    agent: 'Growth',
    title: 'Traduction arabe de l\'annonce à valider',
    motif: 'Description et règles de la maison traduites pour le Riad. Relecture demandée avant publication — la traduction engage l\'annonce.',
    expiresInMin: 8200,
    actions: [APPROVE, EDIT, SNOOZE],
  },
  {
    id: 'gro-promo',
    agent: 'Growth',
    title: 'Promo last-minute −15 % sur 5 nuits creuses',
    motif: 'Cette semaine au Duplex, aucune vue depuis 6 jours. Promotion bornée aux 5 nuits, marge plancher respectée.',
    expiresInMin: 950,
    actions: [VALIDATE, ADJUST, REFUSE],
  },
];

/** Ce que les agents exécutent en ce moment, sans validation humaine. */
const RUNNING: RunningItem[] = [
  { agent: 'Revenue', label: 'Recalcul des prix sur 12 logements' },
  { agent: 'Messaging', label: 'Traduction de 3 réponses en arabe' },
  { agent: 'Ops', label: 'Création de 4 interventions de ménage' },
  { agent: 'Ops', label: 'Synchronisation des disponibilités prestataires' },
  { agent: 'Sync', label: 'Réconciliation Airbnb et Booking' },
  { agent: 'Sync', label: 'Reprise du flux iCal Vrbo (3ᵉ tentative)' },
  { agent: 'Finance', label: 'Rapprochement de 7 paiements Stripe' },
  { agent: 'Finance', label: 'Renouvellement de 2 pré-autorisations de caution' },
  { agent: 'Compliance', label: 'Pré-remplissage des fiches police du jour' },
  { agent: 'Guest', label: 'Préparation des messages de veille d\'arrivée (2)' },
  { agent: 'Owner', label: 'Génération de 3 relevés mensuels' },
  { agent: 'Growth', label: 'Recalcul du score qualité des 12 annonces' },
];

/**
 * Tri des propositions : échéance croissante.
 *
 * C'est la règle de production. Contrairement à ce qu'on pourrait supposer,
 * `PendingAction` ne porte AUCUN champ de priorité ou de sévérité côté
 * supervision — vérifié dans `src/modules/supervision/types.ts`. La seule
 * hiérarchie réelle est l'ordre des piles par agent (`TYPE_ORDER` dans
 * `components/TaskDeckQueue.tsx`) puis, à l'intérieur d'une pile, le tri par
 * `expiresAt` croissant. Une pile ne contenant qu'un agent, il ne reste ici
 * que l'échéance.
 */
function waitingFor(agent: string, decided: Record<string, string>) {
  return PENDING.filter((item) => item.agent === agent && !decided[item.id]).sort(
    (a, b) => a.expiresInMin - b.expiresInMin
  );
}

function runningFor(agent: string) {
  return RUNNING.filter((item) => item.agent === agent);
}

/**
 * Agent pré-sélectionné : celui qui porte le plus de propositions, l'échéance
 * la plus proche départageant les ex aequo.
 *
 * Écart assumé avec la production, où `SupervisionPanel` initialise la
 * sélection à `null` et n'ouvre le tiroir que sur clic. Ici l'écran s'ouvre
 * déjà sur le travail à faire plutôt que sur un panneau vide.
 */
function busiestAgent(decided: Record<string, string>) {
  return [...AGENTS].sort((a, b) => {
    const wa = waitingFor(a.name, decided);
    const wb = waitingFor(b.name, decided);
    if (wa.length !== wb.length) return wb.length - wa.length;
    return (wa[0]?.expiresInMin ?? Infinity) - (wb[0]?.expiresInMin ?? Infinity);
  })[0].name;
}

/** Reprend le formatage de `remainingLabel` (TaskDeckQueue de production). */
function formatRemaining(minutes: number) {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
  }
  if (minutes >= 1) return `${minutes} min`;
  return '< 1 min';
}

/**
 * Micro-label de section (h2 : le PageHeader porte le h1). 12 px minimum,
 * comme tout le texte de la section : la densité vient du rythme des lignes,
 * pas du rapetissement du texte.
 */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="m-0 text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
      {children}
    </h2>
  );
}

// ─── Vue cartes ──────────────────────────────────────────────────────────────

/**
 * Une carte par agent, sur quatre colonnes. En lignes pleine largeur, ces mêmes
 * données laissaient un vide de plusieurs centaines de pixels au milieu de
 * l'écran et coûtaient quatre fois la hauteur ; la carte referme l'espace
 * horizontal et rend l'ensemble scannable d'un coup d'œil.
 *
 * La carte porte une surface parce qu'on agit dessus (l'interrupteur
 * auto/validation). Elle reste dans le langage de la refonte : pas de bordure
 * (la surface suffit), rayon serré, et l'état ne sort du gris que lorsqu'il
 * appelle une décision.
 */
function AgentCard({
  agent,
  auto,
  onAutoChange,
  waiting,
  running,
}: {
  agent: AgentNode;
  auto: boolean;
  onAutoChange: (auto: boolean) => void;
  waiting: number;
  running: number;
}) {
  // Statut dérivé de la file, comme le fait le provider de supervision réel :
  // un agent qui porte une proposition passe en attente, les autres suivent
  // leur activité. Le champ `status` des données ne sert plus que de repli.
  const status = waiting
    ? AGENT_STATUS.waiting
    : running
      ? AGENT_STATUS.active
      : AGENT_STATUS.idle;
  return (
    <article className="flex flex-col gap-2.5 rounded-md bg-card p-3">
      <div className="flex items-start gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground [&>svg]:size-4">
          {agent.icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="m-0 text-sm font-medium text-foreground">Agent {agent.name}</h3>
          <p className="m-0 text-xs text-muted-foreground">{agent.role}</p>
        </div>
      </div>

      <p className={cn('m-0 flex items-center gap-1.5 text-xs', status.text)}>
        <span className={cn('size-1.5 shrink-0 rounded-[2px]', status.dot)} aria-hidden />
        {status.label}
      </p>

      <div className="flex items-center justify-between gap-2 border-t border-border pt-2.5 text-xs text-muted-foreground">
        <span className="text-foreground tabular-nums">{agent.tasksToday} tâches</span>
        <span>{agent.lastRun}</span>
      </div>

      <label className="flex cursor-pointer items-center justify-between gap-2 text-xs text-muted-foreground">
        {auto ? 'Auto-application' : 'Validation humaine'}
        <Switch
          checked={auto}
          onCheckedChange={onAutoChange}
          aria-label={`Mode auto — Agent ${agent.name}`}
        />
      </label>
    </article>
  );
}

// ─── Vue constellation orbitale ──────────────────────────────────────────────

/**
 * Géométrie de l'orbite, exprimée en % du côté du canvas (toujours carré) —
 * tout reste donc proportionnel quelle que soit la largeur disponible.
 */
const ORBIT_RADIUS = 33;
/** Le noyau ancre la composition mais n'encode rien : il ne doit pas écraser
 *  les agents, qui eux portent toute l'information. */
const CORE_SIZE = 15;
/**
 * Diamètre UNIFORME des nœuds, en % du canvas. L'ancien encodage aire ∝ tâches
 * du jour faisait gonfler l'agent le plus chargé (Sync, 31 tâches) jusqu'à
 * chevaucher ses voisins et les attaches — intenable à 9 agents sur l'orbite.
 * Le volume reste lisible là où il l'était déjà : le libellé sous le nœud
 * (« N à valider ») et l'infobulle.
 */
const NODE_SIZE = 12;

/**
 * Angle d'un agent, en degrés (0 = 3 h, sens horaire), DÉRIVÉ de son index.
 * Le décalage de −45° met les deux premiers agents (ceux qui produisent des
 * propositions) côté file, pour que les traits de rattachement partent vers
 * elle sans se croiser. Dérivé plutôt que codé par nom : un cinquième agent se
 * place tout seul au lieu de produire un NaN.
 */
function orbitAngle(index: number, total: number) {
  return -45 + (index * 360) / total;
}

/** Point de l'orbite pour un angle donné, en % du canvas. */
function polar(angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: 50 + radius * Math.cos(rad), y: 50 + radius * Math.sin(rad) };
}

/**
 * Feuille scopée par préfixe `bo-`, plutôt qu'ajoutée à baitly-ui.css : ce sont
 * des règles de projection, elles n'ont pas à polluer la couche partagée du kit.
 *
 * Budget de mouvement : deux animations d'état. Le halo de l'agent qui attend
 * une validation, et le relais de données de l'agent SÉLECTIONNÉ : UN paquet
 * fin, teinte primaire, part du noyau, atteint l'agent, puis se relaie le
 * long des attaches vers TOUTES ses cartes HITL ensemble — pas d'aller-retour,
 * la donnée finit là où la décision se prend. Le segment noyau → agent ne
 * porte jamais qu'un seul paquet (dash en unités utilisateur, cf. FLOW_LEG_*).
 * Il démarre quand l'agent a rejoint l'emplacement de tête (haut à droite,
 * face à la file) et tourne tant que sa file est ouverte. Le survol, lui,
 * n'anime rien : il isole l'agent visé et montre l'infobulle.
 */
/** Durée d'un cycle du relais : sortie du noyau puis relais vers les cartes. */
const FLOW_CYCLE_MS = 3200;

/**
 * Géométrie de la jambe radiale, en unités du viewBox — la MÊME pour tous les
 * agents (rayons constants), ce qui permet d'écrire le dash du paquet en
 * unités utilisateur exactes. Indispensable : combiner `pathLength` et
 * `vector-effect: non-scaling-stroke` est bugué dans Chromium (le pathLength
 * est ignoré), ce qui faisait transiter PLUSIEURS tirets fantômes entre le
 * noyau et l'agent. Sans pathLength, le motif est exact : un seul paquet.
 */
const FLOW_LEG_START = CORE_SIZE / 2 + 1.3;
const FLOW_LEG_END = ORBIT_RADIUS - NODE_SIZE / 2 - 0.6;
const FLOW_LEG_LENGTH = FLOW_LEG_END - FLOW_LEG_START;
/** Longueur du paquet radial (unités viewBox). */
const FLOW_DASH = 4.5;

const ORBIT_STYLES = `
.bo-node, .bo-flow, .bo-tether { transition: opacity .15s cubic-bezier(.25,1,.5,1); }
.bo-view { animation: bo-view-in .16s cubic-bezier(.25,1,.5,1) both; }
@keyframes bo-view-in { from { opacity: 0; } to { opacity: 1; } }

/* ── Rotation de l'anneau à la sélection ─────────────────────────────── */
/* L'anneau porte la rotation, chaque nœud porte la rotation inverse : même
   durée et même courbe des deux côtés, sinon les libellés partiraient de
   travers en cours de route. Les agents glissent ainsi le long de l'orbite
   au lieu de sauter en travers du diagramme. */
.bo-ring, .bo-node { transition: transform 720ms cubic-bezier(.25,1,.5,1); }

/* ── Flux de données : relais noyau → agent → propositions ────────────── */
/* Joué pour l'agent SÉLECTIONNÉ, une fois arrivé à l'emplacement de tête
   (les attaches vers les cartes n'existent qu'après la rotation — c'est ce
   qui synchronise les deux jambes). UN SEUL paquet part du noyau [0 ; 38 %],
   atteint l'agent, puis se relaie le long des attaches vers TOUTES les
   cartes ensemble [38 ; 92 %] — pas de retour : la donnée finit là où la
   décision se prend. Une seule teinte (primaire) et un trait fin : un filet
   de données, pas un néon.
   Deux systèmes de dash : la jambe radiale est en unités utilisateur (sa
   longueur est constante : ${FLOW_LEG_LENGTH.toFixed(1)}), car pathLength +
   non-scaling-stroke est bugué dans Chromium et faisait transiter des tirets
   fantômes ; les attaches, en espace pixel sans non-scaling-stroke, gardent
   pathLength=100. */
.bo-packet {
  display: none;
  fill: none;
  stroke-linecap: round;
  opacity: .85;
}
.bo-flow[data-selected="true"] .bo-packet,
.bo-tether .bo-packet { display: inline; }
.bo-packet-out {
  stroke-dasharray: ${FLOW_DASH} ${(FLOW_LEG_LENGTH * 3).toFixed(1)};
  animation: bo-relay-out ${FLOW_CYCLE_MS}ms linear infinite;
}
.bo-packet-hop {
  stroke-dasharray: 12 200;
  animation: bo-relay-hop ${FLOW_CYCLE_MS}ms linear infinite;
}
@keyframes bo-relay-out {
  0% { stroke-dashoffset: ${FLOW_DASH}; }
  38%, 100% { stroke-dashoffset: ${(-(FLOW_LEG_LENGTH + FLOW_DASH)).toFixed(1)}; }
}
@keyframes bo-relay-hop { 0%, 38% { stroke-dashoffset: 12; } 92%, 100% { stroke-dashoffset: -112; } }

/* ── Halo de l'agent qui attend : l'autre boucle d'état ──────────────── */
.bo-ripple { opacity: 0; transform-origin: center; animation: bo-ripple 3.6s cubic-bezier(.25,1,.5,1) infinite; }
@keyframes bo-ripple { 0% { transform: scale(1); opacity: .45; } 100% { transform: scale(1.4); opacity: 0; } }

/* ── Survol : l'agent visé s'isole (aperçu), sans déclencher de flux ─── */
.bo-wrap:has(.bo-hit:is(:hover, :focus-visible)) .bo-node:not(:has(.bo-hit:is(:hover, :focus-visible))) { opacity: .3; }
${AGENTS.map(
  (agent) => `.bo-wrap:has(.bo-hit[data-agent="${agent.name}"]:is(:hover, :focus-visible)) :is(.bo-flow, .bo-tether):not([data-agent="${agent.name}"]) { opacity: .15; }`
).join('\n')}

/* ── Mouvement réduit : plus rien ne bouge, rien d'essentiel ne part ─── */
@media (prefers-reduced-motion: reduce) {
  .bo-ripple { display: none; }
  .bo-view, .bo-packet { animation: none; }
  /* Sans animation, un paquet figé ne serait qu'un tiret parasite. */
  .bo-flow[data-selected="true"] .bo-packet,
  .bo-tether .bo-packet { display: none; }
  /* La sélection reste fonctionnelle : l'agent rejoint sa place sans trajet. */
  .bo-ring, .bo-node { transition: none; }
}
`;

/**
 * Diagramme orbital : noyau Baitly au centre, agents en orbite.
 * Positions en `left/top` physiques (et non logiques) : c'est un schéma
 * géométrique, il ne se miroite pas en RTL — seul le rattachement aux cartes
 * s'adapte au sens de lecture (cf. `useTethers`).
 *//**
 * Emplacement de l'agent sélectionné : en haut à droite, face à la file. Tous
 * les autres se répartissent à intervalle régulier à partir de là.
 */
const SLOT_ANGLE = -45;

/** Angle canonique d'un agent, avant rotation de l'anneau. */
function baseAngle(index: number, total: number) {
  return (index * 360) / total;
}

/** Rotation à appliquer pour amener l'agent `index` sur l'emplacement de tête. */
function rotationFor(index: number, total: number) {
  return SLOT_ANGLE - baseAngle(index, total);
}

/**
 * Diagramme orbital : noyau Baitly au centre, agents en orbite.
 *
 * Positions en `left/top` physiques (et non logiques) : c'est un schéma
 * géométrique, il ne se miroite pas en RTL — seul le rattachement aux cartes
 * s'adapte au sens de lecture (cf. `useTethers`).
 *
 * La sélection ne déplace pas les nœuds un à un : elle fait pivoter TOUT
 * l'anneau (`rotation`), si bien que les agents glissent le long de l'orbite au
 * lieu de sauter en travers. Chaque nœud applique la rotation inverse pour
 * rester droit.
 */
function AgentOrbit({
  selected,
  onSelect,
  rotation,
  flowActive,
  decided,
  registerNode,
}: {
  selected: string;
  onSelect: (name: string) => void;
  rotation: number;
  /** Vrai quand l'agent a rejoint l'emplacement de tête : le relais peut jouer. */
  flowActive: boolean;
  decided: Record<string, string>;
  registerNode: (name: string, el: HTMLElement | null) => void;
}) {
  const totalTasks = AGENTS.reduce((sum, agent) => sum + agent.tasksToday, 0);

  // 480px : à 9 agents, les libellés sous les nœuds ont besoin de plus de
  // circonférence qu'à 4 — l'espacement angulaire est passé de 90° à 40°.
  return (
    <div className="bo-canvas relative mx-auto aspect-square w-full max-w-[480px]">
      <style>{ORBIT_STYLES}</style>

      {/* L'anneau ne tourne pas : il est invariant par rotation. */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden>
        <circle
          cx="50"
          cy="50"
          r={ORBIT_RADIUS}
          fill="none"
          className="stroke-border"
          strokeWidth="0.25"
          opacity="0.65"
        />
      </svg>

      <div
        className="bo-ring absolute inset-0"
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden>
          {AGENTS.map((agent, index) => {
            const angle = baseAngle(index, AGENTS.length);
            // Rayons partagés avec le dash du paquet (FLOW_LEG_*) : la
            // longueur du rail DOIT rester celle que les keyframes traversent.
            const from = polar(angle, FLOW_LEG_START);
            const to = polar(angle, FLOW_LEG_END);
            const segment = { x1: from.x, y1: from.y, x2: to.x, y2: to.y };
            return (
              <g
                key={agent.name}
                className="bo-flow"
                data-agent={agent.name}
                data-selected={(agent.name === selected && flowActive) || undefined}
              >
                {/* Même dessin que les attaches (rail 1 px, paquet 1,5 px) :
                    `non-scaling-stroke` fige l'épaisseur en pixels d'écran,
                    alors que le viewBox du canvas grossirait des traits
                    exprimés dans ses unités. Une seule grammaire de flux,
                    du noyau jusqu'aux cartes. */}
                <line
                  {...segment}
                  vectorEffect="non-scaling-stroke"
                  strokeWidth="1"
                  className="stroke-border"
                />
                {/* Première jambe du relais : UN paquet fin, teinte primaire.
                    Pas de pathLength ici (bug Chromium avec non-scaling-stroke,
                    cf. FLOW_LEG_*) : le dash est écrit en unités utilisateur,
                    exactes car la longueur du rail est constante. */}
                <line
                  {...segment}
                  vectorEffect="non-scaling-stroke"
                  strokeWidth="1.5"
                  className="bo-packet bo-packet-out stroke-primary"
                />
              </g>
            );
          })}
        </svg>

        {AGENTS.map((agent, index) => {
          const point = polar(baseAngle(index, AGENTS.length), ORBIT_RADIUS);
          const waiting = waitingFor(agent.name, decided);
          const running = runningFor(agent.name);
          const isSelected = agent.name === selected;
          // Le halo ne signale que ce qui n'est PAS déjà ouvert à droite :
          // pulser sur l'agent dont on lit justement la file serait redondant.
          const needsAttention = waiting.length > 0 && !isSelected;
          const status = waiting.length
            ? AGENT_STATUS.waiting
            : running.length
              ? AGENT_STATUS.active
              : AGENT_STATUS.idle;

          return (
            <div
              key={agent.name}
              className="bo-node absolute"
              style={{
                left: `${point.x}%`,
                top: `${point.y}%`,
                width: `${NODE_SIZE}%`,
                height: `${NODE_SIZE}%`,
                transform: `translate(-50%, -50%) rotate(${-rotation}deg)`,
              }}
            >
              {needsAttention && (
                <>
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -inset-[10%] rounded-full ring-1 ring-warning/30"
                  />
                  <span
                    aria-hidden
                    className="bo-ripple pointer-events-none absolute -inset-[10%] rounded-full ring-1 ring-warning/45"
                  />
                </>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    data-agent={agent.name}
                    aria-pressed={isSelected}
                    onClick={() => onSelect(agent.name)}
                    ref={(el) => {
                      registerNode(agent.name, el);
                    }}
                    aria-label={`Agent ${agent.name} · ${waiting.length} à valider · ${running.length} en cours${isSelected ? ' · file ouverte' : ''}`}
                    className={cn(
                      'bo-hit relative flex size-full cursor-pointer items-center justify-center rounded-full border bg-card transition-colors duration-100 hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                      isSelected && 'border-primary/45 text-foreground ring-1 ring-primary/25',
                      !isSelected && needsAttention && 'border-warning/60 text-warning-ink',
                      !isSelected && !needsAttention && 'border-border text-muted-foreground'
                    )}
                  >
                    {/* L'icône identifie l'agent ; le clamp la borne quand le
                        canvas se resserre sur mobile. */}
                    <span
                      className="flex aspect-square items-center justify-center [&>svg]:size-full"
                      style={{ width: 'clamp(14px, 32%, 22px)' }}
                    >
                      {agent.icon}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-[16rem] p-0">
                  <AgentTooltip
                    agent={agent}
                    waiting={waiting}
                    running={running}
                    isSelected={isSelected}
                  />
                </TooltipContent>
              </Tooltip>
              <span className="absolute inset-x-0 top-full mt-2 flex flex-col items-center gap-0.5 leading-tight">
                <span className="text-xs font-medium whitespace-nowrap text-foreground">
                  {agent.name}
                </span>
                <span
                  className={cn(
                    'text-xs whitespace-nowrap tabular-nums',
                    waiting.length ? 'font-medium text-warning-ink' : 'text-muted-foreground'
                  )}
                >
                  {waiting.length
                    ? `${waiting.length} à valider`
                    : running.length
                      ? `${running.length} en cours`
                      : status.label.toLowerCase()}
                </span>
              </span>
            </div>
          );
        })}
      </div>

      {/* Le noyau reste au centre, donc hors de l'anneau qui pivote. */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="absolute inset-0 m-auto flex cursor-default items-center justify-center rounded-full bg-primary text-primary-foreground"
            style={{ width: `${CORE_SIZE}%`, height: `${CORE_SIZE}%` }}
          >
            <svg viewBox={MARK_VIEWBOX} className="size-1/2" fill="none" aria-hidden>
              <path
                d={MARK_PATH}
                stroke="currentColor"
                strokeWidth={STROKE_WIDTH}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </TooltipTrigger>
        <TooltipContent>Noyau Baitly · {totalTasks} tâches orchestrées aujourd'hui</TooltipContent>
      </Tooltip>
    </div>
  );
}

/** Nombre de lignes montrées dans l'infobulle avant de renvoyer vers la file. */
const TOOLTIP_MAX_ITEMS = 3;

/**
 * Infobulle enrichie : identité de l'agent, puis un aperçu BORNÉ de ce qu'il a
 * en attente et de ce qu'il exécute. Au-delà de trois lignes on ne déroule pas,
 * on invite à ouvrir la file — une infobulle qui déborde n'est plus une
 * infobulle.
 */
function AgentTooltip({
  agent,
  waiting,
  running,
  isSelected,
}: {
  agent: AgentNode;
  waiting: PendingItem[];
  running: RunningItem[];
  isSelected: boolean;
}) {
  const rows = [
    ...waiting.map((item) => ({
      key: item.id,
      label: item.title,
      hint: formatRemaining(item.expiresInMin),
      pending: true,
    })),
    ...running.map((item) => ({
      key: item.label,
      label: item.label,
      hint: 'en cours',
      pending: false,
    })),
  ];
  const shown = rows.slice(0, TOOLTIP_MAX_ITEMS);
  const rest = rows.length - shown.length;

  return (
    <div className="flex flex-col gap-2 px-3 py-2.5">
      <div>
        <p className="m-0 text-xs font-medium">Agent {agent.name}</p>
        <p className="m-0 text-xs opacity-70">{agent.role}</p>
      </div>

      {rows.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {shown.map((row) => (
            <li key={row.key} className="flex items-start gap-1.5 text-xs">
              <span
                aria-hidden
                className={cn(
                  'mt-1 size-1.5 shrink-0 rounded-[2px]',
                  row.pending ? 'bg-warning' : 'bg-current opacity-50'
                )}
              />
              <span className="min-w-0 flex-1">{row.label}</span>
              <span className="shrink-0 tabular-nums opacity-70">{row.hint}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="m-0 flex items-center gap-1 text-xs opacity-70">
        {isSelected ? (
          'File ouverte à droite'
        ) : (
          <>
            <MousePointerClickIcon className="size-3" />
            {rest > 0
              ? `Cliquer pour voir ${rest} autre${rest > 1 ? 's' : ''}`
              : 'Cliquer pour ouvrir la file'}
          </>
        )}
      </p>
    </div>
  );
}

interface Tether {
  name: string;
  urgent: boolean;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Mesure les traits qui relient l'agent sélectionné à chacune de ses
 * propositions. Les coordonnées ne sont calculables qu'après layout (les deux
 * extrémités vivent dans des colonnes distinctes) : on lit les rects et on
 * redessine sur resize. Quand les colonnes s'empilent (mobile), aucun trait
 * n'est tracé.
 */
function useTethers(enabled: boolean, selected: string, revision: string | number) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const nodeEls = useRef<Record<string, HTMLElement | null>>({});
  const cardEls = useRef<Record<string, HTMLElement | null>>({});
  const [tethers, setTethers] = useState<Tether[]>([]);

  const registerNode = useCallback((name: string, el: HTMLElement | null) => {
    nodeEls.current[name] = el;
  }, []);
  const registerCard = useCallback((name: string, el: HTMLElement | null) => {
    cardEls.current[name] = el;
  }, []);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!enabled || !wrap) {
      setTethers((prev) => (prev.length ? [] : prev));
      return;
    }

    const measure = () => {
      const base = wrap.getBoundingClientRect();
      const node = nodeEls.current[selected];
      const next: Tether[] = [];
      if (!node) {
        setTethers((prev) => (prev.length ? [] : prev));
        return;
      }
      const n = node.getBoundingClientRect();
      for (const item of waitingFor(selected, {})) {
        const card = cardEls.current[item.id];
        if (!card) continue;
        const c = card.getBoundingClientRect();
        // Carte franchement à droite (LTR) ou à gauche (RTL) du nœud ; sinon les
        // colonnes sont empilées et un trait n'aurait aucun sens.
        const toRight = c.left >= n.right;
        const toLeft = c.right <= n.left;
        if (!toRight && !toLeft) continue;
        next.push({
          name: item.id,
          urgent: item.expiresInMin < 60,
          x1: Math.round((toRight ? n.right : n.left) - base.left),
          y1: Math.round(n.top + n.height / 2 - base.top),
          x2: Math.round((toRight ? c.left : c.right) - base.left),
          y2: Math.round(c.top + 22 - base.top),
        });
      }
      setTethers((prev) =>
        JSON.stringify(prev) === JSON.stringify(next) ? prev : next
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    for (const el of Object.values(cardEls.current)) {
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [enabled, selected, revision]);

  return { wrapRef, registerNode, registerCard, tethers };
}

function TetherOverlay({ tethers }: { tethers: Tether[] }) {
  if (tethers.length === 0) return null;
  return (
    <svg className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden>
      {tethers.map((tether) => {
        const bend = (tether.x2 - tether.x1) * 0.45;
        const path = `M${tether.x1} ${tether.y1} C${tether.x1 + bend} ${tether.y1}, ${tether.x2 - bend} ${tether.y2}, ${tether.x2} ${tether.y2}`;
        return (
          <g
            key={tether.name}
            className={cn('bo-tether', tether.urgent ? 'stroke-warning/70' : 'stroke-border')}
            data-agent={tether.name}
          >
            <path fill="none" strokeWidth="1" d={path} />
            {/* Deuxième jambe du relais : le paquet arrivé de l'orchestrateur
                repart le long des attaches vers TOUTES les cartes ensemble —
                il ne revient pas au noyau. `pathLength=100` cale son dash sur
                le même cycle que la jambe radiale. */}
            <path
              fill="none"
              pathLength={100}
              strokeWidth="1.5"
              className="bo-packet bo-packet-hop stroke-primary"
              d={path}
            />
            <circle
              cx={tether.x2}
              cy={tether.y2}
              r="2"
              strokeWidth="0"
              className={tether.urgent ? 'fill-warning/70' : 'fill-border'}
            />
          </g>
        );
      })}
    </svg>
  );
}

// ─── Propositions à valider ──────────────────────────────────────────────────

/**
 * Bloc de proposition. Il porte une surface (`bg-card`) parce qu'on agit
 * dessus : dans cette section, une surface signale une action possible. Les
 * actions secondaires n'apparaissent qu'au survol ou au focus clavier ;
 * l'action principale reste toujours visible.
 */function ProposalBlock({
  item,
  onDecide,
}: {
  item: PendingItem;
  onDecide: (id: string, decision: string) => void;
}) {
  const [primary, secondary, dismiss] = item.actions;
  // Sous l'heure, l'échéance devient l'information la plus urgente du bloc.
  const urgent = item.expiresInMin < 60;
  return (
    <article className="group/proposal rounded-md bg-card p-3.5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span
          className={cn('size-1.5 rounded-[2px]', urgent ? 'bg-warning' : 'bg-muted-foreground/30')}
          aria-hidden
        />
        <span className="font-medium text-foreground">Agent {item.agent}</span>
        <span className={cn('tabular-nums', urgent && 'text-warning-ink')}>
          expire dans {formatRemaining(item.expiresInMin)}
        </span>
      </div>

      <h3 className="m-0 mt-2 text-sm font-medium text-foreground [text-wrap:balance]">
        {item.title}
      </h3>
      <p className="m-0 mt-1 max-w-[60ch] text-xs text-muted-foreground">{item.motif}</p>
      {item.extra}

      <div className="mt-3 flex items-center gap-1">
        <Button size="sm" onClick={() => onDecide(item.id, primary.done)}>
          {primary.icon} {primary.label}
        </Button>
        {/* Secondaires révélées au survol ou au focus clavier, à la manière des
            contrôles de gouttière Notion. L'action principale, elle, reste
            toujours visible : masquer une action primaire serait un piège.
            Sur un pointeur sans survol (tactile), elles restent visibles en
            permanence — sinon elles seraient tout simplement inatteignables. */}
        <div className="flex items-center gap-1 opacity-0 transition-opacity duration-150 group-focus-within/proposal:opacity-100 group-hover/proposal:opacity-100 [@media(hover:none)]:opacity-100">
          {[secondary, dismiss].map((action) => (
            <Button
              key={action.label}
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => onDecide(item.id, action.done)}
            >
              {action.icon} {action.label}
            </Button>
          ))}
        </div>
      </div>
    </article>
  );
}

/**
 * File de l'agent sélectionné. `registerCard` n'est fourni que par la vue
 * constellation, qui a besoin d'ancrer les traits de rattachement.
 */
function ProposalQueue({
  agent,
  decided,
  onDecide,
  registerCard,
}: {
  agent: string;
  decided: Record<string, string>;
  onDecide: (id: string, decision: string) => void;
  registerCard?: (id: string, el: HTMLElement | null) => void;
}) {
  const waiting = waitingFor(agent, decided);
  const running = runningFor(agent);
  const trace = PENDING.filter((item) => item.agent === agent && decided[item.id]);

  return (
    <section className="flex flex-col gap-2">
      <SectionLabel>
        À valider · {agent} · {waiting.length}
      </SectionLabel>

      {waiting.map((item) => (
        <div
          key={item.id}
          ref={(el) => {
            registerCard?.(item.id, el);
          }}
        >
          <ProposalBlock item={item} onDecide={onDecide} />
        </div>
      ))}

      {waiting.length === 0 && (
        <p className="m-0 px-1 py-2 text-xs text-muted-foreground">
          Rien à valider pour cet agent. Il continue en autonomie.
        </p>
      )}

      {trace.map((item) => (
        <p
          key={item.id}
          className="m-0 flex items-center gap-2 px-1 py-1.5 text-xs text-muted-foreground"
        >
          <CheckIcon className="size-3.5 shrink-0" /> {item.title} : {decided[item.id]}
        </p>
      ))}

      {running.length > 0 && (
        <div className="mt-1 flex flex-col gap-1.5">
          <SectionLabel>En cours</SectionLabel>
          <ul className="m-0 list-none p-0">
            {running.map((item) => (
              <li
                key={item.label}
                className="flex items-center gap-2 border-t border-border px-1 py-2 text-xs text-muted-foreground first:border-t-0"
              >
                <span className="size-1.5 shrink-0 rounded-[2px] bg-foreground/40" aria-hidden />
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/**
 * Étiquette de nature d'un événement. On n'étiquette que l'EXCEPTION — la
 * validation attendue et l'incident sortent du gris (ambre) ; les natures
 * informatives (garde-fou, apprentissage, différé) restent muettes en couleur
 * mais nomment ce qui s'est passé. L'exécution autonome ordinaire n'a aucune
 * étiquette : c'est la norme.
 */
interface FeedTag {
  label: string;
  warn?: boolean;
}

interface FeedEvent {
  agent: string;
  icon: React.ReactNode;
  text: string;
  time: string;
  tag?: FeedTag;
}

const HITL_TAG: FeedTag = { label: 'validation requise', warn: true };
const INCIDENT_TAG: FeedTag = { label: 'incident', warn: true };
const GUARDRAIL_TAG: FeedTag = { label: 'garde-fou' };
const LEARNED_TAG: FeedTag = { label: 'règle apprise' };
const DEFERRED_TAG: FeedTag = { label: 'différé' };

const FEED: FeedEvent[] = [
  { agent: 'Messaging', icon: <MessageSquareIcon />, text: 'Réponse envoyée à Amina Benali (heure d\'arrivée, lit bébé).', time: 'il y a 2 min' },
  { agent: 'Revenue', icon: <TrendingUpIcon />, text: 'Baisse de 12 % proposée sur 9 nuits (Riad Yasmine).', tag: HITL_TAG, time: 'il y a 4 min' },
  { agent: 'Finance', icon: <BanknoteIcon />, text: 'Lien de paiement encaissé — solde de RES-1038 soldé (312 €).', time: 'il y a 9 min' },
  { agent: 'Guest', icon: <ConciergeBellIcon />, text: 'Upsell transfert aéroport accepté par Léa Martin (35 €).', time: 'il y a 14 min' },
  { agent: 'Ops', icon: <WrenchIcon />, text: 'Intervention ménage créée après l\'annulation de RES-1039 (Villa Palmeraie).', time: 'il y a 18 min' },
  { agent: 'Sync', icon: <CalendarSyncIcon />, text: '3 calendriers réconciliés (Airbnb, Booking), aucun écart.', time: 'il y a 25 min' },
  { agent: 'Compliance', icon: <ShieldCheckIcon />, text: 'Fiche police télédéclarée pour l\'arrivée d\'Amina Benali.', time: 'il y a 31 min' },
  { agent: 'Ops', icon: <WrenchIcon />, text: 'Serrure Nuki verrouillée à distance après le départ de RES-1040.', time: 'il y a 37 min' },
  { agent: 'Ops', icon: <WrenchIcon />, text: 'Preuve photo reçue de Youssef Amrani — ménage RES-1040 conforme (8/8).', time: 'il y a 42 min' },
  { agent: 'Sync', icon: <CalendarSyncIcon />, text: 'Flux iCal Vrbo injoignable — nouvelle tentative dans 20 min.', tag: INCIDENT_TAG, time: 'il y a 55 min' },
  { agent: 'Revenue', icon: <TrendingUpIcon />, text: 'Hausse de 22 % retenue par le plafond de gamme — non appliquée.', tag: GUARDRAIL_TAG, time: 'il y a 1 h' },
  { agent: 'Revenue', icon: <TrendingUpIcon />, text: '+8 % appliqué sur les week-ends de septembre (occupation > 85 %).', time: 'il y a 1 h' },
  { agent: 'Sync', icon: <CalendarSyncIcon />, text: 'Webhook Channex en échec ×3 — bascule temporaire sur le polling.', tag: INCIDENT_TAG, time: 'il y a 1 h' },
  { agent: 'Finance', icon: <BanknoteIcon />, text: 'Crédits IA : 82 % du budget mensuel consommé — plafond inchangé.', tag: GUARDRAIL_TAG, time: 'il y a 2 h' },
  { agent: 'Guest', icon: <ConciergeBellIcon />, text: 'Livret d\'accueil consulté par Amina Benali (12 pages vues).', time: 'il y a 3 h' },
  { agent: 'Messaging', icon: <MessageSquareIcon />, text: '3 réponses mises en file — envoi à 8 h (heures calmes du guest).', tag: DEFERRED_TAG, time: 'hier, 23 h 12' },
  { agent: 'Finance', icon: <BanknoteIcon />, text: 'Pré-autorisation de caution renouvelée sur RES-1046 (600 €).', time: 'hier' },
  { agent: 'Revenue', icon: <TrendingUpIcon />, text: 'Vous approuvez toujours les baisses < 5 % : l\'agent proposera l\'auto-application.', tag: LEARNED_TAG, time: 'hier' },
  { agent: 'Messaging', icon: <MessageSquareIcon />, text: 'Avis 5★ de Fatima Zahra remercié automatiquement sur Booking.', time: 'hier' },
  { agent: 'Growth', icon: <MegaphoneIcon />, text: 'Annonce Booking mise à jour — 4 nouvelles photos poussées.', time: 'hier' },
  { agent: 'Owner', icon: <HandshakeIcon />, text: 'Relevé de juin consulté par M. Alaoui sur le portail.', time: 'hier' },
  { agent: 'Compliance', icon: <ShieldCheckIcon />, text: 'Registre de taxe de séjour mis à jour — 6 nuitées ajoutées.', time: 'hier' },
  { agent: 'Compliance', icon: <ShieldCheckIcon />, text: 'Export RGPD généré pour John Smith (34 documents).', time: 'hier' },
];

/**
 * Lecture seule : pas de surface, pas de frise chronologique décorative. Des
 * lignes séparées par des filets. On n'étiquette que l'exception (« validation
 * requise ») — l'exécution autonome est la norme et n'a pas à être signalée.
 */
function ActivityFeed() {
  return (
    <section className="flex flex-col gap-2">
      <SectionLabel>Activité</SectionLabel>
      {/* Plafond de largeur : en pleine largeur, l'horodatage finirait à 1 400 px
          du texte qu'il date. Sans effet quand le feed est déjà en colonne. */}
      <ul className="m-0 max-w-5xl list-none p-0">
        {FEED.map((event, index) => (
          <li
            key={index}
            className="flex items-start gap-3 border-t border-border px-2 py-2.5 transition-colors duration-100 first:border-t-0 hover:bg-muted/60"
          >
            <span className="mt-px text-muted-foreground [&>svg]:size-3.5">{event.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="m-0 max-w-[75ch] text-xs text-foreground">{event.text}</p>
              <p className="m-0 mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                Agent {event.agent}
                {event.tag && (
                  <span className={event.tag.warn ? 'text-warning-ink' : 'text-muted-foreground/80'}>
                    {event.tag.label}
                  </span>
                )}
              </p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">{event.time}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ─── Section complète ────────────────────────────────────────────────────────
// ─── Section complète ────────────────────────────────────────────────────────

/** Durée de la rotation de l'anneau, alignée sur `.bo-ring` dans ORBIT_STYLES. */
const ROTATION_MS = 720;

export function BAgentsConstellationSectionDemo() {
  const [decided, setDecided] = useState<Record<string, string>>({});
  const [view, setView] = useState<'cards' | 'orbit'>('cards');
  const [autoMap, setAutoMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(AGENTS.map((agent) => [agent.name, agent.auto]))
  );

  const [selected, setSelected] = useState(() => busiestAgent({}));
  const initialRotation = rotationFor(
    AGENTS.findIndex((agent) => agent.name === busiestAgent({})),
    AGENTS.length
  );
  const [rotation, setRotation] = useState(initialRotation);
  const rotationRef = useRef(initialRotation);
  const [rotating, setRotating] = useState(false);

  const pending = AGENTS.reduce((sum, agent) => sum + waitingFor(agent.name, decided).length, 0);

  /**
   * On ne recale pas chaque nœud : on fait pivoter l'anneau entier pour amener
   * l'agent choisi sur l'emplacement de tête. L'angle cible est « déroulé »
   * autour de l'angle courant afin que la rotation prenne toujours le chemin le
   * plus court — sans ça, passer de 225° à −45° partirait faire trois quarts de
   * tour à l'envers.
   */
  const selectAgent = (name: string) => {
    if (name === selected) return;
    const index = AGENTS.findIndex((agent) => agent.name === name);
    let target = rotationFor(index, AGENTS.length);
    while (target - rotationRef.current > 180) target -= 360;
    while (target - rotationRef.current < -180) target += 360;
    rotationRef.current = target;
    setRotation(target);
    setSelected(name);
    setRotating(true);
  };

  // Les traits de rattachement sont mesurés en pixels : pendant la rotation ils
  // pointeraient vers une position périmée. On les retire, puis on remesure.
  useLayoutEffect(() => {
    if (!rotating) return;
    const timer = window.setTimeout(() => setRotating(false), ROTATION_MS + 40);
    return () => window.clearTimeout(timer);
  }, [rotating]);

  const { wrapRef, registerNode, registerCard, tethers } = useTethers(
    view === 'orbit' && !rotating,
    selected,
    `${selected}:${Object.keys(decided).length}`
  );

  const decide = (id: string, decision: string) =>
    setDecided((prev) => ({ ...prev, [id]: decision }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Constellation d'agents"
        subtitle={`${AGENTS.length} agents · ${AGENTS.reduce((sum, agent) => sum + agent.tasksToday, 0)} tâches aujourd'hui`}
        iconBadge={<BotIcon />}
        titleAdornment={
          pending > 0 ? (
            // text-warning-ink : la variante `warning` du Badge écrit en
            // --bui-warning, illisible sur fond clair (2,17:1).
            <Badge variant="warning" className="text-warning-ink">
              {pending} à valider
            </Badge>
          ) : (
            <Badge variant="secondary">À jour</Badge>
          )
        }
        showBackButton={false}
        className="mb-0"
        actions={
          <>
            {/* Segmenté sur rail teinté : le segment actif remonte en surface,
                convention partagée par Notion, Linear et macOS. */}
            <ToggleGroup
              type="single"
              variant="default"
              size="sm"
              spacing={0}
              value={view}
              onValueChange={(next) => next && setView(next as 'cards' | 'orbit')}
              className="rounded-md bg-muted p-0.5"
            >
              <ToggleGroupItem
                value="cards"
                aria-label="Vue cartes"
                title="Vue cartes"
                className="data-[state=on]:bg-card"
              >
                <LayoutGridIcon />
              </ToggleGroupItem>
              <ToggleGroupItem
                value="orbit"
                aria-label="Vue constellation"
                title="Vue constellation"
                className="data-[state=on]:bg-card"
              >
                <OrbitIcon />
              </ToggleGroupItem>
            </ToggleGroup>
            <Button size="sm" variant="ghost" className="text-muted-foreground">
              <SlidersHorizontalIcon /> Règles d'autonomie
            </Button>
          </>
        }
      />

      {view === 'cards' ? (
        <div key="cards" className="bo-view flex flex-col gap-6">
          <section className="flex flex-col gap-2">
            <SectionLabel>Agents</SectionLabel>
            {/* 6 agents : 3 colonnes en xl (2 rangées pleines), 2 en sm. */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {AGENTS.map((agent) => (
                <AgentCard
                  key={agent.name}
                  agent={agent}
                  auto={autoMap[agent.name]}
                  onAutoChange={(auto) => setAutoMap((prev) => ({ ...prev, [agent.name]: auto }))}
                  waiting={waitingFor(agent.name, decided).length}
                  running={runningFor(agent.name).length}
                />
              ))}
            </div>
          </section>
          <div className="grid grid-cols-1 items-start gap-x-8 gap-y-6 lg:grid-cols-[1.1fr_1fr]">
            <ProposalQueue agent={selected} decided={decided} onDecide={decide} />
            <ActivityFeed />
          </div>
        </div>
      ) : (
        <div key="orbit" className="bo-view flex flex-col gap-6">
          <div
            ref={wrapRef}
            className="bo-wrap relative grid grid-cols-1 items-start gap-x-8 gap-y-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,1fr)]"
          >
            <div className="flex flex-col gap-3">
              <AgentOrbit
                selected={selected}
                onSelect={selectAgent}
                rotation={rotation}
                flowActive={!rotating}
                decided={decided}
                registerNode={registerNode}
              />
              <p className="m-0 max-w-[52ch] text-xs text-muted-foreground">
                Cliquez un agent : il rejoint le haut du diagramme et le flux de données circule
                du noyau vers lui, puis se relaie vers toutes ses propositions ; survolez-le pour
                un aperçu. Les propositions sont triées par échéance.
              </p>
            </div>
            <ProposalQueue
              agent={selected}
              decided={decided}
              onDecide={decide}
              registerCard={registerCard}
            />
            <TetherOverlay tethers={tethers} />
          </div>
          <ActivityFeed />
        </div>
      )}
    </div>
  );
}
