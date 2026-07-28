import { ActionItemsView } from '../../dashboard/blocks/DashboardOperationsBlocks';
import type {
  DashboardActionItem,
  DashboardActionItems,
  DashboardActionKind,
} from '../../../services/api/dashboardOperationsApi';

/**
 * Jeux de données de la file « À traiter », pour la galerie.
 *
 * <p>Ce ne sont pas des données de démonstration au sens du produit — le mode
 * démo a été retiré de l'application. Ce sont des <b>fixtures de galerie</b> :
 * elles n'existent que dans `/admin/design-system`, ne sont jamais servies à un
 * utilisateur et n'ont aucun chemin vers le réseau.</p>
 *
 * <p>Chaque jeu isole un état que la carte doit savoir rendre et qu'aucune
 * organisation réelle ne présente au moment où on en a besoin : la rubrique
 * unique, la rubrique tronquée, le flux jamais synchronisé, l'avis anonyme, le
 * libellé trop long. Les vérifier au hasard des données de production revient à
 * ne pas les vérifier.</p>
 */

/** Construit un élément en ne nommant que ce qui compte pour le cas testé. */
function item(
  kind: DashboardActionKind,
  id: string,
  overrides: Partial<DashboardActionItem> = {},
): DashboardActionItem {
  return {
    id: `${id}`,
    kind,
    severity: 'warning',
    title: '—',
    detail: null,
    subject: null,
    targetId: 1,
    propertyName: null,
    amount: null,
    badge: null,
    ...overrides,
  };
}

/** Décompte cohérent avec les lignes fournies, sauf mention contraire. */
function pack(
  items: DashboardActionItem[],
  overrides: Partial<Record<DashboardActionKind, number>> = {},
): DashboardActionItems {
  const counted: Partial<Record<DashboardActionKind, number>> = {};
  for (const entry of items) {
    counted[entry.kind] = (counted[entry.kind] ?? 0) + 1;
  }
  const totalsByKind = { ...counted, ...overrides };
  const total = Object.values(totalsByKind).reduce((sum, n) => sum + (n ?? 0), 0);
  return { items, total, totalsByKind };
}

/**
 * Les cinq natures ensemble, dans l'ordre de priorité du serveur.
 *
 * C'est le cas nominal : il montre que chaque rubrique porte son icône, sa
 * teinte et son propre geste, et que les avatars n'apparaissent que là où une
 * personne est en jeu.
 */
export const ACTION_ITEMS_FULL: DashboardActionItems = pack([
  item('BALANCE_DUE', 'balance:8801', {
    severity: 'critical',
    title: 'Claire Fontaine',
    detail: 'RES-8801',
    subject: 'Claire Fontaine',
    propertyName: 'Riad Zitoun',
    amount: 640,
  }),
  item('BALANCE_DUE', 'balance:8814', {
    title: 'Marcus Lindqvist',
    detail: 'RES-8814',
    subject: 'Marcus Lindqvist',
    propertyName: 'Villa Palmeraie',
    amount: 1280,
  }),
  item('SERVICE_UNPAID', 'service:312', {
    title: 'Ménage de départ — 3 h',
    detail: 'Loft Gueliz',
    propertyName: 'Loft Gueliz',
    amount: 95,
  }),
  item('SERVICE_UNASSIGNED', 'unassigned:318', {
    severity: 'critical',
    title: 'Ménage de départ — 12 août',
    detail: 'Dar El Bahja',
    propertyName: 'Dar El Bahja',
  }),
  item('FEED_STALE', 'feed:17', {
    severity: 'critical',
    title: 'Booking.com — Villa Palmeraie',
    detail: 'Villa Palmeraie',
    propertyName: 'Villa Palmeraie',
    amount: 31,
  }),
  item('REVIEW_UNANSWERED', 'review:2205', {
    severity: 'info',
    title: 'Sofia Marchetti',
    detail: 'Séjour parfait, la terrasse au coucher du soleil vaut le détour à elle seule.',
    subject: 'Sofia Marchetti',
    propertyName: 'Riad Zitoun',
    badge: '5★',
  }),
  item('REVIEW_UNANSWERED', 'review:2211', {
    title: 'Tom Herrera',
    detail: 'Bien situé mais la climatisation de la chambre du fond était en panne.',
    subject: 'Tom Herrera',
    propertyName: 'Loft Gueliz',
    badge: '3★',
  }),
]);

