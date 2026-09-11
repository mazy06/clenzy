import * as React from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  GripVerticalIcon,
  LayoutGridIcon as GridViewIcon,
  MoreHorizontalIcon,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '../../components/ui';
import { cn } from '../../utils/cn';
import { useTranslation } from '../../hooks/useTranslation';
import { MAX_WIDGETS_PER_ROW, type DashboardRow, type DropSide } from '../../hooks/useDashboardLayout';
import { TileHeightProvider, type TileHeightChannel } from '../../hooks/useTileHeight';
import './dashboardLayout.css';

/**
 * Tableau de bord composable : des **lignes** de tuiles côte à côte, dont les
 * largeurs se règlent à la poignée.
 *
 * **Pourquoi ce modèle plutôt qu'une grille libre 2D** : nos tuiles ont des
 * hauteurs naturelles très différentes (un tableau à sept colonnes contre une
 * carte de trois lignes). Une grille à hauteur de rangée fixe, commune à TOUT
 * l'écran, produirait soit du contenu rogné, soit de grands vides. Ici chaque
 * ligne négocie sa propre hauteur, celle de la tuile la plus courte qu'elle
 * porte — cf. {@link SideBySideRow}.
 *
 * **Pourquoi `@dnd-kit/core` seul** : `@dnd-kit/sortable` n'est pas installé et
 * l'ajouter imposerait une réinstallation des dépendances du conteneur.
 *
 * **Accessibilité** : toute opération faisable au pointeur l'est au clavier.
 * Les poignées de redimensionnement répondent nativement aux flèches ; le
 * déplacement passe par deux boutons *monter* / *descendre* et un menu qui
 * couvre ce que le glisser seul permettait — **apparier** deux tuiles sur une
 * même ligne et les **réordonner** entre elles. Sans ce menu, un utilisateur au
 * clavier pouvait défaire une ligne mais jamais en composer une.
 */

export interface DashboardWidgetEntry {
  /** Identifiant stable, persisté dans les préférences. Ne jamais le renommer. */
  id: string;
  /** Nom lisible — libellés d'accessibilité et mode édition. */
  label: string;
  /** Largeur minimale en %, quand la tuile ne supporte pas d'être trop étroite. */
  minSizePct?: number;
  node: React.ReactNode;
}

interface DashboardWidgetGridProps {
  widgets: DashboardWidgetEntry[];
  rows: DashboardRow[];
  editing: boolean;
  /** En dessous de `lg` : tout s'empile, aucune largeur à négocier. */
  stacked: boolean;
  onMoveNextTo: (draggedId: string, targetId: string, side?: DropSide) => void;
  onMoveToOwnRow: (draggedId: string, rowIndex: number) => void;
  onShiftWithinRow: (id: string, delta: -1 | 1) => void;
  onRowSizes: (rowIndex: number, sizes: number[]) => void;
  /** Retire la tuile de l'écran. Le sélecteur sait la remettre. */
  onRemove: (id: string) => void;
}

