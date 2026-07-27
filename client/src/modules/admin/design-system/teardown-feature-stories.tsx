import {
  BanknoteIcon,
  BedDoubleIcon,
  BrushCleaningIcon,
  CalendarDaysIcon,
  CameraIcon,
  ClockIcon,
  DoorOpenIcon,
  FileCheck2Icon,
  GlobeIcon,
  KeyRoundIcon,
  LockIcon,
  PlugZapIcon,
  ReceiptTextIcon,
  RefreshCwIcon,
  ScaleIcon,
  ShieldCheckIcon,
  TimerIcon,
  TriangleAlertIcon,
  UsersIcon,
  VolumeXIcon,
} from 'lucide-react';
import { Badge, Button } from '../../../components/ui';
import MockupSlot from '../../../components/baitly/MockupSlot';
import {
  StoryBand,
  StoryFlow,
  StoryFooterCta,
  StoryHero,
  StoryNote,
  StoryPage,
  StoryPoints,
  StorySection,
  StorySeparator,
  StoryZones,
} from '../../../components/baitly/FeatureStory';

/**
 * États vides « format long » des modules dont l'enjeu n'est pas évident à
 * l'arrivée : synchronisation des canaux, distribution, conformité des factures,
 * rotation du ménage, accès sans clé.
 *
 * Les écrans dont la promesse tient en une phrase (Tableau de bord, Voyageurs,
 * Notifications, Documents) gardent volontairement le `ShowcaseEmpty` court —
 * une page longue sur un écran limpide est du bruit.
 *
 * Les schémas décrivent des mécanismes **réels** du produit (CalendarEngine et
 * sa convention « absence de ligne = disponible », channel manager Channex,
 * moteur ménage et sa preuve photo, serrures Nuki/KeyNest). Aucun chiffre de
 * performance n'est avancé nulle part.
 */

// ═══ 1. Planning ════════════════════════════════════════════════════════════

type NightState = 'free' | 'booked' | 'clash' | 'closed';

const NIGHT_CLASSES: Record<NightState, string> = {
  free: 'bg-muted',
  booked: 'bg-primary',
  clash: 'bg-destructive',
  closed: 'bg-foreground/25',
};

/** Bande de nuits : la brique de tous les schémas de calendrier. */
function NightsStrip({ nights, label }: { nights: NightState[]; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 truncate text-xs text-muted-foreground">{label}</span>
      <div className="flex min-w-0 flex-1 gap-1">
        {nights.map((night, index) => (
          <div key={index} className={`h-5 flex-1 rounded-sm ${NIGHT_CLASSES[night]}`} />
        ))}
      </div>
    </div>
  );
}

/**
 * Le double-booking en une image : trois canaux qui ne se parlent pas finissent
 * par vendre la même nuit deux fois.
 */
function DoubleBookingSchema() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-card p-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-destructive">
          <TriangleAlertIcon className="size-3.5" />
          Trois calendriers séparés
        </div>
        <NightsStrip label="Airbnb" nights={['free', 'free', 'booked', 'booked', 'clash', 'free', 'free']} />
        <NightsStrip label="Booking" nights={['free', 'free', 'free', 'free', 'clash', 'booked', 'free']} />
        <NightsStrip label="Direct" nights={['free', 'free', 'free', 'free', 'free', 'free', 'free']} />
        <p className="m-0 mt-1 text-xs text-muted-foreground">
          La nuit du milieu est vendue deux fois. Personne ne l’a vu.
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-primary/40 bg-card p-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-primary">
          <CalendarDaysIcon className="size-3.5" />
          Un calendrier, source de vérité
        </div>
        <NightsStrip label="Baitly" nights={['free', 'free', 'booked', 'booked', 'closed', 'closed', 'free']} />
        <NightsStrip label="Airbnb" nights={['free', 'free', 'booked', 'booked', 'closed', 'closed', 'free']} />
        <NightsStrip label="Booking" nights={['free', 'free', 'booked', 'booked', 'closed', 'closed', 'free']} />
        <p className="m-0 mt-1 text-xs text-muted-foreground">
          Une réservation ferme la nuit partout, dans la foulée.
        </p>
      </div>
    </div>
  );
}

