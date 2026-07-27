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
import { MAX_WIDGETS_PER_ROW, type DashboardRow } from '../../hooks/useDashboardLayout';
import './dashboardLayout.css';

/**
 * Tableau de bord composable : des **lignes** de tuiles côte à côte, dont les
 * largeurs se règlent à la poignée.
 *
 * **Pourquoi ce modèle plutôt qu'une grille libre 2D** : nos tuiles ont des
 * hauteurs naturelles très différentes (un tableau à sept colonnes contre une
 * carte de trois lignes). Une grille à hauteur de rangée fixe produirait soit du
 * contenu rogné, soit de grands vides. En lignes, les hauteurs restent
 * automatiques et seule la largeur se négocie.
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
  onMoveNextTo: (draggedId: string, targetId: string) => void;
  onMoveToOwnRow: (draggedId: string, rowIndex: number) => void;
  onShiftWithinRow: (id: string, delta: -1 | 1) => void;
  onRowSizes: (rowIndex: number, sizes: number[]) => void;
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
}: DashboardWidgetGridProps) {
  const { t } = useTranslation();
  const [draggingId, setDraggingId] = React.useState<string | null>(null);

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
    const { active, over } = event;
    if (!over) return;
    const draggedId = String(active.id);
    const overId = String(over.id);

    // Zone d'insertion entre deux lignes → la tuile part sur sa propre ligne.
    if (overId.startsWith('row-gap:')) {
      onMoveToOwnRow(draggedId, Number(overId.slice('row-gap:'.length)));
      return;
    }
    if (draggedId !== overId) onMoveNextTo(draggedId, overId);
  };

  const draggingWidget = draggingId ? byId.get(draggingId) : undefined;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(event: DragStartEvent) => setDraggingId(String(event.active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggingId(null)}
    >
      <RowGap index={0} label={t('dashboard.layout.dropNewRow', 'Nouvelle ligne')} />
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
                flexBasis={stacked ? undefined : `${row.sizes?.[position] ?? 100}%`}
                // Ancres des lignes voisines : apparier au clavier revient à
                // insérer avant leur première tuile.
                rowAbove={resolvedRows[rowIndex - 1]}
                rowBelow={resolvedRows[rowIndex + 1]}
                onMoveToOwnRow={onMoveToOwnRow}
                onMoveNextTo={onMoveNextTo}
                onShiftWithinRow={onShiftWithinRow}
                t={t}
              />
            ))}
          </div>
          <RowGap
            index={rowIndex + 1}
            label={t('dashboard.layout.dropNewRow', 'Nouvelle ligne')}
          />
        </React.Fragment>
      ))}

      {/* Aperçu suivant le curseur — dupliquer le contenu réel serait trop lourd. */}
      <DragOverlay dropAnimation={null}>
        {draggingWidget && (
          <div className="rounded-lg border border-primary/40 bg-card px-3 py-2 text-sm font-medium text-foreground shadow-lg">
            {draggingWidget.label}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

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

  return (
    <ResizablePanelGroup
      orientation="horizontal"
      // ⚠️ `react-resizable-panels` pose `height: 100%` EN INLINE sur le groupe.
      // Résultat : toutes les lignes du tableau de bord se résolvaient contre une
      // même base et adoptaient une hauteur IDENTIQUE — changer le contenu d'une
      // ligne déplaçait toutes les autres (mesuré : 304/304 avec le style de la
      // lib, 372/236 sans). Chaque ligne doit épouser SON contenu ; l'égalité ne
      // vaut qu'entre les tuiles d'une même ligne, et c'est `align-items:
      // stretch` qui s'en charge. Le style utilisateur est étalé APRÈS les
      // valeurs par défaut de la lib, donc cette ligne les écrase bien.
      style={{ height: 'auto' }}
      // Étirement par défaut (`align-items: stretch`) : les tuiles d'une même
      // ligne se terminent à la même hauteur, celle de la plus haute.
      //
      // Une tentative précédente avait été abandonnée parce que le contenu se
      // retrouvait rogné ; la cause était d'imposer aux tuiles une hauteur
      // pouvant être INFÉRIEURE à leur contenu (et `.cn-card` porte
      // `overflow-hidden`, donc le débordement disparaissait sans barre de
      // défilement). Ici l'ordre est inverse et sûr : la hauteur du groupe est
      // le MAXIMUM des hauteurs naturelles, aucune tuile n'est donc jamais
      // comprimée — les plus courtes gagnent seulement du vide en bas.
      //
      // `h-full` sur l'enfant direct, et non `flex-1` : une base de flex nulle
      // ferait retomber la hauteur intrinsèque du panneau à zéro, et tout
      // s'effondrerait. Un pourcentage, lui, est ignoré au calcul intrinsèque.
      //
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
            // `DashboardErrorBoundary` rend ses enfants sans emballage : l'enfant
            // direct du panneau est donc bien la racine de la tuile.
            className="min-w-0 [&>*]:h-full"
          >
            {entry.node}
          </ResizablePanel>
        </React.Fragment>
      ))}
    </ResizablePanelGroup>
  );
}