export default function DashboardWidgetGrid({
  widgets,
  rows,
  editing,
  stacked,
  onMoveNextTo,
  onMoveToOwnRow,
  onShiftWithinRow,
  onRowSizes,
  onRemove,
}: DashboardWidgetGridProps) {
  const { t } = useTranslation();
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [draggingRect, setDraggingRect] = React.useState<{ width: number; height: number } | null>(null);

  const byId = React.useMemo(
    () => new Map(widgets.map((widget) => [widget.id, widget])),
    [widgets],
  );

  const resolvedRows = React.useMemo(
    () =>
      rows
        .map((row) => ({
          ...row,
          entries: row.ids
            .map((id) => byId.get(id))
            .filter((w): w is DashboardWidgetEntry => w !== undefined),
        }))
        .filter((row) => row.entries.length > 0),
    [rows, byId],
  );

  const sensors = useSensors(
    // Sans distance d'activation, un simple clic dans une tuile déclencherait
    // un déplacement.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  // Rendu courant : aucun habillage, aucun contexte de glisser monté.
  if (!editing) {
    return (
      <>
        {resolvedRows.map((row, rowIndex) => (
          <RowContent
            key={row.ids.join('|')}
            row={row}
            rowIndex={rowIndex}
            stacked={stacked}
            onRowSizes={onRowSizes}
          />
        ))}
      </>
    );
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingId(null);
    setDraggingRect(null);
    const { active, over } = event;
    if (!over) return;
    const draggedId = String(active.id);
    const overId = String(over.id);

    // Zone d'insertion entre deux lignes → la tuile part sur sa propre ligne.
    if (overId.startsWith('row-gap:')) {
      onMoveToOwnRow(draggedId, Number(overId.slice('row-gap:'.length)));
      return;
    }
    // Moitié gauche ou droite d'une tuile → insertion avant ou après elle.
    const edge = /^edge:(before|after):(.+)$/.exec(overId);
    if (edge) {
      const [, side, targetId] = edge;
      if (draggedId !== targetId) onMoveNextTo(draggedId, targetId, side as DropSide);
      return;
    }
    if (draggedId !== overId) onMoveNextTo(draggedId, overId);
  };

  const draggingWidget = draggingId ? byId.get(draggingId) : undefined;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(event: DragStartEvent) => {
        setDraggingId(String(event.active.id));
        // Taille d'origine mesurée par dnd-kit : c'est elle qui donne le
        // facteur de réduction vers le gabarit commun.
        const rect = event.active.rect.current.initial;
        setDraggingRect(rect ? { width: rect.width, height: rect.height } : null);
      }}
      onDragEnd={handleDragEnd}
      onDragCancel={() => { setDraggingId(null); setDraggingRect(null); }}
    >
      {/* ── Le PLAN DE TRAVAIL ──────────────────────────────────────────────
          C'est le fond qui dit le mode, pas la multiplication des traits.
          Multiplier les cadres finissait par tout brouiller ; les supprimer
          rendait l'édition indiscernable du rendu courant. Une SURFACE
          distincte tranche les deux : un plan encastré, plus sombre d'un cran,
          sur lequel les tuiles — qui gardent leur fond de carte — se détachent
          d'elles-mêmes. La figure et le fond font le travail que huit
          pointillés faisaient mal. */}
      <div className="db-board flex flex-col rounded-xl border border-border bg-field p-3">
        <p className="m-0 mb-2 flex items-center gap-1.5 px-0.5 text-xs text-muted-foreground">
          <GridViewIcon className="size-3.5 shrink-0" />
          {t(
            'dashboard.layout.editingHint',
            'Glissez une tuile par sa poignée pour la déplacer, ou déposez-la entre deux lignes.',
          )}
        </p>

        <RowGap
          index={0}
          label={t('dashboard.layout.dropNewRow', 'Nouvelle ligne')}
          active={draggingId !== null}
        />
      {resolvedRows.map((row, rowIndex) => (
        <React.Fragment key={row.ids.join('|')}>
          <div
            className={cn(
              'flex gap-3',
              stacked && 'flex-col',
              // En édition, les largeurs ne sont pas négociées : on montre la
              // composition, pas le rendu final.
              !stacked && 'flex-row'
            )}
          >
            {row.entries.map((entry, position) => (
              <EditableWidget
                key={entry.id}
                entry={entry}
                rowIndex={rowIndex}
                position={position}
                rowSize={row.entries.length}
                totalRows={resolvedRows.length}
                rowIsFull={row.entries.length >= MAX_WIDGETS_PER_ROW}
                isDragging={draggingId === entry.id}
                dragActive={draggingId !== null}
                flexBasis={stacked ? undefined : `${row.sizes?.[position] ?? 100}%`}
                // Ancres des lignes voisines : apparier au clavier revient à
                // insérer avant leur première tuile.
                rowAbove={resolvedRows[rowIndex - 1]}
                rowBelow={resolvedRows[rowIndex + 1]}
                onMoveToOwnRow={onMoveToOwnRow}
                onMoveNextTo={onMoveNextTo}
                onShiftWithinRow={onShiftWithinRow}
                onRemove={onRemove}
                t={t}
              />
            ))}
          </div>
          <RowGap
            index={rowIndex + 1}
            label={t('dashboard.layout.dropNewRow', 'Nouvelle ligne')}
            active={draggingId !== null}
          />
        </React.Fragment>
      ))}
      </div>

      {/* Aperçu suivant le curseur : la tuile ELLE-MÊME, réduite au gabarit. */}
      <DragOverlay dropAnimation={null}>
        {draggingWidget && <DragPreview entry={draggingWidget} sourceRect={draggingRect} />}
      </DragOverlay>
    </DndContext>
  );
}


