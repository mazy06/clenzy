import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../components/ui';
import { OpenInNew as ExternalLinkIcon, Info as InfoIcon } from '../../../icons';
import { SERVICE_TOOLTIPS, type ServiceTooltipData } from '../../../services/integrations/serviceTooltips';

/**
 * Wrapper Tooltip reutilisable pour tous les services d'integration (Signature,
 * Pricing, Accounting, Compliance, KYC, Channel Manager, OTAs, Catalog).
 *
 * <h2>Source unique</h2>
 * <p>Lookup dans {@link SERVICE_TOOLTIPS} via {@code providerId}. Si la cle
 * n'existe pas, on rend les children sans tooltip (no-op gracieux — pas
 * d'erreur, juste pas de tooltip).</p>
 *
 * <h2>Style</h2>
 * <p>Bulle du kit Baitly UI (encre inversee). Le contenu s'exprime en
 * {@code currentColor} / {@code text-inherit} pour suivre la bulle quel que
 * soit le theme.</p>
 */

interface ServiceTooltipProps {
  /** Provider ID (cle dans SERVICE_TOOLTIPS). Case-sensitive. */
  providerId: string;
  /** Override optionnel des donnees du tooltip (pour les services dynamiques). */
  data?: ServiceTooltipData & { name?: string };
  /** Nom du service (pour le header du tooltip). Defaut : provider ID. */
  name?: string;
  children: React.ReactElement;
}

export default function ServiceTooltip({ providerId, data, name, children }: ServiceTooltipProps) {
  const tooltipData = data ?? SERVICE_TOOLTIPS[providerId];
  // Pas de tooltip si pas de donnees — rendu transparent
  if (!tooltipData) return children;

  const displayName = name ?? data?.name ?? providerId;

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        {/* Le span porte la ref que Radix pose sur son enfant : les children
            recus ne la transmettent pas necessairement. */}
        <span className="inline-flex">{children}</span>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6} className="max-w-[320px] p-2">
        <div>
          {/* Header : nom + chip region */}
          <div className="flex items-center gap-1 mb-0.5">
            <span className="text-[0.75rem] font-bold text-inherit">
              {displayName}
            </span>
            {tooltipData.region && (
              <span className="text-[0.58rem] font-bold tracking-[0.02em] px-0.5 py-0 rounded-[3px] border border-solid border-[currentColor] opacity-70">
                {tooltipData.region}
              </span>
            )}
          </div>

          {/* Description longue */}
          <span className="block text-[0.7rem] text-inherit opacity-92 leading-[1.45] mb-1">
            {tooltipData.description}
          </span>

          {/* Modalites d'acces */}
          <span className="flex items-start gap-0.5 text-[0.68rem] text-inherit opacity-85 leading-[1.4] mb-0.5">
            <InfoIcon size={11} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1, opacity: 0.7 }} />
            <span>
              <strong style={{ fontWeight: 700 }}>Modalités :</strong> {tooltipData.accessModality}
            </span>
          </span>

          {/* Lien officiel */}
          <a
            href={tooltipData.websiteUrl}
            target="_blank"
            rel="noreferrer noopener"
            onClick={(e) => e.stopPropagation()}
            className="text-[0.68rem] text-inherit font-semibold inline-flex items-center gap-1 underline decoration-dotted underline-offset-2 opacity-92 hover:opacity-100"
          >
            {tooltipData.websiteUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '')}
            <ExternalLinkIcon size={10} strokeWidth={2} />
          </a>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
