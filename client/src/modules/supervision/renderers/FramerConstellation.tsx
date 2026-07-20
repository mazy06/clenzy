/* ============================================================
   FramerConstellation — 1er renderer (framer-motion + SVG/DOM)

   - Ambiance continue (orbite, contre-rotation, lueur, pulsations) = CSS
     (emotion keyframes), coupée par `prefers-reduced-motion` et figée au
     survol / focus.
   - Transitions pilotées (apparition « le ciel s'allume », survol, tracé
     des faisceaux) = framer-motion, désactivées via useReducedMotion.

   Reçoit une vue normalisée (cf. ConstellationRenderer). Aucune logique
   métier ici : présentation pure, swappable.
   ============================================================ */

import { memo, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';
import { useTheme } from '@mui/material/styles';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from '../../../hooks/useTranslation';
import { Close } from '../../../icons';
import { AGENT_META, STATUS } from '../constants';
import { computeConstellationLayout } from '../core/geometry';
import { useElementSize } from '../core/useElementSize';
import { AgentIcon } from './agentIcon';
import BaitlyMarkLogo from '../../../components/BaitlyMarkLogo';
import type { ConstellationRendererProps } from './ConstellationRenderer';
import type { AgentId, AgentStatus } from '../types';

// ─── Keyframes (ambiance — CSS) ──────────────────────────────────────────────

const spin = keyframes`from { transform: rotate(0); } to { transform: rotate(360deg); }`;
const spinRev = keyframes`from { transform: rotate(0); } to { transform: rotate(-360deg); }`;
const glowBreathe = keyframes`
  0%, 100% { opacity: .6; transform: translate(-50%, -50%) scale(.92); }
  50% { opacity: 1; transform: translate(-50%, -50%) scale(1.12); }`;
const coreBeat = keyframes`
  0%, 100% { opacity: 0; transform: scale(1); }
  50% { opacity: .55; transform: scale(1.1); }`;
const hb = keyframes`0%, 100% { transform: scale(1); } 50% { transform: scale(1.25); }`;
const livePulse = keyframes`0% { transform: scale(.7); opacity: .7; } 100% { transform: scale(2.4); opacity: 0; }`;
const stPulse = keyframes`0% { transform: scale(1); opacity: .8; } 100% { transform: scale(2.4); opacity: 0; }`;
const waitRing = keyframes`0% { transform: scale(.78); opacity: .7; } 100% { transform: scale(1.5); opacity: 0; }`;
// flux le long du faisceau actif : la délégation « streame » du cœur vers l'agent
const beamFlow = keyframes`from { stroke-dashoffset: 0; } to { stroke-dashoffset: -20; }`;
// tiroir bas du mode compact : glisse depuis le bas (ease-out quint)
const sheetUp = keyframes`from { transform: translateY(14%); opacity: 0; } to { transform: none; opacity: 1; }`;

// ─── Canvas sombre (tokens handoff §7) ───────────────────────────────────────

const Root = styled.div<{ $flush?: boolean }>`
  position: relative;
  /* Fluide : la constellation remplit la hauteur DISPONIBLE de son parent
     (l'accordéon Planning est déjà responsive) au lieu d'une hauteur fixe qui
     déborde en bas sur les petits écrans et laisse du vide en haut sur les
     grands. La géométrie (computeConstellationLayout) se recalcule sur la
     taille MESURÉE (useElementSize) → agents/anneaux/faisceaux se replacent.
       • flex:1 1 auto → remplit la colonne flex du SupervisionPanel (Planning) ;
       • min-height   → plancher pour les parents SANS hauteur définie
                        (portefeuille, démos) où flex/height:100% ne résout pas. */
  flex: 1 1 auto;
  min-height: 380px;
  /* Pleine cellule (Planning) : pas de coins arrondis ni d'ombre portée → le
     canvas couvre tout l'accordéon sans laisser d'espace vide autour. Sinon :
     carte arrondie flottante (vues standalone / portefeuille). */
  border-radius: ${(p) => (p.$flush ? '0' : '16px')};
  overflow: hidden;
  background: radial-gradient(125% 100% at 50% 42%, #313a7e 0%, #1b2052 44%, #0c0e2a 100%);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06),
    inset 0 -90px 120px -60px rgba(6, 7, 24, 0.55),
    inset 0 0 160px -40px rgba(6, 7, 24, 0.5)${(p) => (p.$flush ? '' : ', 0 18px 44px -20px rgba(13, 15, 44, 0.7)')};
  @media (max-width: 600px) {
    min-height: 340px;
  }

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 0;
    opacity: 0.55;
    background-image: radial-gradient(1.4px 1.4px at 18% 24%, rgba(255, 255, 255, 0.7), transparent),
      radial-gradient(1.2px 1.2px at 72% 18%, rgba(255, 255, 255, 0.55), transparent),
      radial-gradient(1.3px 1.3px at 38% 72%, rgba(255, 255, 255, 0.5), transparent),
      radial-gradient(1.1px 1.1px at 86% 64%, rgba(255, 255, 255, 0.5), transparent),
      radial-gradient(1.2px 1.2px at 58% 88%, rgba(255, 255, 255, 0.45), transparent),
      radial-gradient(1px 1px at 8% 78%, rgba(255, 255, 255, 0.5), transparent),
      radial-gradient(1px 1px at 92% 36%, rgba(255, 255, 255, 0.4), transparent),
      radial-gradient(1.1px 1.1px at 30% 12%, rgba(255, 255, 255, 0.45), transparent);
  }

  /* anneaux d'autonomie — statiques, dimensionnés en JS, étiquetés */
  .cst__rings {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    z-index: 1;
  }
  .cst__ring {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    border: 1px dashed rgba(159, 165, 255, 0.14);
  }
  .cst__ring[data-auto='notify'] {
    border-color: rgba(159, 165, 255, 0.18);
  }
  .cst__ring[data-auto='full'] {
    border-color: rgba(159, 165, 255, 0.22);
  }
  .cst__ringlbl {
    position: absolute;
    top: -9px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(208, 213, 246, 0.85);
    background: rgba(12, 14, 42, 0.88);
    border: 1px solid rgba(159, 165, 255, 0.12);
    padding: 2px 8px;
    border-radius: 999px;
    white-space: nowrap;
  }

  /* couche en orbite (faisceaux + satellites) */
  .cst__spin {
    position: absolute;
    inset: 0;
    z-index: 3;
    animation: ${spin} 200s linear infinite;
  }
  .cst__sats {
    position: absolute;
    inset: 0;
  }
  .beams {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 1;
    overflow: visible;
  }
  .wire {
    fill: none;
    stroke-linecap: round;
  }
  .wire.idle {
    stroke: rgba(159, 165, 255, 0.18);
    stroke-width: 1.2;
    stroke-dasharray: 1 7;
  }
  /* PERF : pas de filter: drop-shadow sur les faisceaux — ils vivent dans la
     couche en ROTATION continue, le filtre repeignait la zone à chaque frame
     (audit perf). Le halo est rendu par un léger épaississement du trait. */
  .wire.think {
    stroke: #9b9bf0;
    stroke-width: 2.2;
    stroke-dasharray: 4 5;
  }
  .wire.act {
    stroke: #37d98a;
    stroke-width: 2.6;
  }
  .wire.wait {
    stroke: #f0b24b;
    stroke-width: 2.4;
  }
  .wire.esc {
    stroke: #ff5a5f;
    stroke-width: 2.4;
  }
  .wire.err {
    stroke: #dc2626;
    stroke-width: 2.6;
  }
  /* flux animé : paquet qui file du cœur vers l'agent (délégation en direct) */
  .wire-flow {
    fill: none;
    stroke-linecap: round;
    stroke-width: 2.6;
    stroke-dasharray: 4 16;
    animation: ${beamFlow} 1.5s linear infinite;
  }
  .wire-flow.act {
    stroke: #7cffc0;
  }
  .wire-flow.think {
    stroke: #c7c7ff;
  }
  .wire-flow.wait {
    stroke: #ffd27a;
  }
  .wire-flow.esc {
    stroke: #ff8a8e;
  }
  .wire-flow.err {
    stroke: #ff6b6b;
  }

  /* satellites */
  .sat {
    position: absolute;
    transform: translate(-50%, -50%);
    z-index: 4;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
  }
  .sat:not(.on) {
    opacity: 0.62;
  }
  .sat__c {
    display: flex;
    flex-direction: column;
    align-items: center;
    animation: ${spinRev} 200s linear infinite;
  }
  .sat__core {
    position: relative;
    width: 50px;
    height: 50px;
  }
  .sat__av {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    box-shadow: 0 6px 18px -6px rgba(0, 0, 0, 0.6);
    will-change: transform;
  }
  .sat__av.com {
    background: linear-gradient(180deg, #6e9bf2, #3b6fe0);
  }
  .sat__av.rev {
    background: linear-gradient(180deg, #9d82f0, #7c5ce0);
  }
  .sat__av.ops {
    background: linear-gradient(180deg, #3fc4b0, #1f9e8d);
  }
  .sat__av.fin {
    background: linear-gradient(180deg, #e0a05a, #c77d2e);
  }
  .sat__av.rep {
    background: linear-gradient(180deg, #ec6f9e, #d6457e);
  }
  .sat.act .sat__av {
    box-shadow: 0 0 28px 5px rgba(55, 217, 138, 0.5);
  }
  .sat.wait .sat__av {
    box-shadow: 0 0 30px 6px rgba(240, 178, 75, 0.55);
  }
  .sat.think .sat__av {
    box-shadow: 0 0 24px 4px rgba(124, 124, 236, 0.45);
  }
  .sat.esc .sat__av {
    box-shadow: 0 0 28px 5px rgba(255, 90, 95, 0.5);
  }
  .sat.err .sat__av {
    box-shadow: 0 0 30px 6px rgba(220, 38, 38, 0.55);
  }
  .sat:not(.on) .sat__av {
    filter: saturate(0.6) brightness(0.92);
  }
  .sat__stat {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 2.5px solid #141833;
    background: #6b7196;
  }
  .sat__stat.act {
    background: #37d98a;
  }
  .sat__stat.wait {
    background: #f0b24b;
  }
  .sat__stat.think {
    background: #9b9bf0;
  }
  .sat__stat.esc {
    background: #ff5a5f;
  }
  .sat__stat.err {
    background: #dc2626;
  }
  .sat__stat.act::after {
    content: '';
    position: absolute;
    inset: -4px;
    border-radius: 50%;
    border: 2px solid #37d98a;
    opacity: 0;
    animation: ${stPulse} 1.6s ease-out infinite;
  }
  .sat__stat.esc::after,
  .sat__stat.err::after {
    content: '';
    position: absolute;
    inset: -4px;
    border-radius: 50%;
    border: 2px solid currentColor;
    color: #ff5a5f;
    opacity: 0;
    animation: ${stPulse} 1.6s ease-out infinite;
  }
  .sat__stat.err::after {
    color: #dc2626;
  }
  .sat__badge {
    position: absolute;
    top: -7px;
    right: -7px;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 9px;
    background: #141833;
    border: 2px solid #1b2052;
    color: #fff;
    font-size: 11px;
    font-weight: 800;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    font-variant-numeric: tabular-nums;
  }
  .sat__ring {
    position: absolute;
    inset: -9px;
    border-radius: 50%;
    border: 2px solid #f0b24b;
    opacity: 0.6;
    pointer-events: none;
    animation: ${waitRing} 1.8s ease-out infinite;
  }
  /* halo de progression « Réfléchit » (progression streamée) */
  .sat__prog {
    position: absolute;
    inset: -4px;
    width: 58px;
    height: 58px;
    transform: rotate(-90deg);
    pointer-events: none;
  }
  .sat__progtrack {
    fill: none;
    stroke: rgba(159, 165, 255, 0.18);
    stroke-width: 2.5;
  }
  .sat__progbar {
    fill: none;
    stroke: #9b9bf0;
    stroke-width: 2.5;
    stroke-linecap: round;
    transition: stroke-dashoffset 0.5s ease;
  }
  /* label SOUS l'avatar, en absolu : il ne décale plus le centre du satellite,
     donc l'ancre (left/top) = centre de l'avatar = cible exacte du faisceau
     → le trait reste radial (« aiguille d'horloge ») quelle que soit la rotation. */
  .sat__nm {
    position: absolute;
    top: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    font-size: 11.5px;
    font-weight: 700;
    color: #e7e9fb;
    /* PERF : pas de backdrop-filter ici — ces labels ORBITENT en continu, un
       blur forçait la re-rasterisation du fond à chaque frame (jank constaté à
       l'audit). Plaque semi-opaque plate à la place. */
    background: rgba(30, 34, 72, 0.92);
    border: 1px solid rgba(255, 255, 255, 0.07);
    padding: 3px 10px;
    border-radius: 8px;
    white-space: nowrap;
  }
  .sat:not(.on) .sat__nm {
    color: #c2c7ea;
    background: rgba(255, 255, 255, 0.07);
    border-color: transparent;
  }
  /* Le tooltip d'agent est PORTALISÉ dans <body> (cf. rendu React) pour passer
     au-dessus du canvas (overflow) et du planning — plus de tooltip CSS ici. */
  .sat:hover,
  .sat:focus-visible {
    z-index: 11;
    outline: none;
  }
  .sat:focus-visible .sat__av {
    box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.85);
  }

  /* cœur orchestrateur */
  .cst__center {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    z-index: 6;
    display: flex;
    flex-direction: column;
    align-items: center;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
  }
  .cst__coreglow {
    position: absolute;
    top: 33px;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 150px;
    height: 150px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(124, 124, 236, 0.45), rgba(124, 124, 236, 0) 68%);
    animation: ${glowBreathe} 5s ease-in-out infinite;
    pointer-events: none;
  }
  &.focus .cst__coreglow {
    background: radial-gradient(circle, rgba(124, 124, 236, 0.7), rgba(124, 124, 236, 0) 66%);
  }
  .cst__core {
    width: 66px;
    height: 66px;
    border-radius: 50%;
    background: radial-gradient(120% 120% at 32% 28%, #9b9bf6, #5b5bd6 60%, #4a45c0);
    box-shadow: inset 0 0 0 4px rgba(255, 255, 255, 0.22), 0 6px 18px -4px rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 2;
    color: #fff;
    transition: transform 0.3s;
  }
  .cst__core::after {
    content: '';
    position: absolute;
    inset: -9px;
    border-radius: 50%;
    border: 1.5px solid rgba(159, 165, 255, 0.45);
    opacity: 0;
    animation: ${coreBeat} 3.4s ease-in-out infinite;
  }
  .cst__center:hover .cst__core,
  .cst__center:focus-visible .cst__core {
    transform: scale(1.06);
    outline: none;
  }
  /* pastille « Orchestrator » révélée au survol / focus du cœur uniquement */
  .cst__center:hover .cst__pill,
  .cst__center:focus-visible .cst__pill {
    opacity: 1;
    visibility: visible;
    transform: translateX(-50%) translateY(0);
  }
  /* pill en absolu SOUS le cœur : sinon elle rallonge la colonne .cst__center
     et décentre l'orbe par rapport à (cx,cy) = origine des faisceaux → angles
     non radiaux (visible surtout sur l'agent tiré au centre). */
  .cst__pill {
    position: absolute;
    top: calc(100% + 14px);
    left: 50%;
    transform: translateX(-50%) translateY(4px);
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transition: opacity 0.2s ease, transform 0.2s ease;
    z-index: 2;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    background: rgba(12, 14, 42, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 999px;
    padding: 6px 14px;
    font-size: 12.5px;
    font-weight: 800;
    color: #fff;
    box-shadow: 0 6px 16px -6px rgba(0, 0, 0, 0.6);
  }
  .cst__pilldot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #9b9bf6;
    box-shadow: 0 0 0 3px rgba(124, 124, 236, 0.3);
    animation: ${hb} 2.6s ease-in-out infinite;
  }

  /* HUD résumé (haut-gauche) */
  /* Colonne haut-gauche : empile le HUD et le flux « En direct » dessous. */
  .cst__topleft {
    position: absolute;
    top: 16px;
    left: 16px;
    z-index: 6;
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: min(300px, calc(100% - 32px));
    max-height: calc(100% - 32px);
  }
  .cst__hud {
    position: relative;
    /* PERF : pas de backdrop-filter — le HUD recouvre la constellation animée,
       un blur re-rasterisait le canvas à chaque frame. Fond quasi opaque. */
    background: rgba(20, 24, 58, 0.92);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 13px;
    padding: 11px 15px;
    box-shadow: 0 10px 28px -14px rgba(0, 0, 0, 0.6);
    flex-shrink: 0;
  }
  /* Flux « En direct » sous le HUD : carte translucide, hauteur bornée + scroll. */
  .cst__belowhud {
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .cst__hudtop {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    font-weight: 800;
    color: #fff;
  }
  /* Bouton « Scanner » (icône) posé à droite du titre du HUD. */
  .cst__hudaction {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
  }
  .cst__pulse {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #37d98a;
    position: relative;
  }
  .cst__pulse::after {
    content: '';
    position: absolute;
    inset: -4px;
    border-radius: 50%;
    border: 1.5px solid #37d98a;
    opacity: 0;
    animation: ${livePulse} 2s ease-out infinite;
  }
  &.offline .cst__pulse {
    background: #6b7196;
  }
  &.offline .cst__pulse::after {
    display: none;
  }
  /* hors-ligne : le ciel se ternit */
  &.offline .cst__sats,
  &.offline .beams {
    opacity: 0.5;
    filter: saturate(0.4);
    transition: opacity 0.4s ease, filter 0.4s ease;
  }
  .cst__hudrow {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-top: 6px;
    font-size: 12px;
    color: #c8cdf0;
  }
  .cst__hudrow b {
    color: #fff;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
  .cst__hudrow b.amber {
    color: #f0b24b;
  }
  .cst__hudrow i {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: rgba(174, 180, 224, 0.5);
  }
  /* Bilan de valeur dans le HUD (fenêtre = zoom planning) : séparé par un filet,
     titre discret + une ligne de 3 métriques (réutilise la grammaire hudrow). */
  .cst__hudbilan {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(174, 180, 224, 0.18);
  }
  .cst__hudbilanhead {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #9aa0cc;
  }
  /* Sélecteur de fenêtre du bilan (Jour/Sem./Quinz./Mois) — segments compacts. */
  .cst__winseg {
    display: inline-flex;
    gap: 2px;
    padding: 2px;
    border-radius: 8px;
    background: rgba(174, 180, 224, 0.12);
  }
  .cst__winseg button {
    appearance: none;
    border: 0;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 6px;
    font: inherit;
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.02em;
    text-transform: none;
    color: #aab0dc;
    background: transparent;
    transition: color 160ms ease, background-color 160ms ease;
  }
  .cst__winseg button:hover {
    color: #e7e9fb;
  }
  .cst__winseg button.on {
    color: #fff;
    background: rgba(123, 128, 232, 0.55);
  }
  .cst__winseg button:focus-visible {
    outline: 2px solid #9b9bf6;
    outline-offset: 1px;
  }
  /* 3 métriques empilées (valeur au-dessus, label dessous) : la valeur ne casse
     jamais (≈7 h 28, 0 %) et les labels tiennent sur une ligne, sans élargir le HUD. */
  .cst__hudbilanrow {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;
    margin-top: 6px;
    font-size: 12px;
    color: #c8cdf0;
  }
  .cst__hudstat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    text-align: center;
  }
  .cst__hudbilanrow b {
    color: #fff;
    font-weight: 800;
    font-size: 14px;
    line-height: 1.1;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .cst__hudstat span {
    font-size: 10px;
    line-height: 1.15;
    white-space: nowrap;
    opacity: 0.72;
  }
  .cst__attention {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    padding: 3px 9px;
    border-radius: 999px;
    background: rgba(255, 90, 95, 0.16);
    border: 1px solid rgba(255, 90, 95, 0.4);
    color: #ffb4b6;
    font-size: 11px;
    font-weight: 800;
  }
  .cst__attentiondot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #ff5a5f;
    box-shadow: 0 0 0 3px rgba(255, 90, 95, 0.25);
  }

  /* ── Mode COMPACT (conteneur étroit) : rail de pastilles + tiroir bas ──
     Les surcouches (HUD / En direct / HITL) se replient en 3 pastilles en haut
     du canvas ; un clic ouvre un tiroir bas avec le contenu complet. La
     constellation reste dégagée. PERF : mêmes contraintes que le HUD — fonds
     quasi opaques, JAMAIS de backdrop-filter au-dessus du canvas animé. */
  .cst__rail {
    position: absolute;
    top: 12px;
    left: 12px;
    right: 12px;
    /* au-dessus du voile du tiroir (z 8) : on peut basculer directement
       d'un tiroir à l'autre sans refermer d'abord */
    z-index: 9;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .cst__cpill {
    appearance: none;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 7px 12px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(20, 24, 58, 0.92);
    color: #e7e9fb;
    font: inherit;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 8px 22px -12px rgba(0, 0, 0, 0.6);
    transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease;
  }
  .cst__cpill:hover {
    background: rgba(30, 34, 72, 0.96);
  }
  .cst__cpill:focus-visible {
    outline: 2px solid #9b9bf6;
    outline-offset: 2px;
  }
  .cst__cpill.on {
    border-color: rgba(155, 155, 246, 0.8);
    background: rgba(51, 48, 124, 0.96);
    color: #fff;
  }
  .cst__cpill--hitl {
    border-color: rgba(240, 178, 75, 0.45);
    color: #ffd9a0;
  }
  .cst__cpill--hitl.on {
    border-color: #f0b24b;
    background: rgba(84, 60, 16, 0.92);
    color: #ffe3b8;
  }
  .cst__cpillcount {
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 9px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: #f0b24b;
    color: #3c2a05;
    font-size: 11px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
  /* alerte (esc/err) sur la pastille Orchestrateur repliée */
  .cst__cpillalert {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #ff5a5f;
    box-shadow: 0 0 0 3px rgba(255, 90, 95, 0.25);
  }
  /* voile cliquable derrière le tiroir : ferme au tap hors du tiroir */
  .cst__sheetveil {
    position: absolute;
    inset: 0;
    z-index: 8;
    border: 0;
    padding: 0;
    background: rgba(6, 7, 24, 0.35);
    cursor: default;
  }
  .cst__sheet {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 9;
    max-height: 68%;
    display: flex;
    flex-direction: column;
    background: rgba(20, 24, 58, 0.97);
    border-top: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 16px 16px 0 0;
    box-shadow: 0 -14px 38px -18px rgba(0, 0, 0, 0.7);
    animation: ${sheetUp} 0.22s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .cst__sheethandle {
    width: 36px;
    height: 4px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.22);
    margin: 8px auto 2px;
    flex-shrink: 0;
  }
  .cst__sheethead {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px 8px;
    flex-shrink: 0;
    font-size: 13px;
    font-weight: 800;
    color: #fff;
  }
  .cst__sheetclose {
    margin-left: auto;
    appearance: none;
    border: 0;
    background: transparent;
    color: #aab0dc;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  .cst__sheetclose:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
  }
  .cst__sheetclose:focus-visible {
    outline: 2px solid #9b9bf6;
  }
  .cst__sheetbody {
    padding: 0 14px 14px;
    overflow-y: auto;
    min-height: 0;
    overscroll-behavior: contain;
  }
  /* Le HUD réutilisé DANS le tiroir : on aplatit sa carte (le tiroir est déjà
     une surface) et on masque la légende-tooltip (hover inexistant au tactile,
     et elle serait rognée par le scroll du corps). */
  .cst__sheet .cst__hud {
    background: transparent;
    border: none;
    box-shadow: none;
    padding: 0;
  }
  .cst__sheet .cst__legend {
    display: none;
  }
  /* Idem pour la carte du flux « En direct » (belowHud) : aplatie dans le
     tiroir (pas de carte-dans-carte), titre masqué (déjà en en-tête). */
  .cst__sheet [data-feed-card] {
    background: transparent;
    border: none;
    box-shadow: none;
    border-radius: 0;
  }
  .cst__sheet [data-feed-title] {
    display: none;
  }

  /* légende + indice focus */
  /* Légende = tooltip révélé au survol du HUD, ancré juste dessous. */
  .cst__legend {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    z-index: 8;
    display: flex;
    align-items: center;
    gap: 14px;
    white-space: nowrap;
    background: #14183a;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 999px;
    padding: 7px 16px;
    box-shadow: 0 12px 30px -14px rgba(0, 0, 0, 0.55);
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transform: translateY(-4px);
    transition: opacity 0.18s ease, transform 0.18s ease, visibility 0.18s ease;
  }
  .cst__hud:hover .cst__legend,
  .cst__hud:focus-within .cst__legend {
    opacity: 1;
    visibility: visible;
    transform: none;
    pointer-events: auto;
  }
  .cst__lg {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 600;
    color: #d6daf6;
  }
  .dotsmall {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }
  .dotsmall.act {
    background: #37d98a;
  }
  .dotsmall.wait {
    background: #f0b24b;
  }
  .dotsmall.think {
    background: #9b9bf0;
  }
  .dotsmall.veil {
    background: #6b7196;
  }
  .cst__focushint {
    position: absolute;
    bottom: 18px;
    right: 18px;
    z-index: 6;
    font-size: 10.5px;
    font-weight: 600;
    color: #9aa1d6;
  }
  &.focus .cst__focushint {
    color: #9b9bf6;
  }

  /* mode focus : la délégation active passe en avant, le reste recule */
  &.focus .sat:not(.act):not(.wait) {
    opacity: 0.24;
  }
  &.focus .wire.idle,
  &.focus .wire.think {
    opacity: 0.1;
  }

  /* pause : on fige l'orbite, on neutralise le pouls « en direct » */
  &.paused .cst__spin,
  &.paused .sat__c {
    animation-play-state: paused;
  }

  /* Survol RÉEL d'un agent ou du cœur uniquement (pas l'espace vide autour) :
     on FIGE l'orbite → l'agent reste immobile, donc le tooltip portalisé (dont
     la position est calculée à l'entrée du survol) reste bien ancré. Le survol
     de la zone vide ne déclenche rien → la constellation continue de tourner.
     La pause explicite reste gérée par la classe .paused ci-dessus. */
  &:has(.sat:hover) .cst__spin,
  &:has(.sat:hover) .sat__c,
  &:has(.sat:focus-visible) .cst__spin,
  &:has(.sat:focus-visible) .sat__c,
  &:has(.cst__center:hover) .cst__spin,
  &:has(.cst__center:hover) .sat__c {
    animation-play-state: paused;
  }

  /* ── Mode CLAIR (adaptatif) : le clair est le DÉFAUT de l'app (aucun attribut
        data-theme sur <html> ; seul le sombre pose [data-theme="dark"]). On cible
        donc html:not([data-theme='dark']) — surtout PAS [data-theme='light'] qui
        ne matche jamais. Sans hook → safe pour les tests. ── */
  html:not([data-theme='dark']) & {
    background: radial-gradient(125% 100% at 50% 42%, #ffffff 0%, #eef3f6 58%, #e1e9ed 100%);
    box-shadow: inset 0 0 0 1px rgba(43, 63, 73, 0.1),
      inset 0 -70px 90px -60px rgba(120, 140, 155, 0.16),
      0 18px 44px -26px rgba(43, 63, 73, 0.22);
  }
  html:not([data-theme='dark']) &::before {
    opacity: 0;
  }
  html:not([data-theme='dark']) & .cst__ring {
    border-color: rgba(107, 138, 154, 0.28);
  }
  html:not([data-theme='dark']) & .cst__ring[data-auto='notify'] {
    border-color: rgba(107, 138, 154, 0.34);
  }
  html:not([data-theme='dark']) & .cst__ring[data-auto='full'] {
    border-color: rgba(107, 138, 154, 0.4);
  }
  html:not([data-theme='dark']) & .cst__ringlbl {
    color: #3c5563;
    background: rgba(255, 255, 255, 0.82);
    border-color: rgba(43, 63, 73, 0.12);
  }
  html:not([data-theme='dark']) & .cst__coreglow {
    background: radial-gradient(circle, rgba(91, 91, 214, 0.22), rgba(91, 91, 214, 0) 68%);
  }
  html:not([data-theme='dark']) & .cst__hud,
  html:not([data-theme='dark']) & .cst__legend {
    background: rgba(255, 255, 255, 0.85);
    border-color: rgba(43, 63, 73, 0.1);
  }
  /* Tooltip légende : fond OPAQUE (surcharge la règle glass ci-dessus). */
  html:not([data-theme='dark']) & .cst__legend {
    background: #ffffff;
    border-color: rgba(43, 63, 73, 0.14);
  }
  html:not([data-theme='dark']) & .cst__hudtop,
  html:not([data-theme='dark']) & .cst__hudrow b {
    color: #1c2b33;
  }
  html:not([data-theme='dark']) & .cst__hudrow,
  html:not([data-theme='dark']) & .cst__lg {
    color: #4a6373;
  }
  html:not([data-theme='dark']) & .cst__hudrow i {
    background: rgba(43, 63, 73, 0.4);
  }
  html:not([data-theme='dark']) & .cst__hudbilan {
    border-top-color: rgba(43, 63, 73, 0.12);
  }
  html:not([data-theme='dark']) & .cst__hudbilanhead {
    color: #5d7a8a;
  }
  html:not([data-theme='dark']) & .cst__hudbilanrow b {
    color: #1c2b33;
  }
  html:not([data-theme='dark']) & .cst__hudbilanrow {
    color: #4a6373;
  }
  html:not([data-theme='dark']) & .cst__winseg {
    background: rgba(43, 63, 73, 0.08);
  }
  html:not([data-theme='dark']) & .cst__winseg button {
    color: #5d7a8a;
  }
  html:not([data-theme='dark']) & .cst__winseg button:hover {
    color: #1c2b33;
  }
  html:not([data-theme='dark']) & .cst__winseg button.on {
    color: #fff;
    background: #5b5bd6;
  }
  html:not([data-theme='dark']) & .cst__focushint {
    color: #5d7a8a;
  }
  html:not([data-theme='dark']) &.focus .cst__focushint {
    color: #5b5bd6;
  }
  html:not([data-theme='dark']) & .sat__nm {
    color: #2b3a44;
    background: rgba(255, 255, 255, 0.92);
    border-color: rgba(43, 63, 73, 0.1);
  }
  html:not([data-theme='dark']) & .sat:not(.on) .sat__nm {
    color: #5d7a8a;
  }
  /* Pastille de statut : en sombre l'anneau #141833 se fond dans le ciel ; en
     clair il faut un anneau clair (sinon il lit comme un contour noir). */
  html:not([data-theme='dark']) & .sat__stat {
    border-color: #ffffff;
    box-shadow: 0 1px 3px rgba(43, 63, 73, 0.18);
  }
  html:not([data-theme='dark']) & .sat__badge {
    background: #ffffff;
    border-color: rgba(43, 63, 73, 0.14);
    color: #1c2b33;
  }
  html:not([data-theme='dark']) & .wire.idle {
    stroke: rgba(43, 63, 73, 0.42);
    stroke-width: 1.5;
    stroke-dasharray: 2 6;
  }
  /* Faisceaux actifs (thème clair) : ligne de base FINE et nette = « rail ». */
  html:not([data-theme='dark']) & .wire.act {
    stroke: #1f9e8d;
    filter: none;
    stroke-width: 2;
  }
  html:not([data-theme='dark']) & .wire.think {
    stroke: #7c5ce0;
    filter: none;
    stroke-width: 1.8;
  }
  html:not([data-theme='dark']) & .wire.wait {
    stroke: #c77d2e;
    filter: none;
    stroke-width: 2;
  }
  html:not([data-theme='dark']) & .wire.esc {
    stroke: #d8453d;
    filter: none;
    stroke-width: 2;
  }
  html:not([data-theme='dark']) & .wire.err {
    stroke: #c0392b;
    filter: none;
    stroke-width: 2;
  }
  /* Paquet « en transit » (thème clair) : trait CLAIR et FIN qui file sur le
     rail — nettement distinct de la couleur de base → lisible et net. */
  html:not([data-theme='dark']) & .wire-flow {
    stroke-width: 1.4;
  }
  html:not([data-theme='dark']) & .wire-flow.act {
    stroke: #baf5e0;
  }
  html:not([data-theme='dark']) & .wire-flow.think {
    stroke: #e0d6ff;
  }
  html:not([data-theme='dark']) & .wire-flow.wait {
    stroke: #ffe4bd;
  }
  html:not([data-theme='dark']) & .wire-flow.esc {
    stroke: #ffd3d1;
  }
  html:not([data-theme='dark']) & .wire-flow.err {
    stroke: #ffd0cb;
  }
  html:not([data-theme='dark']) & .cst__attention {
    background: rgba(220, 38, 38, 0.1);
    border-color: rgba(220, 38, 38, 0.38);
    color: #a32d2d;
  }
  html:not([data-theme='dark']) & .cst__cpill {
    background: rgba(255, 255, 255, 0.92);
    border-color: rgba(43, 63, 73, 0.14);
    color: #2b3a44;
    box-shadow: 0 8px 22px -14px rgba(43, 63, 73, 0.35);
  }
  html:not([data-theme='dark']) & .cst__cpill:hover {
    background: #ffffff;
  }
  html:not([data-theme='dark']) & .cst__cpill.on {
    background: #5b5bd6;
    border-color: #5b5bd6;
    color: #fff;
  }
  html:not([data-theme='dark']) & .cst__cpill--hitl {
    border-color: rgba(199, 125, 46, 0.5);
    color: #8a5a1d;
  }
  html:not([data-theme='dark']) & .cst__cpill--hitl.on {
    background: #c77d2e;
    border-color: #c77d2e;
    color: #fff;
  }
  html:not([data-theme='dark']) & .cst__cpillcount {
    background: #c77d2e;
    color: #fff;
  }
  html:not([data-theme='dark']) & .cst__cpill.on .cst__cpillcount {
    background: rgba(255, 255, 255, 0.24);
  }
  html:not([data-theme='dark']) & .cst__sheetveil {
    background: rgba(43, 63, 73, 0.25);
  }
  html:not([data-theme='dark']) & .cst__sheet {
    background: #ffffff;
    border-top-color: rgba(43, 63, 73, 0.12);
    box-shadow: 0 -14px 38px -22px rgba(43, 63, 73, 0.4);
  }
  html:not([data-theme='dark']) & .cst__sheethandle {
    background: rgba(43, 63, 73, 0.18);
  }
  html:not([data-theme='dark']) & .cst__sheethead {
    color: #1c2b33;
  }
  html:not([data-theme='dark']) & .cst__sheetclose {
    color: #5d7a8a;
  }
  html:not([data-theme='dark']) & .cst__sheetclose:hover {
    background: rgba(43, 63, 73, 0.08);
    color: #1c2b33;
  }

  @media (prefers-reduced-motion: reduce) {
    .cst__spin,
    .sat__c,
    .cst__coreglow,
    .cst__core::after,
    .cst__pilldot,
    .cst__pulse::after,
    .sat__stat.act::after,
    .sat__stat.esc::after,
    .sat__stat.err::after,
    .sat__ring,
    .wire-flow,
    .cst__sheet {
      animation: none !important;
    }
  }
`;

function statusScale(status: AgentStatus, active: boolean): number {
  if (status === 'act') return 1.14;
  if (status === 'esc' || status === 'err') return 1.08; // attention
  if (!active) return 0.78; // veille atténué/réduit (mais lisible)
  return 1;
}

/** Fenêtres du bilan (jours) proposées dans le HUD — « Jour » en plus du zoom planning. */
const REPORT_WINDOWS: { days: number; key: string; fallback: string }[] = [
  { days: 1, key: 'supervision.report.win.day', fallback: 'Jour' },
  { days: 7, key: 'supervision.report.win.week', fallback: 'Sem.' },
  { days: 15, key: 'supervision.report.win.fortnight', fallback: 'Quinz.' },
  { days: 30, key: 'supervision.report.win.month', fallback: 'Mois' },
];

function FramerConstellationInner({
  agents,
  hud,
  online,
  paused,
  focused,
  onToggleFocus,
  onSelectAgent,
  headerAction,
  report,
  reportWindow,
  onReportWindowChange,
  belowHud,
  compact,
  hitl,
  hitlCount,
  flush,
}: ConstellationRendererProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const prefersReduced = useReducedMotion();
  const [ref, size] = useElementSize<HTMLDivElement>();

  // Mode compact : quel tiroir est ouvert (un seul à la fois, null = fermé).
  const [sheet, setSheet] = useState<'hud' | 'live' | 'hitl' | null>(null);
  const toggleSheet = (key: 'hud' | 'live' | 'hitl') => setSheet((s) => (s === key ? null : key));

  // Tooltip d'agent PORTALISÉ dans <body> : le canvas est en `overflow:hidden`
  // et vit dans une pile z-index basse → un tooltip CSS interne serait rogné en
  // haut ET passerait SOUS les cellules du planning. Le portail le sort du
  // conteneur avec un z-index très élevé. La position est figée à l'entrée du
  // survol (l'orbite se met en pause sur `:hover` → l'agent reste immobile).
  const [tip, setTip] = useState<{ id: AgentId; x: number; y: number } | null>(null);
  const openTip = (id: AgentId, el: HTMLElement) => {
    const anchor = (el.querySelector('.sat__core') as HTMLElement | null) ?? el;
    const r = anchor.getBoundingClientRect();
    setTip({ id, x: r.left + r.width / 2, y: r.top });
  };

  const byId = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);
  const layout = useMemo(
    () =>
      computeConstellationLayout(
        agents.map((a) => ({ id: a.id, status: a.status, autonomy: a.autonomy })),
        size,
      ),
    [agents, size],
  );

  const attentionCount = agents.filter((a) => a.status === 'esc' || a.status === 'err').length;

  const rootClass = ['cst', 'night', focused ? 'focus' : '', online ? '' : 'offline', paused ? 'paused' : '']
    .filter(Boolean)
    .join(' ');

  // Carte HUD « Orchestrateur » — rendue dans la colonne haut-gauche (desktop)
  // OU dans le tiroir bas (mode compact), à l'identique.
  const hudCard = (
    <div className="cst__hud">
      <div className="cst__hudtop">
        <span className="cst__pulse" />
        <span className="cst__hudtitle">
          {t('supervision.hud.orchestrator')} · {online ? t('supervision.hud.active') : t('supervision.states.offline')}
        </span>
        {headerAction ? <span className="cst__hudaction">{headerAction}</span> : null}
      </div>
      <div className="cst__hudrow">
        <b>{hud.agentsCount}</b> {t('supervision.hud.agents')}
        <i />
        <b>{hud.actingCount}</b> {t('supervision.hud.acting')}
        <i />
        <b className="amber">{hud.awaitingCount}</b> {t('supervision.hud.awaiting')}
      </div>
      {/* Bilan de valeur — fenêtre alignée sur le zoom du planning. */}
      {report && (
        <div className="cst__hudbilan">
          <div className="cst__hudbilanhead">
            <span className="cst__hudbilantitle">{t('supervision.report.titleBase', 'Bilan')}</span>
            {onReportWindowChange ? (
              <span className="cst__winseg" role="group" aria-label={t('supervision.report.titleBase', 'Bilan')}>
                {REPORT_WINDOWS.map((opt) => (
                  <button
                    key={opt.days}
                    type="button"
                    className={(reportWindow ?? report.windowDays) === opt.days ? 'on' : ''}
                    aria-pressed={(reportWindow ?? report.windowDays) === opt.days}
                    onClick={() => onReportWindowChange(opt.days)}
                  >
                    {t(opt.key, opt.fallback)}
                  </button>
                ))}
              </span>
            ) : (
              <span>· {t('supervision.report.windowDays', {
                count: report.windowDays,
                defaultValue: '{{count}} jours',
              })}</span>
            )}
          </div>
          <div className="cst__hudbilanrow">
            <div className="cst__hudstat">
              <b>{report.estimatedTimeSaved}</b>
              <span>{t('supervision.report.timeSaved', 'Temps gagné')}</span>
            </div>
            <div className="cst__hudstat">
              <b>{report.autoActions}</b>
              <span>{t('supervision.report.autoActions', 'Actions auto')}</span>
            </div>
            <div className="cst__hudstat">
              <b>{Math.round(report.acceptanceRate * 100)} %</b>
              <span>{t('supervision.report.acceptance', 'Acceptation')}</span>
            </div>
          </div>
        </div>
      )}
      {attentionCount > 0 && (
        <div className="cst__attention">
          <span className="cst__attentiondot" />
          {t('supervision.attention', { count: attentionCount })}
        </div>
      )}
      {/* Légende des statuts — révélée en tooltip au SURVOL du HUD (masquée dans le tiroir). */}
      <div className="cst__legend" role="tooltip">
        <span className="cst__lg">
          <i className="dotsmall act" />
          {t('supervision.legend.acting')}
        </span>
        <span className="cst__lg">
          <i className="dotsmall wait" />
          {t('supervision.legend.awaiting')}
        </span>
        <span className="cst__lg">
          <i className="dotsmall think" />
          {t('supervision.legend.thinking')}
        </span>
        <span className="cst__lg">
          <i className="dotsmall veil" />
          {t('supervision.legend.idle')}
        </span>
      </div>
    </div>
  );

  // Titre du tiroir ouvert (mode compact).
  const sheetTitle =
    sheet === 'hud'
      ? t('supervision.hud.orchestrator')
      : sheet === 'live'
        ? t('supervision.feed.title')
        : t('supervision.compact.hitl', 'À traiter');

  return (
    <Root ref={ref} $flush={flush} className={rootClass} data-supervision-constellation role="group" aria-label={t('supervision.title')}>
      {/* anneaux d'autonomie étiquetés (statiques) — ancrés au centre VISUEL
          (layout.cx/cy, remonté) et non au centre CSS 50% : sinon anneaux et
          satellites/faisceaux (coords géométriques) se désalignent. */}
      <div
        className="cst__rings"
        aria-hidden="true"
        style={layout.width > 0 ? { left: layout.cx, top: layout.cy } : undefined}
      >
        {layout.rings.map((ring) => (
          <span
            key={ring.autonomy}
            className="cst__ring"
            data-auto={ring.autonomy}
            style={{ width: 2 * ring.radius, height: 2 * ring.radius }}
          >
            <span className="cst__ringlbl">{t(`supervision.autonomyShort.${ring.autonomy}`)}</span>
          </span>
        ))}
      </div>

      {/* couche en orbite : faisceaux + satellites.
          IMPORTANT : la rotation doit pivoter autour du centre VISUEL (cx, cy,
          remonté), le MÊME que celui des anneaux — sinon les satellites orbitent
          autour du centre CSS (height/2) tandis que les anneaux sont centrés plus
          haut → les pastilles dérivent hors de leur anneau selon l'angle. */}
      <div
        className="cst__spin"
        style={layout.width > 0 ? { transformOrigin: `${layout.cx}px ${layout.cy}px` } : undefined}
      >
        <svg
          className="beams"
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          width={layout.width}
          height={layout.height}
          aria-hidden="true"
        >
          {layout.beams.map((b) => (
            <motion.path
              key={b.id}
              className={`wire ${b.active ? b.status : 'idle'}`}
              d={`M ${b.x1} ${b.y1} L ${b.x2} ${b.y2}`}
              initial={prefersReduced ? false : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: b.active ? 0.9 : 0.2 }}
              transition={{ duration: prefersReduced ? 0 : 0.8, delay: prefersReduced ? 0 : 0.2 }}
            />
          ))}
          {/* flux « délégation en direct » — uniquement sur les faisceaux actifs, off en reduced-motion */}
          {!prefersReduced &&
            layout.beams.flatMap((b) =>
              b.active
                ? [<path key={`flow-${b.id}`} className={`wire-flow ${b.status}`} d={`M ${b.x1} ${b.y1} L ${b.x2} ${b.y2}`} />]
                : [],
            )}
        </svg>

        <div className="cst__sats">
          {layout.satellites.map((s, i) => {
            const view = byId.get(s.id);
            const meta = AGENT_META[s.id];
            const name = t(meta.nameKey);
            const statusLabel = t(STATUS[s.status].labelKey);
            const target = statusScale(s.status, s.active);
            const hoverScale = prefersReduced ? target : Math.max(target, 1.12);
            const progress =
              s.status === 'think' && view?.thinkingProgress != null
                ? Math.max(0, Math.min(100, view.thinkingProgress))
                : null;
            const PROG_R = 26;
            const PROG_C = 2 * Math.PI * PROG_R;
            return (
              <button
                key={s.id}
                type="button"
                className={`sat ${s.status} ${s.active ? 'on' : ''}`}
                data-agent={s.id}
                data-status={s.status}
                style={{ left: s.x, top: s.y }}
                aria-label={`${name} · ${statusLabel}`}
                aria-describedby={`sat-tip-${s.id}`}
                onMouseEnter={(e) => openTip(s.id, e.currentTarget)}
                onMouseLeave={() => setTip(null)}
                onFocus={(e) => openTip(s.id, e.currentTarget)}
                onBlur={() => setTip(null)}
                onClick={() => onSelectAgent?.(s.id)}
              >
                <span className="sat__c">
                  <span className="sat__core">
                    <motion.span
                      className={`sat__av ${s.id}`}
                      initial={prefersReduced ? false : { opacity: 0, scale: 0.4 }}
                      animate={{ opacity: 1, scale: target }}
                      whileHover={{ scale: hoverScale }}
                      transition={{ duration: prefersReduced ? 0 : 0.5, delay: prefersReduced ? 0 : i * 0.06 }}
                    >
                      <AgentIcon token={meta.icon} size={24} />
                      <span className={`sat__stat ${s.status}`} />
                      {view?.badge != null && view.badge > 0 && (
                        <span className="sat__badge">{view.badge}</span>
                      )}
                    </motion.span>
                    {s.status === 'wait' && <span className="sat__ring" />}
                    {progress != null && (
                      <svg className="sat__prog" viewBox="0 0 58 58" aria-hidden="true">
                        <circle className="sat__progtrack" cx="29" cy="29" r={PROG_R} />
                        <circle
                          className="sat__progbar"
                          cx="29"
                          cy="29"
                          r={PROG_R}
                          style={{ strokeDasharray: PROG_C, strokeDashoffset: PROG_C * (1 - progress / 100) }}
                        />
                      </svg>
                    )}
                  </span>
                  <span className="sat__nm">{name}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* cœur orchestrateur — clic = mode focus */}
      <button
        type="button"
        className="cst__center"
        data-core
        style={layout.width > 0 ? { left: layout.cx, top: layout.cy } : undefined}
        onClick={onToggleFocus}
        aria-pressed={focused}
        aria-label={t('supervision.hud.orchestrator')}
      >
        <span className="cst__coreglow" />
        <span className="cst__core">
          <BaitlyMarkLogo variant="mark" colorMode="inherit" size={40} />
        </span>
        <span className="cst__pill">
          <span className="cst__pilldot" />
          {t('supervision.hud.orchestrator')}
        </span>
      </button>

      {/* Desktop : colonne haut-gauche — HUD résumé (« Orchestrateur · actif »)
          + flux « En direct » empilé juste dessous (slot belowHud). */}
      {!compact && (
        <div className="cst__topleft">
          {hudCard}
          {belowHud ? <div className="cst__belowhud">{belowHud}</div> : null}
        </div>
      )}

      {/* Compact : rail de pastilles — la constellation reste dégagée, chaque
          surcouche s'ouvre au clic dans le tiroir bas. */}
      {compact && (
        <div className="cst__rail">
          <button
            type="button"
            className={`cst__cpill${sheet === 'hud' ? ' on' : ''}`}
            aria-expanded={sheet === 'hud'}
            onClick={() => toggleSheet('hud')}
          >
            <span className="cst__pulse" />
            {t('supervision.hud.orchestrator')}
            {attentionCount > 0 && <span className="cst__cpillalert" />}
          </button>
          {belowHud ? (
            <button
              type="button"
              className={`cst__cpill${sheet === 'live' ? ' on' : ''}`}
              aria-expanded={sheet === 'live'}
              onClick={() => toggleSheet('live')}
            >
              <span className="cst__pilldot" />
              {t('supervision.feed.title')}
            </button>
          ) : null}
          {hitl && (hitlCount ?? 0) > 0 ? (
            <button
              type="button"
              className={`cst__cpill cst__cpill--hitl${sheet === 'hitl' ? ' on' : ''}`}
              aria-expanded={sheet === 'hitl'}
              onClick={() => toggleSheet('hitl')}
            >
              {t('supervision.compact.hitl', 'À traiter')}
              <span className="cst__cpillcount">{hitlCount}</span>
            </button>
          ) : null}
        </div>
      )}

      {/* Compact : tiroir bas (un seul ouvert à la fois) + voile de fermeture.
          La constellation reste visible et animée au-dessus du tiroir. */}
      {compact && sheet && (
        <>
          <button
            type="button"
            className="cst__sheetveil"
            aria-label={t('common.close', 'Fermer')}
            onClick={() => setSheet(null)}
          />
          <div className="cst__sheet" role="dialog" aria-label={sheetTitle}>
            <span className="cst__sheethandle" aria-hidden="true" />
            <div className="cst__sheethead">
              {sheetTitle}
              {sheet === 'hitl' && (hitlCount ?? 0) > 0 ? (
                <span className="cst__cpillcount">{hitlCount}</span>
              ) : null}
              <button
                type="button"
                className="cst__sheetclose"
                aria-label={t('common.close', 'Fermer')}
                onClick={() => setSheet(null)}
              >
                <Close size={16} />
              </button>
            </div>
            {/* data-vertical-scroll : le planning ne détourne pas la molette ici. */}
            <div className="cst__sheetbody" data-vertical-scroll>
              {sheet === 'hud' ? hudCard : sheet === 'live' ? belowHud : hitl}
            </div>
          </div>
        </>
      )}

      {!compact && <div className="cst__focushint">{t('supervision.hud.focusHint')}</div>}

      {/* Tooltip PORTALISÉ dans <body> (position:fixed) → au-dessus du canvas
          (overflow) ET du planning (z-index très élevé). Ancré au-dessus de
          l'avatar survolé. */}
      {tip &&
        typeof document !== 'undefined' &&
        (() => {
          const meta = AGENT_META[tip.id];
          const view = byId.get(tip.id);
          if (!view) return null;
          // Couleurs pilotées par le thème (le tooltip doit suivre le PMS :
          // clair sur thème clair, sombre sur thème sombre).
          const dark = theme.palette.mode === 'dark';
          const tipBg = dark ? '#141833' : theme.palette.background.paper;
          const tipFg = dark ? '#fff' : theme.palette.text.primary;
          const tipBorder = dark ? 'rgba(255,255,255,.1)' : theme.palette.divider;
          const tipSub = dark ? '#c8cdf0' : theme.palette.text.secondary;
          const tipMeta = dark ? '#9aa1d6' : theme.palette.text.disabled;
          const shadowAlpha = dark ? 0.75 : 0.28;
          return createPortal(
            <div
              role="tooltip"
              id={`sat-tip-${tip.id}`}
              style={{
                position: 'fixed',
                left: tip.x,
                top: tip.y - 12,
                transform: 'translate(-50%, -100%)',
                zIndex: 4000,
                minWidth: 184,
                maxWidth: 234,
                background: tipBg,
                color: tipFg,
                border: `1px solid ${tipBorder}`,
                borderRadius: 11,
                padding: '11px 13px',
                fontSize: 11.5,
                lineHeight: 1.45,
                textAlign: 'left',
                pointerEvents: 'none',
                boxShadow: `0 16px 38px -12px rgba(15,23,42,${shadowAlpha})`,
              }}
            >
              <b style={{ fontWeight: 600 }}>{t(meta.nameKey)}</b>
              {` · ${t(STATUS[view.status].labelKey)}`}
              {view.task ? (
                <span style={{ display: 'block', color: tipSub, marginTop: 4 }}>{view.task}</span>
              ) : null}
              <em
                style={{
                  display: 'block',
                  color: tipMeta,
                  fontStyle: 'normal',
                  fontSize: 10.5,
                  marginTop: 6,
                  paddingTop: 6,
                  borderTop: `1px solid ${tipBorder}`,
                }}
              >
                {t('supervision.autonomy.' + view.autonomy)}
              </em>
            </div>,
            document.body,
          );
        })()}
    </Root>
  );
}

/**
 * Mémoïsé (audit perf) : le renderer est le plus gros sous-arbre du panneau —
 * sans memo, chaque re-render du parent (report chargé, event SSE sans lien
 * avec les agents, toast) redessinait tout le canvas (layout géométrique inclus).
 */
export const FramerConstellation = memo(FramerConstellationInner);