/**
 * Gabarit commun de l'aperçu de glisser.
 *
 * <p>Toutes les tuiles se ramènent à la MEME empreinte pendant le déplacement,
 * quelle que soit leur taille d'origine : un bandeau de chiffres large et plat
 * et un graphique haut ne peuvent pas suivre le curseur à leurs dimensions
 * réelles — le premier dépasserait de l'écran, le second cacherait la cible
 * qu'on vise.</p>
 */
const PREVIEW_WIDTH = 300;
const PREVIEW_HEIGHT = 168;

/**
 * Aperçu suivant le curseur : la tuile elle-même, réduite.
 *
 * <p>L'aperçu ne portait qu'une étiquette — le nom de la tuile dans un cadre —
 * au motif que dupliquer le contenu serait trop lourd. On déplaçait donc un mot,
 * pas un objet, et rien ne rappelait ce qu'on tenait. Le contenu réel est
 * remonté ici, MIS A L'ECHELLE : il n'est monté que le temps du glisser, et
 * React Query lui sert les données déjà en cache.</p>
 *
 * <p>Le contenu est rendu à sa largeur d'ORIGINE puis réduit par `transform` :
 * le re-mesurer à 300 px relancerait la mise en page de chaque graphique et
 * ferait sauter l'aperçu à la prise en main.</p>
 */
