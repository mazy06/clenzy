import React from 'react';
import { LocationOn } from '../../icons';
import { sizedIcon } from '../../config/navigationIcons';
import { cn } from '../../utils/cn';
import { toApiMediaUrl } from '../../utils/mediaUrl';
import { propertyGradientCss } from '../properties/propertiesListConstants';
import { propertiesApi, type Property } from '../../services/api/propertiesApi';

/**
 * Le LOGEMENT concerne, tel que toutes les fiches de notification le montrent.
 *
 * <p>Chaque panneau le redessinait a sa facon — l'un avec sa photo, l'autre
 * avec son seul nom. Or c'est le meme objet, et un hote doit le reconnaitre au
 * meme coup d'oeil qu'il s'agisse d'un no-show, d'un code d'acces ou d'une
 * retarification. La vignette, le nom et le lieu vivent donc ICI, et les
 * panneaux n'ajoutent que ce qui leur est propre.</p>
 */

/**
 * Charge le logement pour sa vignette et son lieu.
 *
 * <p>Un echec ne fait rien echouer : `property` reste `null` et l'en-tete
 * retombe sur le nom porte par les faits.</p>
 */
export function useNotificationProperty(propertyId: number | null) {
  const [property, setProperty] = React.useState<Property | null>(null);
  const [loading, setLoading] = React.useState(propertyId !== null);

  React.useEffect(() => {
    if (propertyId === null) {
      setProperty(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    propertiesApi
      .getById(propertyId)
      .then((loaded) => { if (active) setProperty(loaded); })
      .catch(() => { if (active) setProperty(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [propertyId]);

  return { property, loading };
}

/**
 * Vignette du logement : sa photo, ou a defaut le degrade reproductible qui lui
 * sert deja d'identite dans la liste des logements. Jamais un carre vide — une
 * vignette absente se lit comme une image cassee.
 */
export function PropertyThumb({
  property,
  name,
  className,
}: {
  /**
   * Le logement, ou le strict minimum dont la vignette se sert. Les ecrans de
   * liste ne portent qu'une ligne (`PropertyListItem`), jamais l'entite
   * complete : leur demander de charger un logement entier pour afficher une
   * image serait payer une requete par ligne.
   */
  property: {
    id?: number | string;
    coverPhotoUrl?: string | null;
    photoUrls?: string[] | null;
  } | null;
  /** Repli d'identite quand le logement n'a pas pu etre charge. */
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = React.useState(false);
  const src = toApiMediaUrl(property?.coverPhotoUrl ?? property?.photoUrls?.[0]);

  return (
    <span
      className={cn(
        'relative block h-[66px] w-[88px] shrink-0 overflow-hidden rounded-lg border border-border',
        className,
      )}
      style={{ background: propertyGradientCss(String(property?.id ?? name)) }}
    >
      {src && !failed && (
        <img
          src={src}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}

/** Ville et code postal du logement, ou `null` quand ni l'un ni l'autre n'est connu. */
export function propertyPlace(property: Property | null): string | null {
  const place = [property?.city, property?.postalCode].filter(Boolean).join(' ');
  return place || null;
}

/**
 * Une ligne de contexte sous le nom du logement : icone discrete, texte tronque.
 *
 * <p>`flex` et non `inline-flex` : deux lignes de contexte — un lieu PUIS une
 * reference, une piece, un prix de base — se retrouvaient cote a cote et
 * collees (« 33200, Bordeaux🏠 Entrée »). C'est une LIGNE, elle prend la
 * sienne.</p>
 */
export function PropertyLine({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="m-0 mt-1 flex min-w-0 max-w-full items-center gap-1.5 text-xs text-muted-foreground">
      <span className="inline-flex shrink-0">{sizedIcon(icon, 13, 1.75)}</span>
      <span className="truncate">{children}</span>
    </p>
  );
}

/**
 * En-tete commun : vignette, nom, lieu — et ce que le panneau veut y ajouter.
 *
 * <p>`extra` recoit les lignes propres au panneau (une reference de sejour, un
 * prix de base) ; `trailing` la marque de droite (canal, pastille d'etat).</p>
 */
export function PropertyIdentity({
  property,
  name,
  address,
  extra,
  trailing,
}: {
  property: Property | null;
  name: string;
  /**
   * Adresse complete, quand l'appelant en a une.
   *
   * <p>Elle REMPLACE la ville : les deux cote a cote donnaient « Marrakech
   * 40000 · 12 derb Sidi Bouloukat, 40000, Marrakech » — la meme information
   * ecrite deux fois, dont une en moins precis.</p>
   */
  address?: string | null;
  extra?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  const place = address?.trim() || propertyPlace(property);

  return (
    <header className="flex items-start gap-3">
      <PropertyThumb property={property} name={name} />

      <div className="min-w-0 flex-1 self-center">
        <p className="m-0 truncate text-sm font-semibold text-foreground">{name}</p>
        {place && <PropertyLine icon={<LocationOn />}>{place}</PropertyLine>}
        {extra}
      </div>

      {trailing}
    </header>
  );
}