export function BPlanningStoryDemo() {
  return (
    <StoryPage>
      <StoryHero
        eyebrow={{ icon: <CalendarDaysIcon />, label: 'Planning' }}
        title="Une nuit vendue deux fois coûte plus cher qu’une nuit vide."
        lede="Un logement présent sur trois canaux, ce sont trois calendriers qui ne se parlent pas. Baitly en tient un seul, fait autorité, et le répercute partout à chaque mouvement."
        actions={
          <>
            <Button size="lg">Connecter un canal</Button>
            <Button size="lg" variant="ghost">
              Saisir une réservation directe
            </Button>
          </>
        }
        note="Un logement suffit pour ouvrir le planning ; la synchronisation démarre au premier canal connecté."
        aside={
          <MockupSlot
            brief="Deux réservations arrivent de canaux différents sur la même nuit : dans la première moitié elles se percutent (rouge), dans la seconde la nuit se ferme instantanément sur les autres canaux. La collision doit se voir sans lire."
            poster={<DoubleBookingSchema />}
          />
        }
      />

      <StorySection
        title="Pourquoi le problème est structurel"
        lede="Chaque canal garde sa propre copie du calendrier. Sans arbitre, deux voyageurs peuvent réserver la même nuit à quelques secondes d’intervalle, sur deux plateformes qui s’ignorent."
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center">
          <div className="rounded-xl border border-border bg-card p-5">
            <DoubleBookingSchema />
          </div>
          <StoryZones
            items={[
              {
                tag: 'Le coût d’une nuit vide',
                text: 'Le manque à gagner d’une nuit, et rien d’autre. Désagréable, mais borné.',
              },
              {
                tag: 'Le coût d’un double-booking',
                text: 'Un relogement à votre charge, une annulation imputée à votre compte, et un classement qui baisse sur le canal. C’est sans commune mesure.',
                highlight: true,
              },
              {
                tag: 'Pourquoi l’iCal seul ne suffit pas',
                text: 'Un lien iCal se relit à intervalle régulier. Entre deux relectures, la fenêtre de collision reste ouverte.',
              },
            ]}
          />
        </div>
      </StorySection>

      <StorySeparator />

      <StorySection
        title="Ce qui se passe quand une réservation arrive"
        lede="La disponibilité n’est jamais recalculée après coup : elle est décidée une fois, au centre, puis diffusée."
      >
        <StoryFlow
          steps={[
            { label: 'Réception', text: 'la réservation entre par son canal' },
            { label: 'Fermeture', text: 'les nuits passent en occupé dans le calendrier central' },
            { label: 'File de sortie', text: 'un ordre de mise à jour est enregistré par canal' },
            { label: 'Diffusion', text: 'chaque canal reçoit la fermeture' },
          ]}
        />
        <StoryNote>
          Les ordres de diffusion sont enregistrés avant d’être envoyés : si un canal est
          momentanément injoignable, la mise à jour est rejouée plutôt que perdue.
        </StoryNote>
      </StorySection>

      <StorySeparator />

      <StorySection title="Ce que le planning gère aussi">
        <StoryPoints
          items={[
            {
              icon: <GlobeIcon />,
              title: 'Le fuseau du logement',
              text: 'Une nuit est datée dans le fuseau de la propriété, jamais celui du serveur : c’est ce qui évite les décalages d’un jour.',
            },
            {
              icon: <LockIcon />,
              title: 'Les blocages manuels',
              text: 'Travaux, séjour personnel, coupure : une fermeture peut exiger un motif, pour être relue plus tard.',
            },
            {
              icon: <BedDoubleIcon />,
              title: 'Le multi-logements',
              text: 'Tous les biens sur une même grille, avec le prix de la nuit sous chaque case.',
            },
            {
              icon: <RefreshCwIcon />,
              title: 'La reprise de l’existant',
              text: 'Les réservations déjà en cours sont importées avant la première synchronisation, pour ne pas ouvrir des nuits déjà vendues.',
            },
          ]}
        />
      </StorySection>

      <StorySeparator />

      <StoryBand
        eyebrow={{ icon: <ShieldCheckIcon />, label: 'Source de vérité' }}
        title="Une seule autorité sur la disponibilité"
        lede="Le calendrier central décide, les canaux suivent. Aucun canal ne peut ouvrir une nuit que Baitly a fermée — c’est ce qui rend le double-booking structurellement impossible plutôt que simplement improbable."
        guarantees={[
          'Chaque fermeture est horodatée et attribuée',
          'Une mise à jour non délivrée est rejouée, pas abandonnée',
          'Les dates sont calculées dans le fuseau du logement',
        ]}
      />

      <StoryFooterCta
        icon={<CalendarDaysIcon />}
        title="Commencer par un canal"
        text="Le premier canal connecté suffit à faire vivre le planning ; les suivants s’ajoutent sans reprise."
        actions={
          <>
            <Button>Connecter un canal</Button>
            <Button variant="outline">Importer un lien iCal</Button>
          </>
        }
      />
    </StoryPage>
  );
}

