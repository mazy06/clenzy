import {
  lazy,
  Suspense,
  useState,
  type ComponentType,
  type CSSProperties,
} from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon, CheckIcon } from '../../src/icons/glyphs';
import { NavigationMenuLink } from '../../src/components/ui/navigation-menu';
import type { BaitlyNavPreviewKind } from './BaitlyNavPreview';

// Menu links are immediate; only their decorative demonstrations are deferred.
const BaitlyBookingPreview = lazy(() => import('./BaitlyBookingPreview'));
const BaitlyNavPreview = lazy(() => import('./BaitlyNavPreview'));

/**
 * Le contenu d'un volet de la barre de navigation : une liste, une vitrine.
 *
 * <p>Les trois menus posaient la meme grille de deux colonnes de liens, chacun
 * avec son icone, son titre et deux lignes de texte. Neuf modules ainsi rendus
 * font dix-huit lignes de prose a lire avant de choisir : le menu demandait
 * autant d'effort que la page vers laquelle il mene.</p>
 *
 * <p>La composition retenue separe les deux gestes. <b>Le rail</b>, a gauche,
 * ne porte qu'une icone et un titre par entree : on le balaye. <b>La vitrine</b>,
 * a droite, ne montre QUE l'entree survolee : son apercu, sa phrase et jusqu'a
 * trois de ses vraies fonctionnalites. On ne lit donc jamais plus d'un bloc de
 * texte a la fois, et la profondeur est disponible sans etre imposee.</p>
 *
 * <p><b>Le mouvement fait le lien entre les deux.</b> Un curseur glisse d'une
 * rangee a l'autre — c'est lui qui dit ce que la vitrine est en train de
 * montrer ; l'apercu entre en fondu, et le
 * texte la suit d'un souffle. Les rangees se posent en cascade a l'ouverture,
 * dans la foulee du tiroir.</p>
 *
 * <p>La vitrine est <b>redondante avec le rail</b> : elle n'ajoute aucune
 * destination. Elle est donc masquee aux lecteurs d'ecran et ne prend pas le
 * pointeur — l'entree active reste celle de la derniere rangee survolee, meme
 * quand la souris traverse la vitrine.</p>
 */

export interface NavMegaItem {
  key: string;
  to: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
  /** Une phrase, pas deux : la vitrine n'en montre qu'une a la fois. */
  copy: string;
  /** Les vraies fonctionnalites de l'entree — trois au plus sont rendues. */
  points?: readonly string[];
  /** Etiquette courte (« Outil », « Guide ») ; les ressources en portent une. */
  tag?: string;
  /** Miniature fonctionnelle du module ou de la ressource. */
  preview?: BaitlyNavPreviewKind;
  /** Photo du type de logement ou du marche pour les solutions. */
  photo?: string;
}

interface NavMegaPanelProps {
  items: readonly NavMegaItem[];
  /** Lien large du bas du volet, vers la page qui porte toutes les entrees. */
  footer: { to: string; label: string };
  /** Libelle de l'appel de la vitrine (« Decouvrir »). */
  discoverLabel: string;
}

export default function NavMegaPanel({
  items,
  footer,
  discoverLabel,
}: NavMegaPanelProps) {
  const [activeKey, setActiveKey] = useState<string>(items[0]?.key ?? '');
  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.key === activeKey),
  );
  const active = items[activeIndex] ?? items[0];
  if (!active) return null;
  const ActiveIcon = active.icon;

  return (
    <div className="bl-mega-panel">
      <div className="bl-mega">
        <div className="bl-mega-rail">
          {/* Le curseur est un simple decalage : toutes les rangees ont la
              meme hauteur, il n'y a donc rien a mesurer au montage. */}
          <span
            className="bl-mega-marker"
            style={{ '--bl-mega-i': activeIndex } as CSSProperties}
            aria-hidden="true"
          />
          {items.map((item, index) => {
            const Icon = item.icon;
            return (
              <NavigationMenuLink asChild key={item.key}>
                <Link
                  to={item.to}
                  className="bl-mega-row"
                  style={{ '--bl-mega-i': index } as CSSProperties}
                  data-active={item.key === active.key ? '' : undefined}
                  onPointerEnter={() => setActiveKey(item.key)}
                  onFocus={() => setActiveKey(item.key)}
                >
                  <span className="bl-mega-row-icon">
                    <Icon className="size-4" />
                  </span>
                  <span className="bl-mega-row-title">{item.title}</span>
                  <ArrowRightIcon
                    className="bl-mega-row-arrow"
                    aria-hidden="true"
                  />
                </Link>
              </NavigationMenuLink>
            );
          })}
        </div>

        <div className="bl-mega-stage" aria-hidden="true">
          {/* La cle remonte la carte a chaque changement : c'est elle qui
              rejoue l'animation d'entree, sans rien a remettre a zero. */}
          <div className="bl-mega-card" key={active.key}>
            <Suspense
              fallback={
                <span className="bl-mega-card-media bl-mega-card-media-plain">
                  <ActiveIcon className="size-7" />
                </span>
              }
            >
              {active.key === 'booking-engine' ? (
                <BaitlyBookingPreview compact />
              ) : active.preview ? (
                <BaitlyNavPreview kind={active.preview} />
              ) : active.photo ? (
                <span className="bl-mega-card-media">
                  <img src={active.photo} alt="" decoding="async" />
                  <span className="bl-mega-card-plate">
                    <ActiveIcon className="size-4" />
                  </span>
                </span>
              ) : (
                <span className="bl-mega-card-media bl-mega-card-media-plain">
                  <ActiveIcon className="size-7" />
                </span>
              )}
            </Suspense>
            <span className="bl-mega-card-body">
              {active.tag && (
                <span className="bl-mega-card-tag">{active.tag}</span>
              )}
              <strong>{active.title}</strong>
              <span className="bl-mega-card-copy">{active.copy}</span>
              {active.points && active.points.length > 0 && (
                <span className="bl-mega-card-points">
                  {active.points.slice(0, 3).map((point) => (
                    <span key={point}>
                      <CheckIcon aria-hidden="true" />
                      {point}
                    </span>
                  ))}
                </span>
              )}
              <span className="bl-mega-card-more">
                {discoverLabel}
                <ArrowRightIcon />
              </span>
            </span>
          </div>
        </div>
      </div>

      <NavigationMenuLink asChild>
        <Link to={footer.to} className="bl-mega-footer">
          {footer.label}
          <ArrowRightIcon aria-hidden="true" />
        </Link>
      </NavigationMenuLink>
    </div>
  );
}
