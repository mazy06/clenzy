import React from 'react';
import { Button, Spinner, Tooltip, TooltipContent, TooltipTrigger } from './ui';
import NavCountBadge from './NavCountBadge';
import { canonicalIconFor, thinStroke } from './headerActionIcons';

/**
 * Réduction des actions d'en-tête à leur icône.
 *
 * <p>La barre de titre n'accepte qu'une forme de bouton : une icône, expliquée
 * par une infobulle (cf. `HeaderAction`). Les écrans, eux, poussent encore des
 * boutons libellés dans les emplacements `actions` et `filters` du
 * `PageHeader` — quatre-vingts fichiers, chacun avec ses propres verbes et ses
 * propres icônes.</p>
 *
 * <p>Plutôt que de réécrire ces quatre-vingts fichiers pour un changement de
 * PRÉSENTATION, la réduction se fait à l'entrée de la barre, là où le header
 * reçoit ce que l'écran lui donne. Chaque bouton y perd son libellé visible et
 * le regagne en infobulle et en nom accessible ; son icône est remplacée par
 * celle du vocabulaire commun quand le libellé désigne une action connue
 * (« Actualiser », « Exporter »…), ce qui aligne les écrans entre eux.</p>
 *
 * <p>Un bouton peut refuser la réduction avec l'attribut `data-keep-label` :
 * réservé aux cas où le libellé EST l'information (un compteur, un état).</p>
 *
 * <p>Ce qui n'est pas un bouton (sélecteur, champ, puce) traverse intact : le
 * `PageHeader` le replie derrière son propre déclencheur de filtres.</p>
 *
 * <p>La présentation est celle de la barre, pas celle de l'écran : contour et
 * teintes tombent (cf. `BARE`), le trait des pictogrammes est ramené à celui du
 * chrome. Sans quoi la même action se dessinait autrement d'un écran à
 * l'autre — ce qu'on cherchait justement à faire disparaître.</p>
 */

/** Marqueur d'exemption, posé par l'écran sur un bouton à libellé signifiant. */
const KEEP_LABEL = 'data-keep-label';

/**
 * Gabarit du bouton réduit : le carré de 32 px de la barre de titre, qui est
 * aussi la hauteur du champ de recherche voisin. Il ne dépend pas de ce que
 * l'écran avait demandé — c'est la barre qui impose son gabarit, sinon les
 * boutons se décalent d'un écran à l'autre.
 */
const ICON_SIZE = 'icon';

/**
 * Présentation imposée par la barre : pas de contour.
 *
 * <p>Une rangée de boutons encadrés dessine autant de petits cadres que
 * d'actions, juste au-dessus du contenu — le chrome pèse alors plus que ce
 * qu'il surplombe. Le `className` de l'écran tombe avec : il ne portait que de
 * la décoration (bordure de marque, fond, teinte) que la barre ne veut pas.</p>
 */
const BARE: Record<string, unknown> = { variant: 'ghost', className: undefined };

const HeaderCompactContext = React.createContext(false);

/**
 * « Suis-je rendu dans la barre de titre ? »
 *
 * <p>La réduction ne sait transformer que des `Button` présents dans l'arbre
 * qu'on lui donne. Un composant d'action maison (`ExportButton`…) reste une
 * boîte noire : il rend ses boutons lui-même, plus tard. Ce drapeau lui permet
 * d'adopter la forme réduite de son propre chef.</p>
 */
export function useHeaderCompact(): boolean {
  return React.useContext(HeaderCompactContext);
}

/** Éléments dont le texte ne fait pas partie du libellé de l'action. */
function isDecorative(element: React.ReactElement): boolean {
  return element.type === NavCountBadge || element.type === Spinner;
}

/** Texte visible d'un arbre d'enfants, compteurs et indicateurs exclus. */
function textOf(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join(' ');
  if (React.isValidElement(node)) {
    if (isDecorative(node)) return '';
    return textOf((node.props as { children?: React.ReactNode }).children);
  }
  return '';
}

/** Props d'un element quelconque de l'arbre d'actions. */
type AnyProps = { children?: React.ReactNode } & Record<string, unknown>;

interface Context {
  /**
   * Le nœud est l'enfant unique d'un `asChild` (déclencheur de menu, de
   * popover…) : il doit rester UN élément qui transmet sa ref, donc pas
   * d'enveloppe d'infobulle — le libellé passe par l'attribut `title`.
   */
  slotted: boolean;
  /** Une infobulle de l'écran couvre déjà ce nœud : ne pas en ajouter une seconde. */
  described: boolean;
}