/**
 * Une seule rubrique peuplée. C'est l'état le plus fréquent en production, et
 * celui où la carte doit le moins ressembler à une simple liste d'avis : la
 * rubrique garde son en-tête, son icône et son décompte, exactement comme
 * lorsqu'elle est accompagnée.
 */
export const ACTION_ITEMS_SINGLE_KIND: DashboardActionItems = pack(
  [
    item('REVIEW_UNANSWERED', 'review:2205', {
      severity: 'info',
      title: 'Sofia Marchetti',
      detail: 'Séjour parfait, la terrasse au coucher du soleil vaut le détour à elle seule.',
      subject: 'Sofia Marchetti',
      propertyName: 'Riad Zitoun',
      badge: '5★',
    }),
    item('REVIEW_UNANSWERED', 'review:2211', {
      title: 'Tom Herrera',
      detail: 'Bien situé mais la climatisation de la chambre du fond était en panne.',
      subject: 'Tom Herrera',
      propertyName: 'Loft Gueliz',
      badge: '3★',
    }),
    item('REVIEW_UNANSWERED', 'review:2219', {
      severity: 'info',
      title: 'Villa Palmeraie',
      // Avis importé sans auteur : pas d'avatar, la ligne doit rester lisible.
      detail: 'Tout était conforme à l’annonce.',
      propertyName: 'Villa Palmeraie',
      badge: '4★',
    }),
  ],
  { REVIEW_UNANSWERED: 12 },
);

/**
 * Rubriques tronquées : le serveur plafonne à trois lignes par nature mais
 * annonce le vrai décompte. Vérifie que chaque en-tête affiche le total réel et
 * que le lien porte un « +N » exact — c'est le chiffre qu'on avait faux.
 */
export const ACTION_ITEMS_TRUNCATED: DashboardActionItems = pack(
  [
    item('BALANCE_DUE', 'balance:8801', {
      severity: 'critical',
      title: 'Claire Fontaine',
      detail: 'RES-8801',
      subject: 'Claire Fontaine',
      propertyName: 'Riad Zitoun',
      amount: 640,
    }),
    item('BALANCE_DUE', 'balance:8814', {
      title: 'Marcus Lindqvist',
      detail: 'RES-8814',
      subject: 'Marcus Lindqvist',
      propertyName: 'Villa Palmeraie',
      amount: 1280,
    }),
    item('BALANCE_DUE', 'balance:8822', {
      title: 'Yuki Tanaka',
      detail: 'RES-8822',
      subject: 'Yuki Tanaka',
      propertyName: 'Loft Gueliz',
      amount: 310,
    }),
    item('REVIEW_UNANSWERED', 'review:2205', {
      severity: 'info',
      title: 'Sofia Marchetti',
      detail: 'Séjour parfait, la terrasse au coucher du soleil vaut le détour.',
      subject: 'Sofia Marchetti',
      propertyName: 'Riad Zitoun',
      badge: '5★',
    }),
  ],
  { BALANCE_DUE: 9, REVIEW_UNANSWERED: 12 },
);

/**
 * Cas limites, réunis pour être vus d'un coup : flux jamais synchronisé (pas de
 * nombre d'heures), montant absent, libellé long qui doit se tronquer sans
 * pousser la valeur hors de la ligne, logement non renseigné.
 */