/** Zone d'accueil entre deux lignes — extraire une tuile sur sa propre ligne. */
function RowGap({ index, label }: { index: number; label: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: `row-gap:${index}` });
  return (
    <div
      ref={setNodeRef}
      aria-hidden
      className="relative flex h-4 items-center justify-center"
      title={label}
    >
      {/* Le filet reste à épaisseur constante : seule la couleur change. Faire
          varier la hauteur au survol décalerait les lignes voisines. */}
      <span
        className={cn(
          'db-rowgap-rule h-0.5 w-full rounded-full transition-colors duration-150',
          'motion-reduce:transition-none',
          isOver ? 'text-primary' : 'text-border'
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
 * Cadre en tirets du mode édition — trois états lisibles d'un coup d'œil :
 * au repos un filet fin et discret (huit tuiles cadrées en même temps, il ne
 * faut pas que l'écran crie), en cible de dépôt un tracé plus épais, plus
 * espacé et animé, et en cible refusée le même tracé en rouge. Le rayon (15)
 * suit le `rounded-xl` de la tuile décalé des 4 px du cadre.
 */
const FRAME_TONES = {
  idle: { tint: 'text-border', width: 1.25, dash: '5 6' },
  target: { tint: 'db-frame--target text-primary', width: 1.75, dash: '10 6' },
  blocked: { tint: 'text-destructive', width: 1.75, dash: '10 6' },
} as const;

function DashedFrame({ tone }: { tone: keyof typeof FRAME_TONES }) {
  const { tint, width, dash } = FRAME_TONES[tone];
  return (
    <svg
      aria-hidden
      className={cn(
        'pointer-events-none absolute -inset-1 transition-colors duration-150',
        'motion-reduce:transition-none',
        tint
      )}
      // ⚠️ Taille EXPLICITE obligatoire. Un <svg> est un élément remplacé : en
      // position absolue avec `width: auto`, le CSS ne deduit pas sa taille des
      // `inset` mais prend sa taille intrinseque par defaut — 300 × 150 px — et
      // ignore `right`/`bottom` comme sur-contraints. Sans ces deux lignes,
      // toutes les tuiles recoivent le meme cadre de 300 × 150 colle en haut a
      // gauche, quelle que soit leur taille. `-inset-1` valant -4 px, le cadre
      // fait la tuile plus 4 px de chaque cote, soit 100 % + 0.5rem.
      style={{ width: 'calc(100% + 0.5rem)', height: 'calc(100% + 0.5rem)' }}
    >
      <rect
        x="1"
        y="1"
        rx="15"
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

type ResolvedRow = DashboardRow & { entries: DashboardWidgetEntry[] };

function EditableWidget({
  entry,
  rowIndex,
  position,
  rowSize,
  totalRows,
  rowIsFull,
  isDragging,
  flexBasis,
  rowAbove,
  rowBelow,
  onMoveToOwnRow,
  onMoveNextTo,
  onShiftWithinRow,
  t,
}: {
  entry: DashboardWidgetEntry;
  rowIndex: number;
  position: number;
  rowSize: number;
  totalRows: number;
  rowIsFull: boolean;
  isDragging: boolean;
  flexBasis?: string;
  rowAbove?: ResolvedRow;
  rowBelow?: ResolvedRow;
  onMoveToOwnRow: (draggedId: string, rowIndex: number) => void;
  onMoveNextTo: (draggedId: string, targetId: string) => void;
  onShiftWithinRow: (id: string, delta: -1 | 1) => void;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  // Apparier n'est possible que si la ligne voisine a de la place.
  const canJoinAbove = !!rowAbove && rowAbove.entries.length < MAX_WIDGETS_PER_ROW;
  const canJoinBelow = !!rowBelow && rowBelow.entries.length < MAX_WIDGETS_PER_ROW;
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: entry.id });
  const { attributes, listeners, setNodeRef: setDragRef } = useDraggable({ id: entry.id });

  return (
    <div
      ref={setDropRef}
      style={{ flexBasis, flexGrow: 1, flexShrink: 1, minWidth: 0 }}
      className={cn(
        'relative rounded-xl transition-opacity duration-150 motion-reduce:transition-none',
        isDragging && 'opacity-40'
      )}
    >
      <DashedFrame
        tone={isOver && !isDragging ? (rowIsFull ? 'blocked' : 'target') : 'idle'}
      />

      <div className="absolute -top-3 end-2 z-10 flex items-center gap-1 rounded-md border border-border bg-card px-1 py-0.5 shadow-sm">
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