function DragPreview({
  entry,
  sourceRect,
}: {
  entry: DashboardWidgetEntry;
  sourceRect: { width: number; height: number } | null;
}) {
  const width = sourceRect?.width ?? PREVIEW_WIDTH;
  const height = sourceRect?.height ?? PREVIEW_HEIGHT;
  const scale = Math.min(PREVIEW_WIDTH / width, 1);

  return (
    <div
      className={cn(
        'db-drag-preview relative overflow-hidden rounded-xl border border-primary/40 bg-card',
        'shadow-2xl ring-1 ring-primary/15',
      )}
      style={{ width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT }}
    >
      {/* `aria-hidden` : le contenu réel vit toujours dans la page, cette copie
          ne doit pas être annoncée deux fois. */}
      <div
        aria-hidden
        className="pointer-events-none origin-top-left [&>*]:h-full"
        style={{ width, height, transform: `scale(${scale})` }}
      >
        {entry.node}
      </div>

      {/* Le contenu réduit est illisible ; le NOM, lui, doit rester certain.
          Un voile depuis le bas, et l'intitulé posé dessus. */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-card via-card/90 to-transparent px-3 pt-6 pb-2">
        <p className="m-0 truncate text-sm font-semibold text-foreground">{entry.label}</p>
      </div>
    </div>
  );
}

/**
 * Hauteur SOUS laquelle une ligne cesse d'etre lisible.
 *
 * <p>Le bandeau d'une tuile — intitule, precision, rembourrages — pese une
 * cinquantaine de pixels ; sous 220 il ne reste pas de quoi montrer trois
 * lignes de liste ou tracer une courbe. Une tuile plus courte que ce plancher
 * ne peut donc pas rabaisser sa ligne : elle garde un peu de vide sous son
 * contenu, ce qui vaut mieux qu'une ligne ou plus personne ne tient.</p>
 */
const MIN_ROW_HEIGHT = 220;

/** Ligne rendue : panneaux redimensionnables, ou pile sous `lg`. */
function RowContent({
  row,
  rowIndex,
  stacked,
  onRowSizes,
}: {
  row: DashboardRow & { entries: DashboardWidgetEntry[] };
  rowIndex: number;
  stacked: boolean;
  onRowSizes: (rowIndex: number, sizes: number[]) => void;
}) {
  // Une seule tuile, ou affichage empilé : pas de groupe de panneaux à monter.
  if (stacked || row.entries.length === 1) {
    return (
      <>
        {row.entries.map((entry) => (
          <React.Fragment key={entry.id}>{entry.node}</React.Fragment>
        ))}
      </>
    );
  }

  return <SideBySideRow row={row} rowIndex={rowIndex} onRowSizes={onRowSizes} />;
}

/**
 * Ligne de tuiles COTE A COTE.
 *
 * <p>Les tuiles d'une ligne se terminent toutes a la meme hauteur — mais c'est
 * la PLUS COURTE qui la donne, pas la plus haute. Etirer tout le monde sur la
 * plus haute revenait a payer le tableau d'une tuile en vide dans sa voisine :
 * sept lignes « A traiter » suivies de quatre cents pixels de blanc, parce que
 * « Revenus par canal » listait sept canaux.</p>
 *
 * <p>Et ce qui depasse ne defile pas : la tuile le RESORBE — elle montre ce qui
 * tient et compte le reste ({@link useFitRows}). Un ascenseur dans une
 * tuile de tableau de bord est une promesse qu'on ne tient pas : la page defile
 * deja, le rail se confond avec celui de l'ecran, et masque
 * (`no-scrollbar`) il cache la moitie d'une liste sans meme le laisser
 * deviner.</p>
 *
 * <p>Seules les tuiles qui ANNONCENT leur ecart entrent dans ce minimum (cf.
 * {@link TileHeightChannel}) : un graphique n'annonce rien, il prend ce qu'on
 * lui donne. Une ligne sans aucune annonce retombe sur `auto`,
 * c'est-a-dire sur l'ancien comportement.</p>
 */
function SideBySideRow({
  row,
  rowIndex,
  onRowSizes,
}: {
  row: DashboardRow & { entries: DashboardWidgetEntry[] };
  rowIndex: number;
  onRowSizes: (rowIndex: number, sizes: number[]) => void;
}) {
  const [naturals, setNaturals] = React.useState<Record<string, number>>({});

  const report = React.useCallback((id: string, height: number | null) => {
    setNaturals((previous) => {
      if (height === null) {
        if (!(id in previous)) return previous;
        const next = { ...previous };
        delete next[id];
        return next;
      }
      if (previous[id] === height) return previous;
      return { ...previous, [id]: height };
    });
  }, []);

  // Une tuile encore en chargement ne rend rien : sa hauteur vaut zéro et ne
  // doit pas écraser la ligne. Elle se déclarera quand elle aura son contenu.
  const measured = row.entries
    .map((entry) => naturals[entry.id])
    .filter((height): height is number => typeof height === 'number' && height > 0);
  const rowHeight = measured.length
    ? Math.max(MIN_ROW_HEIGHT, Math.min(...measured))
    : undefined;

  return (
    <ResizablePanelGroup
      orientation="horizontal"
      // ⚠️ `react-resizable-panels` pose `height: 100%` EN INLINE sur le groupe.
      // Résultat : toutes les lignes du tableau de bord se résolvaient contre une
      // même base et adoptaient une hauteur IDENTIQUE — changer le contenu d'une
      // ligne déplaçait toutes les autres (mesuré : 304/304 avec le style de la
      // lib, 372/236 sans). Chaque ligne porte SA hauteur : celle qu'on a
      // mesurée, ou `auto` tant qu'aucune tuile ne s'est déclarée. Le style
      // utilisateur est étalé APRÈS les valeurs par défaut de la lib, donc cette
      // ligne les écrase bien.
      style={{ height: rowHeight ?? 'auto' }}
      // `onLayoutChanged` n'est appelé qu'au relâchement du pointeur — c'est le
      // rappel prévu pour l'enregistrement, contrairement à `onLayoutChange`
      // qui émet à chaque pixel.
      onLayoutChanged={(layout) =>
        onRowSizes(
          rowIndex,
          row.entries.map((entry) => layout[entry.id] ?? 0),
        )
      }
    >
      {row.entries.map((entry, position) => (
        <React.Fragment key={entry.id}>
          {position > 0 && <ResizableHandle withHandle className="mx-1.5 bg-transparent" />}
          <ResizablePanel
            id={entry.id}
            // ⚠️ v4 : un nombre serait interprété en PIXELS. Une chaîne sans
            // unité vaut un pourcentage.
            defaultSize={`${row.sizes?.[position] ?? Math.round(100 / row.entries.length)}`}
            minSize={`${entry.minSizePct ?? 20}`}
            className="min-w-0"
          >
            <WidgetPane entry={entry} onNaturalHeight={report} />
          </ResizablePanel>
        </React.Fragment>
      ))}
    </ResizablePanelGroup>
  );
}

/**
 * Panneau d'une tuile.
 *
 * <p>La tuile prend TOUJOURS la hauteur du panneau. Un graphique n'a pas de
 * hauteur propre et remplit ce qu'on lui donne ; une liste, elle, a besoin
 * d'une hauteur DEFINIE pour savoir combien de rangs elle peut peindre. Aucun
 * panneau ne defile : le rognage n'est qu'un filet de securite pour les tuiles
 * qui ne resorbent pas encore leur contenu.</p>
 *
 * <p>Le panneau traduit les ecarts annonces ({@link TileHeightChannel}) en
 * hauteur voulue : sa propre hauteur, plus le plus grand des ecarts. Une tuile
 * qui n'annonce rien ne pese pas sur la hauteur de sa ligne.</p>
 */
function WidgetPane({
  entry,
  onNaturalHeight,
}: {
  entry: DashboardWidgetEntry;
  onNaturalHeight: (id: string, height: number | null) => void;
}) {
  const paneRef = React.useRef<HTMLDivElement>(null);
  const overflows = React.useRef(new Map<string, number>());

  const channel = React.useMemo<TileHeightChannel>(
    () => ({
      declare: (source, overflow) => {
        if (overflow === null) overflows.current.delete(source);
        else overflows.current.set(source, overflow);

        const pane = paneRef.current;
        const worst = overflows.current.size ? Math.max(...overflows.current.values()) : null;
        if (worst === null || !pane) {
          onNaturalHeight(entry.id, null);
          return;
        }
        onNaturalHeight(entry.id, Math.round(pane.clientHeight + worst));
      },
    }),
    [entry.id, onNaturalHeight],
  );

  // La tuile retirée ou déplacée ne doit plus peser sur la hauteur de sa ligne.
  React.useEffect(() => () => onNaturalHeight(entry.id, null), [entry.id, onNaturalHeight]);

  return (
    <TileHeightProvider value={channel}>
      <div ref={paneRef} className="h-full overflow-hidden">
        {/* `DashboardErrorBoundary` rend ses enfants sans emballage : `[&>*]`
            vise donc bien la racine de la tuile. */}
        <div className="h-full [&>*]:h-full">{entry.node}</div>
      </div>
    </TileHeightProvider>
  );
}

/**
 * Zone d'accueil entre deux lignes — extraire une tuile sur sa propre ligne.
 *
 * <p>Le filet ne se montre que pendant un GLISSER. Affiché en permanence, il
 * doublait le nombre de traits à l'écran pour annoncer une cible qui n'existe
 * que le temps d'un déplacement : au repos, l'interligne redevient de l'espace,
 * et la disposition se relit pour ce qu'elle est.</p>
 *
 * <p>La hauteur, elle, ne bouge jamais : la faire varier à l'apparition
 * décalerait toutes les lignes du dessous au moment précis où l'on vise.</p>
 */
function RowGap({ index, label, active }: { index: number; label: string; active: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: `row-gap:${index}` });
  return (
    <div
      ref={setNodeRef}
      aria-hidden
      className="relative flex h-4 items-center justify-center"
      title={label}
    >
      <span
        className={cn(
          'db-rowgap-rule h-0.5 w-full rounded-full transition-opacity duration-150',
          'motion-reduce:transition-none',
          active ? 'opacity-100' : 'opacity-0',
          isOver ? 'text-primary' : 'text-border',
        )}
      />
      {isOver && (
        <span className="absolute rounded-full border border-primary/40 bg-card px-2 py-0.5 text-[11px] font-medium text-primary shadow-sm">
          {label}
        </span>
      )}
    </div>
  );
}

