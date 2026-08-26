import React from 'react';
import {
  ArchiveIcon,
  ArrowLeftIcon,
  BellIcon,
  CalendarDaysIcon,
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  EyeIcon,
  FilterIcon,
  HelpCircleIcon,
  HistoryIcon,
  LinkIcon,
  PencilIcon,
  PlusIcon,
  PrinterIcon,
  RefreshCcwIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SaveIcon,
  SendIcon,
  Settings2Icon,
  Share2Icon,
  Trash2Icon,
  UploadIcon,
  XIcon,
  type LucideIcon,
} from 'lucide-react';

/**
 * Vocabulaire d'icônes des actions d'en-tête.
 *
 * <p>Une même action doit se présenter avec la MÊME icône sur tous les écrans :
 * « Actualiser » ne peut pas être une flèche circulaire ici et deux flèches
 * ailleurs. Ce fichier est la seule table qui en décide.</p>
 *
 * <p>Deux usages :</p>
 * <ul>
 *   <li>explicite — un écran écrit `<HeaderAction kind="refresh" …>` et hérite
 *       de l'icône canonique ;</li>
 *   <li>déduit — `compactHeaderActions` lit le LIBELLÉ d'un bouton existant
 *       (« Rafraîchir », « Exporter CSV »…) et lui substitue l'icône canonique,
 *       ce qui uniformise les écrans sans les réécrire un par un.</li>
 * </ul>
 */

export type HeaderActionKind =
  | 'refresh'
  | 'sync'
  | 'create'
  | 'save'
  | 'edit'
  | 'delete'
  | 'export'
  | 'import'
  | 'print'
  | 'send'
  | 'filter'
  | 'settings'
  | 'cancel'
  | 'confirm'
  | 'duplicate'
  | 'archive'
  | 'share'
  | 'link'
  | 'help'
  | 'preview'
  | 'history'
  | 'reset'
  | 'schedule'
  | 'notify'
  | 'back';

type IconComponent = LucideIcon;

/**
 * Épaisseur de trait du chrome Baitly. Le défaut de lucide (2) donne des
 * pictogrammes gras qui pèsent plus que le titre qu'ils accompagnent.
 */
const STROKE = 1.75;

const ICONS: Record<HeaderActionKind, IconComponent> = {
  refresh: RefreshCwIcon,
  sync: RefreshCcwIcon,
  create: PlusIcon,
  save: SaveIcon,
  edit: PencilIcon,
  delete: Trash2Icon,
  export: DownloadIcon,
  import: UploadIcon,
  print: PrinterIcon,
  send: SendIcon,
  filter: FilterIcon,
  settings: Settings2Icon,
  cancel: XIcon,
  confirm: CheckIcon,
  duplicate: CopyIcon,
  archive: ArchiveIcon,
  share: Share2Icon,
  link: LinkIcon,
  help: HelpCircleIcon,
  preview: EyeIcon,
  history: HistoryIcon,
  reset: RotateCcwIcon,
  schedule: CalendarDaysIcon,
  notify: BellIcon,
  back: ArrowLeftIcon,
};

/**
 * Mots qui désignent chaque action, en français et en anglais (les libellés de
 * l'application viennent d'i18n). Un libellé qui ne correspond à rien garde
 * l'icône choisie par son écran : la table uniformise ce qu'elle reconnaît,
 * elle n'invente rien.
 */
const KEYWORDS: Record<HeaderActionKind, string[]> = {
  refresh: ['rafraichir', 'actualiser', 'recharger', 'refresh', 'reload'],
  sync: ['synchroniser', 'synchronisation', 'resynchroniser', 'sync'],
  create: ['ajouter', 'ajout', 'nouveau', 'nouvelle', 'creer', 'add', 'new', 'create'],
  save: ['enregistrer', 'sauvegarder', 'save'],
  edit: ['modifier', 'editer', 'renommer', 'edit', 'rename'],
  delete: ['supprimer', 'effacer', 'retirer', 'delete', 'remove'],
  export: ['exporter', 'export', 'telecharger', 'download'],
  import: ['importer', 'import', 'televerser', 'upload'],
  print: ['imprimer', 'print'],
  send: ['envoyer', 'diffuser', 'relancer', 'send'],
  filter: ['filtrer', 'filtre', 'filtres', 'filter', 'filters'],
  settings: ['parametres', 'parametrer', 'configurer', 'configuration', 'reglages', 'settings', 'configure'],
  cancel: ['annuler', 'fermer', 'cancel', 'close'],
  confirm: ['valider', 'confirmer', 'confirm', 'validate', 'approve', 'approuver'],
  duplicate: ['dupliquer', 'copier', 'duplicate', 'copy'],
  archive: ['archiver', 'archive', 'archives'],
  share: ['partager', 'share'],
  link: ['lier', 'associer', 'connecter', 'link', 'connect'],
  help: ['aide', 'documentation', 'help', 'docs'],
  preview: ['apercu', 'previsualiser', 'consulter', 'afficher', 'voir', 'preview', 'view'],
  history: ['historique', 'journal', 'history', 'logs'],
  reset: ['reinitialiser', 'restaurer', 'reset', 'restore'],
  schedule: ['planifier', 'programmer', 'schedule'],
  notify: ['notifier', 'alerter', 'notify'],
  back: ['retour', 'back'],
};

/** Minuscules sans accents ni ponctuation, pour comparer des libellés i18n. */
function normalize(label: string): string[] {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

const BY_WORD: Map<string, HeaderActionKind> = new Map(
  (Object.entries(KEYWORDS) as Array<[HeaderActionKind, string[]]>).flatMap(([kind, words]) =>
    words.map((word) => [word, kind] as const),
  ),
);

/**
 * Action désignée par un libellé de bouton.
 *
 * <p>Le PREMIER mot prime : « Ajouter un filtre » est une création, pas un
 * filtre. À défaut, n'importe quel mot du libellé peut trancher (« Nouvelle
 * demande », « Tout exporter »).</p>
 */
export function resolveActionKind(label: string): HeaderActionKind | undefined {
  const words = normalize(label);
  if (words.length === 0) return undefined;
  const first = BY_WORD.get(words[0]);
  if (first) return first;
  for (const word of words.slice(1)) {
    const kind = BY_WORD.get(word);
    if (kind) return kind;
  }
  return undefined;
}

/** Icône canonique d'une action, prête à être posée dans un bouton. */
export function headerActionIcon(kind: HeaderActionKind): React.ReactElement {
  const Icon = ICONS[kind];
  return <Icon strokeWidth={STROKE} />;
}

/** Aligne un pictogramme d'écran sur l'épaisseur de trait du chrome. */
export function thinStroke(icon: React.ReactElement): React.ReactElement {
  return React.cloneElement(icon as React.ReactElement<{ strokeWidth?: number | string }>, {
    strokeWidth: STROKE,
  });
}

/** Icône canonique déduite d'un libellé, ou `null` si le libellé ne dit rien. */
export function canonicalIconFor(label: string): React.ReactElement | null {
  const kind = resolveActionKind(label);
  return kind ? headerActionIcon(kind) : null;
}
