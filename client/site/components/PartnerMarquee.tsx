import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import BaitlyMark from './BaitlyMark';

/**
 * Marque affichable dans le mur. Volontairement plus permissif que `PartnerDef`
 * (catalog) et que `BrandDef` (BrandLogos) : les deux y sont assignables, ce
 * qui permet d'alimenter le mur depuis l'écosystème d'intégrations comme depuis
 * la marketplace du livret.
 */
export interface WallBrand {
  name: string;
  color?: string;
  mono?: string;
  logoUrl?: string;
  /** Logo monochrome peint via masque CSS (fond = `color`). */
  mask?: boolean;
  /** Couleur du glyphe masqué (blanc par défaut). */
  glyph?: string;
  /** Service opéré par Baitly → mark Baitly teinté. */
  baitly?: boolean;
  /** Logo en bandeau (wordmark) : plus large que haut. */
  wide?: boolean;
}

/** Teinte de repli quand la marque n'en déclare pas. */
const FALLBACK = '#6B8A9A';

/**
 * Mur de logos partenaires — 3 lignes qui défilent en continu (pattern Mobbin) :
 * chaque item = grande tuile d'icône + nom de marque en gras.
 *
 * Boucle sans couture : la piste contient DEUX copies identiques, chacune
 * suffixée d'un padding égal à l'écart entre items ; `translateX(-50%)` recale
 * donc exactement sur une copie (avec un `gap` de flex sur la piste, la demie
 * ne tomberait pas sur une frontière d'item et l'enchaînement saccaderait).
 *
 * Les lignes du haut et du bas défilent vers la gauche, celle du milieu à
 * contresens ; les phases de départ diffèrent pour éviter l'effet « bloc ».
 * prefers-reduced-motion : tout est figé (voir site.css).
 */

/** Tuile d'icône, façon icône d'application. */
function WallTile({ partner }: { partner: WallBrand }) {
  // Service opéré par Baitly → mark Baitly teinté à la couleur du service.
  const color = partner.color ?? FALLBACK;

  if (partner.baitly) {
    return (
      <span
        className="flex size-12 shrink-0 items-center justify-center rounded-[14px]"
        style={{
          color,
          backgroundColor: `color-mix(in srgb, ${color} 14%, var(--bui-background))`,
          border: `1px solid color-mix(in srgb, ${color} 26%, transparent)`,
        }}
      >
        <BaitlyMark size={26} />
      </span>
    );
  }

  // Logo monochrome → masque CSS : fond de marque, glyphe peint par-dessus.
  if (partner.mask && partner.logoUrl) {
    /* URL entre guillemets : Vite inline les petits SVG en data-URI, dont les
       caractères spéciaux rendraient un `url(...)` nu invalide — la déclaration
       serait alors silencieusement ignorée et le glyphe invisible. */
    const maskUrl = `url("${partner.logoUrl}")`;
    return (
      <span
        className="flex size-12 shrink-0 items-center justify-center rounded-[14px]"
        style={{ backgroundColor: color }}
      >
        <span
          aria-hidden
          className="size-6"
          style={{
            backgroundColor: partner.glyph ?? '#FFFFFF',
            maskImage: maskUrl,
            WebkitMaskImage: maskUrl,
            maskSize: 'contain',
            WebkitMaskSize: 'contain',
            maskRepeat: 'no-repeat',
            WebkitMaskRepeat: 'no-repeat',
            maskPosition: 'center',
            WebkitMaskPosition: 'center',
          }}
        />
      </span>
    );
  }

  // Logo couleur (raster ou multicolore) → tuile claire, logo contenu.
  if (partner.logoUrl) {
    return (
      <span className="flex size-12 shrink-0 items-center justify-center rounded-[14px] border border-border bg-white">
        <img
          src={partner.logoUrl}
          alt=""
          /* Un wordmark très large ne peut pas remplir un carré : on contraint
             sa hauteur et on lui laisse de la largeur, sinon il finit minuscule. */
          className={partner.wide ? 'h-5 w-10 object-contain' : 'size-8 object-contain'}
          loading="lazy"
        />
      </span>
    );
  }

  // Repli : monogramme teinté.
  return (
    <span
      className="flex size-12 shrink-0 items-center justify-center rounded-[14px] text-sm font-bold text-white"
      style={{
        backgroundImage: `linear-gradient(145deg, ${color}, color-mix(in srgb, ${color} 78%, #000))`,
      }}
    >
      {partner.mono}
    </span>
  );
}