const ROOT: Context = { slotted: false, described: false };

/** Réduit à l'icône tous les boutons d'un arbre d'actions. */
export default function compactHeaderActions(node: React.ReactNode): React.ReactNode {
  return (
    <HeaderCompactContext.Provider value>{compact(node, ROOT)}</HeaderCompactContext.Provider>
  );
}

function compact(node: React.ReactNode, context: Context): React.ReactNode {
  if (Array.isArray(node)) {
    return React.Children.map(node, (child) => compact(child, context));
  }
  if (!React.isValidElement(node)) return node;

  const element = node as React.ReactElement<AnyProps>;
  if (element.type === Button) return compactButton(element, context);

  const children = element.props.children as React.ReactNode;
  // Enfant-fonction (render prop) : on ne sait pas ce qu'il produira.
  if (children === undefined || typeof children === 'function') return element;

  return React.cloneElement(
    element,
    undefined,
    compact(children, {
      slotted: element.props.asChild === true,
      described: context.described || element.type === Tooltip,
    }),
  );
}

function compactButton(
  element: React.ReactElement<AnyProps>,
  context: Context,
): React.ReactNode {
  const props = element.props;
  if (props[KEEP_LABEL] !== undefined) return element;

  const children = React.Children.toArray(props.children).filter(Boolean);
  const ariaLabel = typeof props['aria-label'] === 'string' ? props['aria-label'].trim() : '';
  const label = ariaLabel || textOf(children).replace(/\s+/g, ' ').trim();
  if (!label) return element;

  // `<Button asChild><Link>…</Link></Button>` : c'est l'ENFANT qui porte
  // l'icône et le texte, le bouton n'est qu'un gabarit.
  if (props.asChild === true) {
    const inner = children.find(React.isValidElement) as
      | React.ReactElement<AnyProps>
      | undefined;
    if (!inner) return element;
    const innerChildren = React.Children.toArray(inner.props.children).filter(React.isValidElement);
    if (innerChildren.length === 0) return element;
    const compacted = React.cloneElement(
      element,
      { ...BARE, size: ICON_SIZE, 'aria-label': label },
      React.cloneElement(inner, undefined, glyphFor(label, innerChildren)),
    );
    return describe(compacted, label, context);
  }

  const elements = children.filter(React.isValidElement) as React.ReactElement[];
  // Sans icône, réduire reviendrait à effacer le bouton.
  if (elements.length === 0) return element;

  // Un compteur survit à la réduction : c'est une information, pas un libellé.
  const badges = elements.filter((child) => child.type === NavCountBadge);
  const glyph = glyphFor(label, elements);
  const compacted = React.cloneElement(
    element,
    { ...BARE, size: ICON_SIZE, 'aria-label': label },
    badges.length > 0 ? [React.cloneElement(glyph, { key: 'glyph' }), ...badges] : glyph,
  );

  return describe(compacted, label, context);
}

/**
 * Icône du bouton réduit : celle du vocabulaire commun si le libellé désigne
 * une action connue, sinon celle qu'a choisie l'écran. Un indicateur d'attente
 * n'est jamais remplacé — il dit que l'action est en cours.
 */
function glyphFor(label: string, elements: React.ReactElement[]): React.ReactElement {
  const first = elements[0];
  if (first.type === Spinner) return first;
  return canonicalIconFor(label) ?? thinStroke(first);
}

/**
 * Attache le libellé au bouton réduit — en infobulle Radix quand la place le
 * permet, en `title` natif quand le bouton doit rester un élément unique.
 *
 * <p>Jamais les deux : le `title` que l'écran avait posé est retiré dès qu'une
 * infobulle le couvre, sinon la même phrase s'affiche deux fois, à deux
 * instants différents.</p>
 */
function describe(
  button: React.ReactElement,
  label: string,
  context: Context,
): React.ReactNode {
  if (context.slotted) return React.cloneElement(button, { title: label });
  const silent = React.cloneElement(button, { title: undefined });
  if (context.described) return silent;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* Un bouton désactivé n'émet pas d'événement de survol : l'infobulle
            s'ancre sur l'enveloppe pour rester atteignable. */}
        <span className="inline-flex">{silent}</span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