/**
 * Cadre du mode édition.
 *
 * <h2>Une signification par trait</h2>
 * <p>Tout était en tirets : le cadre de chaque tuile, et le filet de chaque
 * interligne. Huit tuiles et neuf interlignes donnaient dix-sept pointillés
 * simultanés, tous de même épaisseur — l'écran ne disait plus rien, il
 * grésillait.</p>
 *
 * <p>Le tiret veut désormais dire UNE chose : « quelque chose peut se poser
 * ici ». Il n'apparaît donc QUE sur la cible de dépôt sous le curseur, et en
 * rouge sur une cible refusée.</p>
 *
 * <p>Au repos, aucun cadre. Sur le plan de travail — plus sombre d'un cran —
 * chaque tuile garde son fond de carte et se détache d'elle-même : la figure et
 * le fond disent déjà « bloc déplaçable ». Un filet de plus n'aurait fait que
 * doubler la bordure que la carte porte à 2 px de là.</p>
 *
 * <p>Le décalage vaut 2 px : à 4 px, deux tuiles voisines faisaient courir leurs
 * cadres à 8 px l'un de l'autre et l'œil y lisait une bordure partagée. Le rayon
 * (14) suit le `rounded-xl` de la tuile décalé d'autant.</p>
 */
const FRAME_TONES = {
  target: { tint: 'db-frame--target text-primary', width: 1.75, dash: '10 6' },
  blocked: { tint: 'text-destructive', width: 1.75, dash: '10 6' },
} as const;

