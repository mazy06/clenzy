import React from 'react';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '../../components/ui';
import { cn } from '../../utils/cn';

/**
 * Wrapper visuel commun aux sections de la page Settings > IA.
 *
 * <h3>Pourquoi</h3>
 * Avant, chaque section (PlatformAiConfigSection, AssistantBriefingPrefs,
 * KnowledgeBaseAdmin) avait son propre traitement esthetique : border violet +
 * gradient lavande pour l'une, bgcolor teinte primary 2.5% pour les autres,
 * tailles de titre incoherentes (h6 vs subtitle1). Resultat : empilement
 * visuel chaotique avec 3 esthetiques differentes.
 *
 * Ce composant impose un cadre unique, celui du kit Baitly UI : {@code Card}
 * et ses slots (header / action / content). Le cadre n'est donc plus decrit
 * ici — il est celui de toutes les cartes du produit.
 *
 * <h3>Anti-patterns evites (Impeccable rules)</h3>
 * - Pas de dot colore au-dessus du title (AI-slop "templated")
 * - Pas de gradient text ni gradient background (interdit absolu)
 * - Pas de side-stripe colore en haut/cote (interdit absolu)
 * - Pas d'icon-badge rounded au-dessus du heading (pattern AI generique)
 * - Pas de bgcolor teinte brand (cassait le contraste sur la page)
 */
export interface AiSettingsCardProps {
  /** Titre principal de la section. */
  title: React.ReactNode;
  /** Sous-titre / description courte sous le titre. */
  subtitle?: React.ReactNode;
  /**
   * Slot d'action a droite du header (bouton primaire, icon button, etc.).
   * Reste aligne en haut avec le titre pour ne pas casser la grille verticale.
   */
  action?: React.ReactNode;
  /** Contenu de la section. */
  children: React.ReactNode;
  /** Override la marge basse, en unites de 8 px (defaut 3 = 24 px). */
  mb?: number;
}

export default function AiSettingsCard({
  title,
  subtitle,
  action,
  children,
  mb = 3,
}: AiSettingsCardProps) {
  return (
    <Card
      className="gap-0 p-4 transition-colors duration-200 hover:border-foreground/20 md:p-6"
      style={{ marginBottom: mb * 8 }}
    >
      {(title || subtitle || action) && (
        <CardHeader
          className={cn(
            'gap-2 px-0 pt-0',
            // Sur mobile l'action passe sous le titre : cote a cote, un bouton
            // large comprimerait le titre a quelques caracteres.
            'max-md:flex max-md:flex-col max-md:items-stretch',
          )}
        >
          <div className="min-w-0 flex-1">
            {title && (
              <CardTitle className="text-balance text-[1rem] font-semibold leading-[1.3] text-foreground md:text-[1.0625rem]">
                {title}
              </CardTitle>
            )}
            {subtitle && (
              <p className="m-0 mt-0.5 max-w-[720px] text-[0.8125rem] leading-[1.5] text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>
          {action && <CardAction className="shrink-0 self-start max-md:self-stretch">{action}</CardAction>}
        </CardHeader>
      )}
      <CardContent className={cn('px-0 pb-0', (title || subtitle || action) && 'pt-5')}>
        {children}
      </CardContent>
    </Card>
  );
}
