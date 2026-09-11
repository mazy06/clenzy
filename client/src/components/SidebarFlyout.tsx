import React from 'react';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from './ui';
import { Check } from '../icons';

/**
 * Le VOLET de la barre latérale — un morceau de la barre qui sort d'elle.
 *
 * <p>Deux surfaces l'emploient : la bulle de l'assistant (survol du logo Baitly)
 * et le panneau apparence / langue / devise du pied. Les deux flottaient à dix
 * pixels de la barre, chacune avec sa bordure sur ses quatre côtés et son propre
 * vocabulaire intérieur — une bulle de discussion d'un côté, des lignes de menu
 * dessinées à la main de l'autre. Deux pièces rapportées.</p>
 *
 * <p><b>Ce module porte les deux moitiés de leur unification</b> :</p>
 * <ul>
 *   <li><b>La coquille</b> — {@link sidebarFlyoutClass} et ses deux décalages.
 *       Le volet est posé au RAS de la ligne de la barre, sans bordure ni
 *       arrondi de ce côté-là, et les deux angles de la jonction sont des
 *       raccords CONCAVES qui emmènent la ligne verticale de la barre dans la
 *       bordure horizontale du volet. La peinture vit dans
 *       {@code theme/baitly-nova.css} sous {@code .bui-sidebar-flyout}, où la
 *       construction des congés est commentée.</li>
 *   <li><b>Le contenu</b> — {@link SidebarFlyoutGroup},
 *       {@link SidebarFlyoutRow}, {@link SidebarFlyoutSeparator}. Ce ne sont pas
 *       de nouveaux composants : ce sont les primitives de la BARRE
 *       ({@code SidebarGroup}, {@code SidebarGroupLabel},
 *       {@code SidebarMenuButton}, {@code SidebarSeparator}), à l'identique. Un
 *       volet a donc la même structure HTML qu'une rubrique de navigation
 *       (groupe → intitulé → {@code ul} → {@code li} → bouton), le même rythme
 *       (8 px de groupe, intitulé et lignes à 16 px du bord), la même échelle
 *       typographique et les mêmes jetons {@code --bui-sidebar-*}. Rien à
 *       accorder à la main, rien à faire dériver.</li>
 * </ul>
 *
 * <p>Les intitulés perdent au passage leur capitale et leur graisse
 * {@code bold} : la barre écrit « Administration », pas « ADMINISTRATION ». Les
 * lignes perdent leur survol dessiné à la main au profit du
 * {@code bg-sidebar-accent} des entrées de navigation.</p>
 *
 * <p><b>Les primitives de la barre fonctionnent dans un portail</b> : le volet
 * est portalisé sur {@code body}, mais le contexte React suit l'arbre React, pas
 * le DOM — {@code useSidebar()} répond donc normalement. Mieux : les variantes
 * {@code group-data-[collapsible=icon]} du kit, qui rétréciraient les lignes à un
 * carré de 32 px, ne trouvent pas le {@code group} de la barre hors de son DOM et
 * restent inertes. Un volet garde ses lignes pleines, barre repliée ou non.</p>
 */

/**
 * Décalage qui amène le bord du volet PILE sur la ligne de la barre.
 *
 * <p>8 px = le {@code p-2} de {@code SidebarHeader} / {@code SidebarFooter} :
 * les deux ancres (le bouton du logo, la rangée d'actions du pied) occupent la
 * boîte de CONTENU de ces conteneurs, leur bord extérieur est donc toujours à
 * 8 px de la ligne, barre dépliée comme repliée.</p>
 *
 * <p>8 amènerait le bord du volet PILE sur la ligne. On retire 2 : le volet MORD
 * de deux pixels sur la barre, et recouvre donc la ligne avec de la marge. Posé
 * au pixel près, il laissait passer un liseré au raccord — Radix arrondit la
 * position à la densité de l'affichage, et sur un écran fractionnaire (1,25× /
 * 1,5×) l'arrondi tombe à côté. Recouvrir deux pixels de l'INTÉRIEUR de la barre
 * ne coûte rien, c'est le même fond.</p>
 *
 * <p>⚠️ Ces 2 px se retrouvent dans le {@code left} des congés, qui doivent
 * garder leur arc tangent à la MÉDIANE de la ligne, et dans le {@code min()} de
 * {@code --bui-flyout-cut}. Les trois bougent ensemble ou pas du tout.</p>
 */