function WidgetFrame({ tone }: { tone: keyof typeof FRAME_TONES | 'idle' }) {
  if (tone === 'idle') return null;
  const { tint, width, dash } = FRAME_TONES[tone];
  return (
    <svg
      aria-hidden
      className={cn(
        'pointer-events-none absolute -inset-0.5 transition-colors duration-150',
        'motion-reduce:transition-none',
        tint
      )}
      // ⚠️ Taille EXPLICITE obligatoire. Un <svg> est un élément remplacé : en
      // position absolue avec `width: auto`, le CSS ne deduit pas sa taille des
      // `inset` mais prend sa taille intrinseque par defaut — 300 × 150 px — et
      // ignore `right`/`bottom` comme sur-contraints. Sans ces deux lignes,
      // toutes les tuiles recoivent le meme cadre de 300 × 150 colle en haut a
      // gauche, quelle que soit leur taille. `-inset-0.5` valant -2 px, le cadre
      // fait la tuile plus 2 px de chaque cote, soit 100 % + 0.25rem.
      style={{ width: 'calc(100% + 0.25rem)', height: 'calc(100% + 0.25rem)' }}
    >
      <rect
        x="1"
        y="1"
        rx="14"
        fill="none"
        stroke="currentColor"
        strokeWidth={width}
        strokeDasharray={dash}
        // Les propriétés géométriques d'un <rect> acceptent `calc()` en CSS,
        // pas en attribut : c'est ce qui permet au cadre de suivre la tuile.
        // Le pourcentage se resout ici contre le viewport SVG ci-dessus.
        style={{ width: 'calc(100% - 2px)', height: 'calc(100% - 2px)' }}
      />
    </svg>
  );
}