function WallItem({ partner }: { partner: WallBrand }) {
  return (
    <span className="flex items-center gap-3">
      <WallTile partner={partner} />
      <span className="text-lg font-semibold tracking-tight whitespace-nowrap">{partner.name}</span>
    </span>
  );
}

/** Vitesse de défilement du mur, en pixels par seconde (lecture tranquille). */
const SPEED_PX_PER_SECOND = 18;

/** Une passe = la ligne rendue une fois. */
function WallPass({ row }: { row: WallBrand[] }) {
  return (
    <span data-pass className="flex items-center gap-12">
      {row.map((partner) => (
        <WallItem key={partner.name} partner={partner} />
      ))}
    </span>
  );
}

/** Une copie = N passes (padding de fin = écart entre items → boucle nette). */
function WallCopy({ row, repeats, hidden }: { row: WallBrand[]; repeats: number; hidden?: boolean }) {
  return (
    <span className="flex shrink-0 items-center gap-12 pe-12" aria-hidden={hidden || undefined}>
      {Array.from({ length: repeats }, (_, pass) => (
        <WallPass key={pass} row={row} />
      ))}
    </span>
  );
}

/**
 * Une ligne du mur. La piste s'étend sur toute la largeur disponible : le
 * nombre de répétitions est donc MESURÉ, pas fixé en dur. Une copie plus
 * étroite que la fenêtre laisserait un vide à droite en fin de cycle (la copie
 * suivante n'arrive pas assez tôt) ; on répète jusqu'à la couvrir, et on
 * recalcule au redimensionnement.
 */
function WallRow({ row, index }: { row: WallBrand[]; index: number }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [repeats, setRepeats] = useState(2);
  const [duration, setDuration] = useState(0);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const measure = () => {
      const pass = viewport.querySelector<HTMLElement>('[data-pass]');
      const passWidth = pass?.getBoundingClientRect().width ?? 0;
      const available = viewport.clientWidth;
      if (passWidth <= 0 || available <= 0) return;
      // +1 passe de marge : la copie dépasse toujours la largeur visible.
      const needed = Math.max(2, Math.ceil(available / passWidth) + 1);
      setRepeats((current) => (current === needed ? current : needed));
      /* Durée dérivée de la largeur, pas fixe : un cycle parcourt exactement une
         copie, donc à durée constante une ligne plus longue défilerait plus
         vite. On vise une VITESSE constante, identique sur les trois lignes. */
      const seconds = Math.round((passWidth * needed) / SPEED_PX_PER_SECOND);
      setDuration((current) => (current === seconds ? current : seconds));
    };
    /* ResizeObserver plutôt qu'un écouteur `resize` : la ligne peut naître à
       largeur nulle (onglet masqué, parent replié) puis s'étendre sans qu'un
       redimensionnement de fenêtre ne survienne — l'observateur, lui, voit ce
       passage de 0 à la largeur réelle et relance la mesure. */
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    measure();
    return () => observer.disconnect();
  }, [row]);

  return (
    <div ref={viewportRef} className="overflow-hidden">
      <div
        /* Lignes du haut et du bas vers la gauche, celle du milieu à contresens. */
        className={`brandwall-track flex w-max${index % 2 === 1 ? ' brandwall-track--reverse' : ''}`}
        style={
          {
            /* Durée mesurée (vitesse constante) ; la valeur du CSS ne sert que
               de repli avant la première mesure. */
            animationDuration: duration ? `${duration}s` : undefined,
            /* Phase de départ décalée d'une ligne à l'autre (délai négatif :
               l'animation démarre déjà entamée, sans attente). */
            animationDelay: duration ? `${-index * (duration / 3)}s` : undefined,
          } as CSSProperties
        }
      >
        <WallCopy row={row} repeats={repeats} />
        <WallCopy row={row} repeats={repeats} hidden />
      </div>
    </div>
  );
}

export default function PartnerMarquee({ rows }: { rows: WallBrand[][] }) {
  return (
    <div className="brandwall flex flex-col gap-5">
      {rows.map((row, index) => (
        <WallRow key={index} row={row} index={index} />
      ))}
    </div>
  );
}