export const ACTION_ITEMS_EDGE_CASES: DashboardActionItems = pack([
  item('FEED_STALE', 'feed:21', {
    severity: 'critical',
    title: 'Airbnb — import initial',
    detail: 'Dar El Bahja',
    propertyName: 'Dar El Bahja',
    // Jamais synchronisé : l'écran doit écrire la phrase, pas « null h ».
    amount: null,
  }),
  item('SERVICE_UNPAID', 'service:400', {
    title: 'Remplacement du chauffe-eau et remise en service de la salle de bain du haut',
    detail: 'Villa Palmeraie',
    propertyName: 'Villa Palmeraie',
    // Devis non chiffré : la ligne ne doit pas afficher « 0 € ».
    amount: null,
  }),
  item('SERVICE_UNPAID', 'service:401', {
    severity: 'info',
    title: 'Remise en état après dégât des eaux, cuisine et couloir du premier étage',
    detail: 'Riad Zitoun',
    propertyName: 'Riad Zitoun',
    // Devis non chiffré : la ligne ne doit pas afficher « 0 € ».
    amount: null,
  }),
  item('BALANCE_DUE', 'balance:8899', {
    severity: 'critical',
    // Voyageur inconnu : le serveur retombe sur la référence.
    title: 'RES-8899',
    detail: 'RES-8899',
    propertyName: 'Riad Zitoun',
    amount: 2450.5,
  }),
]);

/** Rien en attente : l'état vide de la carte. */
export const ACTION_ITEMS_EMPTY: DashboardActionItems = {
  items: [],
  total: 0,
  totalsByKind: {},
};

// ─── Démos ───────────────────────────────────────────────────────────────────

/**
 * La carte réelle du dashboard, alimentée à la main.
 *
 * C'est bien `ActionItemsView` du produit qui est rendue, pas une reconstitution :
 * une maquette parallèle finirait par diverger de l'écran qu'elle prétend
 * montrer. Seule la source de données change.
 */
function Card({ data }: { data: DashboardActionItems }) {
  return (
    <div className="max-w-md">
      <ActionItemsView data={data} />
    </div>
  );
}

/** Les cinq natures ensemble — le cas nominal. */
export function BActionItemsFullDemo() {
  return <Card data={ACTION_ITEMS_FULL} />;
}

/** Une seule rubrique : le libellé remonte sur la ligne de titre. */
export function BActionItemsSingleKindDemo() {
  return <Card data={ACTION_ITEMS_SINGLE_KIND} />;
}

/** Rubriques tronquées : décomptes réels et « +N » exacts. */
export function BActionItemsTruncatedDemo() {
  return <Card data={ACTION_ITEMS_TRUNCATED} />;
}

/** Cas limites : pas d'heure de synchro, pas de montant, libellés longs. */
export function BActionItemsEdgeCasesDemo() {
  return <Card data={ACTION_ITEMS_EDGE_CASES} />;
}

/** Rien en attente. */
export function BActionItemsEmptyDemo() {
  return <Card data={ACTION_ITEMS_EMPTY} />;
}

/**
 * Les cinq états côte à côte.
 *
 * C'est la vue qui sert vraiment à juger : les écarts de densité, d'alignement
 * et de hauteur entre états ne se voient qu'en les comparant, jamais un par un.
 */
export function BActionItemsMatrixDemo() {
  const cases = [
    { label: 'Toutes natures', data: ACTION_ITEMS_FULL },
    { label: 'Une seule rubrique', data: ACTION_ITEMS_SINGLE_KIND },
    { label: 'Rubriques tronquées', data: ACTION_ITEMS_TRUNCATED },
    { label: 'Cas limites', data: ACTION_ITEMS_EDGE_CASES },
    { label: 'Vide', data: ACTION_ITEMS_EMPTY },
  ];
  return (
    <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
      {cases.map((entry) => (
        <div key={entry.label} className="flex flex-col gap-1.5">
          <span className="text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
            {entry.label}
          </span>
          <ActionItemsView data={entry.data} />
        </div>
      ))}
    </div>
  );
}