/**
 * Moitié d'une tuile qui accueille un dépôt, et la barre qui le montre.
 *
 * <p>La barre se pose sur le bord EXTÉRIEUR de la moitié survolée : à gauche
 * pour « avant », à droite pour « après ». C'est la convention des éditeurs de
 * texte et des gestionnaires de fichiers — le trait marque la fente où l'objet
 * va se glisser, pas la zone qu'on survole.</p>
 */
function DropEdge({
  side,
  droppable,
  blocked,
}: {
  side: DropSide;
  droppable: ReturnType<typeof useDroppable>;
  blocked: boolean;
}) {
  return (
    <div
      ref={droppable.setNodeRef}
      aria-hidden
      className={cn('absolute inset-y-0 z-20 w-1/2', side === 'before' ? 'start-0' : 'end-0')}
    >
      <span
        className={cn(
          'absolute inset-y-1 w-1 rounded-full transition-opacity duration-150',
          'motion-reduce:transition-none',
          side === 'before' ? '-start-1.5' : '-end-1.5',
          droppable.isOver ? 'opacity-100' : 'opacity-0',
          blocked ? 'bg-destructive' : 'bg-primary',
        )}
      />
    </div>
  );
}

type ResolvedRow = DashboardRow & { entries: DashboardWidgetEntry[] };