export const SIDEBAR_FLYOUT_SEAM_OFFSET = 6;

/**
 * Recul du volet le long de son bord d'alignement.
 *
 * <p>Les congés vivent HORS du volet : ils débordent de 15 px au-dessus et en
 * dessous de lui. Sans ce recul, la bulle du logo — alignée sur le haut du
 * bouton, à 8 px du haut de l'écran — verrait son congé supérieur passer sous le
 * bord de la fenêtre, et le raccord serait coupé net.</p>
 */
export const SIDEBAR_FLYOUT_ALIGN_OFFSET = 16;

/**
 * Classe de la coquille, à passer en {@code className} d'un
 * {@code PopoverContent} / {@code HoverCardContent}, avec {@code gap-0 p-0} : le
 * rythme intérieur vient des groupes, comme dans la barre.
 *
 * <p>Toute la peinture est en CSS plutôt qu'en utilities : les dégradés des
 * congés portent des {@code calc()} à cinq arrêts que la syntaxe de valeur
 * arbitraire de Tailwind ne sait pas écrire (aucune espace permise), et le
 * sélecteur {@code .bui-sidebar-flyout[data-side]} passe devant les
 * {@code cn-popover-content} / {@code cn-hover-card-content} du kit par sa
 * spécificité — donc sans dépendre de l'ordre des règles dans la feuille.</p>
 *
 * <p>Le côté du raccord est lu sur le {@code data-side} que Radix pose sur le
 * contenu : il suit la barre quand elle passe à droite en arabe, et survit à un
 * retournement par détection de collision.</p>
 *
 * <p>⚠️ Ne rien passer d'autre qui touche au fond, à la bordure, au rayon ou à
 * l'ombre : une utility Tailwind vit dans la couche {@code utilities} et
 * repasserait donc DEVANT cette classe, congés compris.</p>
 */
export const sidebarFlyoutClass = 'bui-sidebar-flyout';

interface SidebarFlyoutGroupProps {
  /** Intitulé de la rubrique, rendu comme un intitulé de groupe de la barre. */
  label: React.ReactNode;
  /** Des {@code SidebarMenuItem} — le contenu est une liste. */
  children: React.ReactNode;
}

/** Rubrique d'un volet : même structure qu'un groupe de navigation. */
export function SidebarFlyoutGroup({ label, children }: SidebarFlyoutGroupProps) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>{children}</SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

interface SidebarFlyoutRowProps {
  /** Valeur courante de la rubrique. */
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}

/**
 * Ligne de choix d'un volet : l'entrée de navigation de la barre, cochée.
 *
 * <p>La coche s'ajoute à la surface active, elle ne la remplace pas. Le survol
 * de la barre et son état actif partagent le même {@code bg-sidebar-accent} :
 * sans la coche, passer la souris sur une ligne la rendrait indiscernable de la
 * ligne choisie. Et sur trois rubriques empilées, une coche se balaye du regard
 * bien plus vite qu'un aplat très pâle.</p>
 */
export function SidebarFlyoutRow({ selected, onSelect, children }: SidebarFlyoutRowProps) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={selected} aria-pressed={selected} onClick={onSelect}>
        {children}
        {selected && <Check size={16} strokeWidth={2} className="ms-auto text-primary" />}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/** Filet entre deux rubriques — celui de la barre, retrait de 8 px compris. */
export function SidebarFlyoutSeparator() {
  return <SidebarSeparator />;
}

/**
 * Note de bas de volet (« taux au … »). {@code px-4} pour venir sous l'aplomb
 * des intitulés et des lignes : 8 px du groupe plus 8 px de leur propre retrait.
 */
export function SidebarFlyoutNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 px-4 pb-2 text-xs text-sidebar-foreground/70">{children}</p>
  );
}