// ═══ 2. Canaux / distribution ═══════════════════════════════════════════════

/** Ce qui circule, et dans quel sens, selon le mode de connexion. */
function ChannelFlowSchema() {
  const modes = [
    {
      name: 'Lien iCal',
      tone: 'muted' as const,
      direction: 'Baitly ← canal',
      cadence: 'relu périodiquement',
      payload: ['Disponibilités'],
      missing: ['Tarifs', 'Restrictions', 'Contenu'],
    },
    {
      name: 'Channel manager',
      tone: 'primary' as const,
      direction: 'Baitly ↔ canal',
      cadence: 'en continu',
      payload: ['Disponibilités', 'Tarifs', 'Restrictions', 'Contenu'],
      missing: [],
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      {modes.map((mode) => (
        <div
          key={mode.name}
          className={`rounded-lg border p-3 ${
            mode.tone === 'primary' ? 'border-primary/40 bg-primary-soft' : 'border-border bg-card'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-foreground">{mode.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{mode.cadence}</span>
          </div>
          <div className="mt-1 font-mono text-xs text-muted-foreground">{mode.direction}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {mode.payload.map((item) => (
              <Badge key={item} variant={mode.tone === 'primary' ? 'default' : 'secondary'}>
                {item}
              </Badge>
            ))}
            {mode.missing.map((item) => (
              <Badge key={item} variant="outline" className="opacity-50 line-through">
                {item}
              </Badge>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function BChannelsStoryDemo() {
  return (
    <StoryPage>
      <StoryHero
        eyebrow={{ icon: <PlugZapIcon />, label: 'Distribution' }}
        title="Connecter un canal, ce n’est pas juste partager un calendrier."
        lede="Un lien iCal transporte des dates, et s’arrête là. Un channel manager transporte aussi les tarifs, les durées minimales et les restrictions — dans les deux sens, en continu."
        actions={
          <>
            <Button size="lg">Connecter un canal</Button>
            <Button size="lg" variant="ghost">
              Comparer les deux modes
            </Button>
          </>
        }
        note="Vos annonces existantes sont reprises telles quelles : aucune ressaisie."
        aside={
          <MockupSlot
            brief="Deux flux animés côte à côte : l'iCal envoie une seule bulle « dates » par à-coups dans un sens ; le channel manager fait circuler quatre bulles (dates, tarifs, restrictions, contenu) dans les deux sens, en continu."
            poster={<ChannelFlowSchema />}
          />
        }
      />

      <StorySection
        title="Ce qui circule, et dans quel sens"
        lede="La différence n’est pas une question de rapidité, mais de nature : l’iCal ne sait pas transporter un prix. Un tarif modifié dans Baitly ne remontera jamais vers un canal relié en iCal."
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
          <div className="rounded-xl border border-border bg-card p-5">
            <ChannelFlowSchema />
          </div>
          <StoryZones
            items={[
              {
                tag: 'L’iCal, pour démarrer',
                text: 'Gratuit, universel, sans validation du canal. Suffisant pour ne pas être doublement réservé, insuffisant pour piloter ses prix.',
              },
              {
                tag: 'Le channel manager, pour exploiter',
                text: 'Tarifs et restrictions partent vers tous les canaux à chaque modification. C’est ce qui rend la tarification dynamique utile.',
                highlight: true,
              },
              {
                tag: 'Les deux cohabitent',
                text: 'Rien n’oblige à tout basculer : un canal secondaire peut rester en iCal pendant que les principaux passent en connexion complète.',
              },
            ]}
          />
        </div>
      </StorySection>

      <StorySeparator />

      <StorySection
        title="Comment se déroule une connexion"
        lede="L’étape qui prend le plus de temps n’est pas technique : c’est l’appariement entre vos annonces existantes et vos logements Baitly."
      >
        <StoryFlow
          steps={[
            { label: 'Vérification', text: 'ce qui manque pour publier est listé avant de commencer' },
            { label: 'Appariement', text: 'chaque annonce existante est reliée à son logement' },
            { label: 'Choix des canaux', text: 'vous décidez lesquels activer, un par un' },
            { label: 'Première synchro', text: 'disponibilités et tarifs partent, puis restent alignés' },
          ]}
        />
      </StorySection>

      <StorySeparator />

      <StorySection title="Ce que la connexion apporte ensuite">
        <StoryPoints
          items={[
            {
              icon: <RefreshCwIcon />,
              title: 'Plus de double saisie',
              text: 'Un équipement ajouté, une photo remplacée, un tarif corrigé : une seule fois, dans Baitly.',
            },
            {
              icon: <ScaleIcon />,
              title: 'Des restrictions homogènes',
              text: 'Durée minimale, arrivée interdite un jour donné, délai de réservation : les mêmes règles partout.',
            },
            {
              icon: <UsersIcon />,
              title: 'Les messages au même endroit',
              text: 'Les conversations des canaux connectés arrivent dans la messagerie unifiée.',
            },
            {
              icon: <BanknoteIcon />,
              title: 'Le mode d’encaissement suivi',
              text: 'Un séjour déjà payé sur le canal est marqué comme tel : Baitly ne le réclame pas une seconde fois.',
            },
          ]}
        />
      </StorySection>

      <StorySeparator />

      <StoryBand
        eyebrow={{ icon: <ShieldCheckIcon />, label: 'Réversibilité' }}
        title="Vous pouvez repartir avec vos données"
        lede="Une connexion se coupe sans détruire l’historique : les réservations importées restent, les annonces d’origine continuent d’exister sur leur canal. Se connecter à Baitly n’est pas un aller simple."
        guarantees={[
          'Déconnexion canal par canal, sans effet sur les autres',
          'Historique des réservations conservé après déconnexion',
          'Export de vos données à tout moment',
        ]}
      />

      <StoryFooterCta
        icon={<PlugZapIcon />}
        title="Commencer par votre canal principal"
        text="C’est celui qui apporte le plus de réservations qui bénéficie le plus de la synchronisation."
        actions={
          <>
            <Button>Connecter un canal</Button>
            <Button variant="outline">Utiliser un lien iCal</Button>
          </>
        }
      />
    </StoryPage>
  );
}

// ═══ 3. Facturation ═════════════════════════════════════════════════════════

/** La chaîne de numérotation : c'est l'absence de trou qui fait la conformité. */
function InvoiceChainSchema() {
  const invoices = [
    { number: 'F-2026-0041', label: 'Séjour du 3 au 7 juin', state: 'issued' as const },
    { number: 'F-2026-0042', label: 'Séjour du 8 au 11 juin', state: 'issued' as const },
    { number: 'F-2026-0043', label: 'Séjour annulé — avoir', state: 'credit' as const },
    { number: 'F-2026-0044', label: 'Prochaine facture', state: 'next' as const },
  ];

  return (
    <div className="flex flex-col gap-2">
      {invoices.map((invoice) => (
        <div
          key={invoice.number}
          className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
            invoice.state === 'next'
              ? 'border-dashed border-primary/40 bg-primary-soft'
              : 'border-border bg-card'
          }`}
        >
          <span className="shrink-0 font-mono text-xs font-semibold text-foreground tabular-nums">
            {invoice.number}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {invoice.label}
          </span>
          {invoice.state === 'credit' && (
            <Badge variant="secondary" className="shrink-0">
              avoir
            </Badge>
          )}
          {invoice.state === 'next' && (
            <Badge variant="outline" className="shrink-0">
              à venir
            </Badge>
          )}
        </div>
      ))}
      <p className="m-0 mt-1 text-xs text-muted-foreground">
        Une facture annulée devient un avoir. Le numéro reste dans la chaîne : il ne peut être ni
        réutilisé, ni supprimé.
      </p>
    </div>
  );
}

export function BBillingStoryDemo() {
  return (
    <StoryPage>
      <StoryHero
        eyebrow={{ icon: <ReceiptTextIcon />, label: 'Facturation' }}
        title="Une facture n’est pas un PDF, c’est une pièce comptable."
        lede="Un numéro qui suit une chaîne sans trou, des mentions obligatoires complètes, la taxe de séjour calculée sur le bon barème. Baitly compose la facture à partir du séjour, au moment où il se termine."
        actions={
          <>
            <Button size="lg">Configurer la facturation</Button>
            <Button size="lg" variant="ghost">
              Voir un exemple de facture
            </Button>
          </>
        }
        note="Il faut renseigner votre entreprise et votre régime fiscal avant d’émettre la première facture."
        aside={
          <MockupSlot
            brief="La chaîne de numérotation se construit ligne par ligne ; une facture est annulée, se transforme en avoir, et le numéro suivant continue la suite sans jamais combler le trou."
            poster={<InvoiceChainSchema />}
          />
        }
      />

      <StorySection
        title="Pourquoi la numérotation est le cœur du sujet"
        lede="C’est le point que les tableurs et les modèles de document ratent systématiquement : un numéro réattribué, une facture effacée, et la séquence ne prouve plus rien."
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
          <div className="rounded-xl border border-border bg-card p-5">
            <InvoiceChainSchema />
          </div>
          <StoryZones
            items={[
              {
                tag: 'Séquentielle',
                text: 'Chaque facture prend le numéro suivant. Aucun saut, aucun doublon, aucune reprise d’un numéro libéré.',
              },
              {
                tag: 'Inaltérable',
                text: 'Une facture émise ne se modifie plus. La corriger, c’est émettre un avoir qui la neutralise — et qui porte, lui aussi, son numéro.',
                highlight: true,
              },
              {
                tag: 'Traçable',
                text: 'Chaque pièce reste rattachée à son séjour, son logement et son mode d’encaissement.',
              },
            ]}
          />
        </div>
        <StoryNote>
          Baitly applique ces règles de construction. La conformité d’un dossier dépend aussi de
          votre régime et de votre pays d’exploitation : les paramètres fiscaux se règlent une fois,
          à la configuration.
        </StoryNote>
      </StorySection>

      <StorySeparator />

      <StorySection
        title="Ce qui déclenche une facture"
        lede="Vous n’avez rien à saisir : le séjour porte déjà tout ce qu’il faut."
      >
        <StoryFlow
          steps={[
            { label: 'Fin de séjour', text: 'le départ est constaté' },
            { label: 'Composition', text: 'nuits, frais, taxe de séjour et TVA sont assemblés' },
            { label: 'Numérotation', text: 'le numéro suivant de la chaîne est attribué' },
            { label: 'Archivage', text: 'le document est figé, daté et rattaché au séjour' },
          ]}
        />
      </StorySection>

      <StorySeparator />

      <StorySection title="Ce qui est pris en charge">
        <StoryPoints
          items={[
            {
              icon: <ScaleIcon />,
              title: 'Taxe de séjour',
              text: 'Barème de la commune, exonérations selon l’âge, reversement retracé dans les rapports.',
            },
            {
              icon: <GlobeIcon />,
              title: 'Multi-devise et langue',
              text: 'La facture est émise dans la devise du séjour et la langue du destinataire.',
            },
            {
              icon: <BanknoteIcon />,
              title: 'Séjours déjà payés',
              text: 'Un séjour encaissé par le canal est facturé comme tel, sans réclamer de paiement.',
            },
            {
              icon: <FileCheck2Icon />,
              title: 'Commissions de gestion',
              text: 'Pour les conciergeries, la facture de commission au propriétaire suit la même chaîne.',
            },
          ]}
        />
      </StorySection>

      <StorySeparator />

      <StoryBand
        eyebrow={{ icon: <ShieldCheckIcon />, label: 'Ce qu’on ne fait pas' }}
        title="Aucune facture ne peut être réécrite après coup"
        lede="C’est une contrainte, et elle est volontaire. Un outil qui laisse modifier une facture émise vous met en difficulté le jour d’un contrôle : la correction passe donc toujours par un avoir, jamais par une réécriture."
        guarantees={[
          'Journal complet des émissions et des avoirs',
          'Numérotation par préfixe et par exercice',
          'Export comptable des pièces sur une période',
        ]}
      />

      <StoryFooterCta
        icon={<ReceiptTextIcon />}
        title="Commencer par le profil fiscal"
        text="Régime, TVA et préfixe de numérotation : une fois réglés, les factures se génèrent seules."
        actions={
          <>
            <Button>Configurer la facturation</Button>
            <Button variant="outline">Importer un historique</Button>
          </>
        }
      />
    </StoryPage>
  );
}

// ═══ 4. Interventions / ménage ══════════════════════════════════════════════

/** La fenêtre de rotation : ce qui reste entre un départ et une arrivée. */
function TurnoverSchema() {
  const rows = [
    {
      label: 'Journée normale',
      checkout: 11,
      checkin: 15,
      tone: 'primary' as const,
      note: 'quatre heures pour la rotation',
    },
    {
      label: 'Départ tardif',
      checkout: 13,
      checkin: 15,
      tone: 'warning' as const,
      note: 'deux heures : l’équipe doit être prévenue',
    },
  ];

  // Échelle 8 h → 20 h sur 100 %.
  const toPercent = (hour: number) => ((hour - 8) / 12) * 100;

  return (
    <div className="flex flex-col gap-4">
      {rows.map((row) => (
        <div key={row.label} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-foreground">{row.label}</span>
            <span className="text-muted-foreground">{row.note}</span>
          </div>
          <div className="relative h-8 rounded-md bg-muted">
            <div
              className={`absolute inset-y-0 rounded-md ${
                row.tone === 'primary' ? 'bg-primary/25' : 'bg-warning/30'
              }`}
              style={{
                insetInlineStart: `${toPercent(row.checkout)}%`,
                width: `${toPercent(row.checkin) - toPercent(row.checkout)}%`,
              }}
            />
            <div
              className="absolute inset-y-0 w-0.5 bg-foreground/50"
              style={{ insetInlineStart: `${toPercent(row.checkout)}%` }}
            />
            <div
              className="absolute inset-y-0 w-0.5 bg-foreground/50"
              style={{ insetInlineStart: `${toPercent(row.checkin)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
            <span>08:00</span>
            <span>départ {row.checkout}:00</span>
            <span>arrivée {row.checkin}:00</span>
            <span>20:00</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function BInterventionsStoryDemo() {
  return (
    <StoryPage>
      <StoryHero
        eyebrow={{ icon: <BrushCleaningIcon />, label: 'Interventions' }}
        title="Tout se joue dans les quatre heures entre un départ et une arrivée."
        lede="Cette fenêtre ne se négocie pas : elle est imposée par les horaires du séjour. Baitly la calcule pour chaque rotation, y place l’intervention et prévient quand elle se referme."
        actions={
          <>
            <Button size="lg">Configurer le ménage</Button>
            <Button size="lg" variant="ghost">
              Inviter un intervenant
            </Button>
          </>
        }
        note="Les interventions se créent à partir des séjours : il faut au moins un logement avec des réservations."
        aside={
          <MockupSlot
            brief="La fenêtre de rotation se dessine entre le départ et l'arrivée, la tâche de ménage vient s'y loger, puis le départ glisse vers 13 h : la fenêtre se comprime et passe en alerte."
            poster={<TurnoverSchema />}
          />
        }
      />

      <StorySection
        title="La fenêtre se calcule, elle ne se devine pas"
        lede="Un départ tardif accordé la veille réduit la rotation de moitié. Si l’intervenant l’apprend en arrivant sur place, la journée est perdue pour tout le monde."
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center">
          <div className="rounded-xl border border-border bg-card p-5">
            <TurnoverSchema />
          </div>
          <StoryZones
            items={[
              {
                tag: 'Sans coordination',
                text: 'L’intervenant découvre sur place que le logement est encore occupé, ou nettoie un bien qui n’a personne le soir même.',
              },
              {
                tag: 'Avec la fenêtre calculée',
                text: 'La rotation est planifiée à partir des horaires réels du séjour, et se replanifie toute seule quand ils changent.',
                highlight: true,
              },
              {
                tag: 'Quand ça ne rentre plus',
                text: 'Une fenêtre trop courte est signalée avant le jour J, pendant qu’il est encore possible de décaler une arrivée.',
              },
            ]}
          />
        </div>
      </StorySection>

      <StorySeparator />

      <StorySection
        title="De la fin de séjour au paiement de l’intervenant"
        lede="La chaîne est continue : personne n’a à ressaisir ce que le séjour sait déjà."
      >
        <StoryFlow
          steps={[
            { label: 'Départ constaté', text: 'l’intervention est créée sur la bonne fenêtre' },
            { label: 'Attribution', text: 'un intervenant disponible est proposé' },
            { label: 'Preuve', text: 'photos de fin de tâche déposées sur place' },
            { label: 'Paiement', text: 'la rémunération se déclenche après validation' },
          ]}
        />
        <StoryNote>
          La rémunération n’est jamais libérée avant la preuve : c’est la contrepartie d’un
          paiement automatique.
        </StoryNote>
      </StorySection>

      <StorySeparator />

      <StorySection title="Ce que l’équipe reçoit">
        <StoryPoints
          items={[
            {
              icon: <TimerIcon />,
              title: 'Une durée estimée',
              text: 'Calculée sur le type de logement et son historique, pas sur une moyenne générale.',
            },
            {
              icon: <BanknoteIcon />,
              title: 'Un tarif conseillé',
              text: 'Dérivé de la durée estimée et du taux horaire convenu, avec une fourchette plutôt qu’un chiffre sec.',
            },
            {
              icon: <UsersIcon />,
              title: 'Un périmètre clair',
              text: 'Chaque intervenant ne voit que ses interventions et les logements qui le concernent.',
            },
            {
              icon: <DoorOpenIcon />,
              title: 'Un accès autonome',
              text: 'Si le logement a une serrure connectée, le code d’accès suit la fenêtre d’intervention.',
            },
          ]}
        />
      </StorySection>

      <StorySeparator />

      <StoryBand
        eyebrow={{ icon: <ShieldCheckIcon />, label: 'Contrepartie' }}
        title="Le paiement automatique suppose une preuve"
        lede="Payer une intervention sans vérification, c’est ouvrir un litige à retardement. Baitly conditionne la libération de la rémunération au dépôt des photos de fin de tâche — l’intervenant y gagne un paiement rapide, vous une trace."
        guarantees={[
          'Photos horodatées, rattachées à l’intervention',
          'Litige possible avant validation, avec l’historique',
          'Barème et fourchette visibles des deux côtés',
        ]}
      />

      <StoryFooterCta
        icon={<BrushCleaningIcon />}
        title="Commencer par une règle de ménage"
        text="Une règle suffit : « à chaque départ, une intervention de ménage sur la fenêtre disponible »."
        actions={
          <>
            <Button>Configurer le ménage</Button>
            <Button variant="outline">Inviter un intervenant</Button>
          </>
        }
      />
    </StoryPage>
  );
}

// ═══ 5. Objets connectés ════════════════════════════════════════════════════

/** Le code d'accès a une durée de vie bornée par le séjour. */
function AccessCodeSchema() {
  const spans = [
    { label: 'Séjour', start: 20, width: 55, tone: 'bg-primary/25 border-primary/40' },
    { label: 'Code valide', start: 17, width: 61, tone: 'bg-success/25 border-success/40' },
  ];

  return (
    <div className="flex flex-col gap-3">
      {spans.map((span) => (
        <div key={span.label} className="flex flex-col gap-1">
          <span className="text-xs font-medium text-foreground">{span.label}</span>
          <div className="relative h-6 rounded-md bg-muted">
            <div
              className={`absolute inset-y-0 rounded-md border ${span.tone}`}
              style={{ insetInlineStart: `${span.start}%`, width: `${span.width}%` }}
            />
          </div>
        </div>
      ))}
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>réservation confirmée</span>
        <span>arrivée</span>
        <span>départ</span>
      </div>
      <p className="m-0 text-xs text-muted-foreground">
        Le code s’ouvre un peu avant l’arrivée et se ferme un peu après le départ. En dehors de
        cette fenêtre, il ne fonctionne pas.
      </p>
    </div>
  );
}

export function BDevicesStoryDemo() {
  return (
    <StoryPage>
      <StoryHero
        eyebrow={{ icon: <KeyRoundIcon />, label: 'Objets connectés' }}
        title="La remise des clés est le seul rendez-vous qu’on ne peut pas déplacer."
        lede="Un vol retardé, et c’est une soirée d’attente. Une serrure connectée transforme ce rendez-vous en un code qui s’ouvre à l’heure d’arrivée et se ferme au départ, sans que personne se déplace."
        actions={
          <>
            <Button size="lg">Ajouter un appareil</Button>
            <Button size="lg" variant="ghost">
              Voir les appareils compatibles
            </Button>
          </>
        }
        note="Un logement et une réservation suffisent : le code se génère à partir du séjour."
        aside={
          <MockupSlot
            brief="La barre du séjour se pose sur la frise, puis la barre de validité du code s'étire pour l'englober légèrement ; au départ, elle se rétracte et le code s'éteint."
            poster={<AccessCodeSchema />}
          />
        }
      />

      <StorySection
        title="Un code vaut une clé — donc il doit expirer"
        lede="Le risque d’un accès sans clé n’est pas l’ouverture, c’est l’oubli : un code distribué qui reste valide après le départ est une clé perdue qui ne se récupère jamais."
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center">
          <div className="rounded-xl border border-border bg-card p-5">
            <AccessCodeSchema />
          </div>
          <StoryZones
            items={[
              {
                tag: 'Un code par séjour',
                text: 'Jamais un code permanent partagé entre voyageurs : chaque réservation a le sien.',
              },
              {
                tag: 'Une fenêtre bornée',
                text: 'Le code s’active peu avant l’arrivée et cesse de fonctionner après le départ. C’est la serrure qui l’applique, pas une consigne.',
                highlight: true,
              },
              {
                tag: 'Une révocation immédiate',
                text: 'Séjour annulé ou écourté : le code tombe, sans intervention sur place.',
              },
            ]}
          />
        </div>
      </StorySection>

      <StorySeparator />

      <StorySection
        title="Du séjour confirmé à la porte qui s’ouvre"
        lede="Aucune étape manuelle : c’est la confirmation de la réservation qui déclenche toute la chaîne."
      >
        <StoryFlow
          steps={[
            { label: 'Réservation confirmée', text: 'les dates du séjour sont connues' },
            { label: 'Code généré', text: 'créé sur la serrure du logement' },
            { label: 'Transmis', text: 'envoyé au voyageur avec ses instructions' },
            { label: 'Expiré', text: 'désactivé après le départ' },
          ]}
        />
      </StorySection>

      <StorySeparator />

      <StorySection title="Ce que les appareils remontent aussi">
        <StoryPoints
          items={[
            {
              icon: <VolumeXIcon />,
              title: 'Le niveau sonore',
              text: 'Un capteur mesure le bruit sans enregistrer de son : vous êtes alerté d’une fête, pas des conversations.',
            },
            {
              icon: <ClockIcon />,
              title: 'Les passages',
              text: 'Chaque ouverture est horodatée : arrivée réelle du voyageur, passage de l’intervenant.',
            },
            {
              icon: <CameraIcon />,
              title: 'Les extérieurs',
              text: 'Les caméras se limitent aux espaces communs et aux abords, jamais à l’intérieur du logement.',
            },
            {
              icon: <BrushCleaningIcon />,
              title: 'L’accès de l’équipe',
              text: 'L’intervenant reçoit un code calé sur sa fenêtre d’intervention, distinct de celui du voyageur.',
            },
          ]}
        />
      </StorySection>

      <StorySeparator />

      <StoryBand
        eyebrow={{ icon: <ShieldCheckIcon />, label: 'Vie privée' }}
        title="Surveiller un logement n’est pas surveiller ses occupants"
        lede="Un capteur de bruit relève un niveau, pas une conversation. Une caméra reste à l’extérieur. Cette limite n’est pas un réglage par défaut qu’on peut desserrer : c’est le cadre dans lequel ces appareils sont proposés."
        guarantees={[
          'Aucun enregistrement audio du contenu des conversations',
          'Pas de caméra à l’intérieur du logement',
          'Journal des ouvertures consultable par le propriétaire',
        ]}
      />

      <StoryFooterCta
        icon={<KeyRoundIcon />}
        title="Commencer par une serrure"
        text="C’est l’appareil qui change le plus la vie quotidienne : plus aucun rendez-vous de remise de clés."
        actions={
          <>
            <Button>Ajouter un appareil</Button>
            <Button variant="outline">Voir les appareils compatibles</Button>
          </>
        }
      />
    </StoryPage>
  );
}