function EditableWidget({
  entry,
  rowIndex,
  position,
  rowSize,
  totalRows,
  rowIsFull,
  isDragging,
  dragActive,
  flexBasis,
  rowAbove,
  rowBelow,
  onMoveToOwnRow,
  onMoveNextTo,
  onShiftWithinRow,
  onRemove,
  t,
}: {
  entry: DashboardWidgetEntry;
  rowIndex: number;
  position: number;
  rowSize: number;
  totalRows: number;
  rowIsFull: boolean;
  isDragging: boolean;
  /** Un glisser est en cours : les cibles latérales ne vivent que là. */
  dragActive: boolean;
  flexBasis?: string;
  rowAbove?: ResolvedRow;
  rowBelow?: ResolvedRow;
  onMoveToOwnRow: (draggedId: string, rowIndex: number) => void;
  onMoveNextTo: (draggedId: string, targetId: string, side?: DropSide) => void;
  onShiftWithinRow: (id: string, delta: -1 | 1) => void;
  onRemove: (id: string) => void;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  // Apparier n'est possible que si la ligne voisine a de la place.
  const canJoinAbove = !!rowAbove && rowAbove.entries.length < MAX_WIDGETS_PER_ROW;
  const canJoinBelow = !!rowBelow && rowBelow.entries.length < MAX_WIDGETS_PER_ROW;
  // Deux cibles par tuile plutôt qu'une : le côté du dépôt doit se VOIR.
  // Sans elles, poser à gauche et poser à droite donnaient le même survol, et
  // rien ne permettait d'insérer APRÈS la dernière tuile d'une ligne.
  const before = useDroppable({ id: `edge:before:${entry.id}` });
  const after = useDroppable({ id: `edge:after:${entry.id}` });
  const isOver = before.isOver || after.isOver;
  const { attributes, listeners, setNodeRef: setDragRef } = useDraggable({ id: entry.id });

  return (
    <div
      style={{ flexBasis, flexGrow: 1, flexShrink: 1, minWidth: 0 }}
      className={cn(
        'group/widget relative rounded-xl transition-opacity duration-150 motion-reduce:transition-none',
        // La tuile saisie ne disparaît pas : elle laisse son emplacement visible.
        isDragging && 'db-slot-vacated opacity-30',
      )}
    >
      <WidgetFrame
        tone={isOver && !isDragging ? (rowIsFull ? 'blocked' : 'target') : 'idle'}
      />

      {/* Zones latérales : actives uniquement pendant un glisser, sinon elles
          capteraient les clics de la tuile. Chacune couvre une moitié et pose
          sa barre d'insertion sur son bord EXTÉRIEUR — c'est là que la tuile
          va atterrir. Propriétés logiques : en RTL, « avant » passe à droite
          sans une ligne de plus. */}
      {dragActive && !isDragging && (
        <>
          <DropEdge side="before" droppable={before} blocked={rowIsFull} />
          <DropEdge side="after" droppable={after} blocked={rowIsFull} />
        </>
      )}

      {/* La barre vit DANS la tuile. Posée à cheval sur le bord, elle coupait
          le cadre en deux et donnait à chaque tuile un autocollant de travers.
          Le contenu étant inerte en édition, en couvrir un coin ne coûte rien.

          Elle est franchement visible : c'est l'outil du mode, pas une
          décoration. Elle se contente de gagner son ombre au survol. */}
      <div
        className={cn(
          'absolute top-2 end-2 z-10 flex items-center gap-0.5 rounded-lg px-1 py-0.5',
          'border border-border bg-card transition-shadow duration-150',
          'group-hover/widget:shadow-sm focus-within:shadow-sm',
          'motion-reduce:transition-none',
        )}
      >
        <button
          ref={setDragRef}
          type="button"
          aria-label={`${t('dashboard.layout.dragHandle', 'Déplacer')} — ${entry.label}`}
          className="flex size-6 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-accent active:cursor-grabbing"
          {...listeners}
          {...attributes}
        >
          <GripVerticalIcon className="size-4" />
        </button>
        <button
          type="button"
          disabled={rowIndex === 0}
          onClick={() => onMoveToOwnRow(entry.id, rowIndex)}
          aria-label={`${t('dashboard.layout.moveUp', 'Monter')} — ${entry.label}`}
          className="flex size-6 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronUpIcon className="size-4" />
        </button>
        <button
          type="button"
          disabled={rowIndex >= totalRows - 1}
          onClick={() => onMoveToOwnRow(entry.id, rowIndex + 2)}
          aria-label={`${t('dashboard.layout.moveDown', 'Descendre')} — ${entry.label}`}
          className="flex size-6 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronDownIcon className="size-4" />
        </button>

        {/* Ce que le glisser seul permettait, et que le clavier n'atteignait
            pas : apparier deux tuiles sur une ligne, et les réordonner. */}
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`${t('dashboard.layout.more', 'Autres placements')} — ${entry.label}`}
            className="flex size-6 cursor-pointer items-center justify-center rounded text-muted-foreground outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <MoreHorizontalIcon className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{entry.label}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={!canJoinAbove}
              onSelect={() => rowAbove && onMoveNextTo(entry.id, rowAbove.entries[0].id)}
            >
              {t('dashboard.layout.joinAbove', 'Placer sur la ligne du dessus')}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!canJoinBelow}
              onSelect={() => rowBelow && onMoveNextTo(entry.id, rowBelow.entries[0].id)}
            >
              {t('dashboard.layout.joinBelow', 'Placer sur la ligne du dessous')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={position === 0}
              onSelect={() => onShiftWithinRow(entry.id, -1)}
            >
              {t('dashboard.layout.shiftStart', 'Déplacer vers le début de la ligne')}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={position >= rowSize - 1}
              onSelect={() => onShiftWithinRow(entry.id, 1)}
            >
              {t('dashboard.layout.shiftEnd', 'Déplacer vers la fin de la ligne')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={rowSize === 1}
              onSelect={() => onMoveToOwnRow(entry.id, rowIndex + 1)}
            >
              {t('dashboard.layout.ownRow', 'Sortir sur sa propre ligne')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {/* Retirer n'est pas supprimer : le sélecteur la repropose. */}
            <DropdownMenuItem variant="destructive" onSelect={() => onRemove(entry.id)}>
              {t('dashboard.layout.remove', 'Retirer du tableau de bord')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Le contenu reste inerte en édition : on réorganise, on n'utilise pas.
          `h-full` réplique l'étirement du mode rendu, sinon les cadres en tirets
          d'une même ligne s'arrêteraient à des hauteurs différentes. */}
      <div className="pointer-events-none h-full [&>*]:h-full">{entry.node}</div>
    </div>
  );
}
