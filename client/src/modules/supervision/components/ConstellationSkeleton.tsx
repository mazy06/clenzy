/* ============================================================
   ConstellationSkeleton — état de chargement (« le ciel s'allume »)

   Même canvas sombre que la constellation, cœur qui respire + libellé,
   en attendant le snapshot. prefers-reduced-motion : pas de pulsation.
   ============================================================ */

import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';
import { useTranslation } from '../../../hooks/useTranslation';

const glowBreathe = keyframes`
  0%, 100% { opacity: .5; transform: translate(-50%, -50%) scale(.92); }
  50% { opacity: .9; transform: translate(-50%, -50%) scale(1.12); }`;
const dim = keyframes`0%, 100% { opacity: .55; } 50% { opacity: 1; }`;

const Root = styled.div<{ $flush?: boolean }>`
  position: relative;
  /* Pleine cellule (Planning) : le skeleton REMPLIT l'accordéon exactement
     comme la constellation chargée (même sticky box tirée à gauche) → pas de
     couture avec la zone colonne pendant « Connecting to agents… ». Sinon :
     carte 560px arrondie (vues standalone / portefeuille). */
  height: ${(p) => (p.$flush ? '100%' : '560px')};
  min-height: ${(p) => (p.$flush ? '380px' : 'auto')};
  border-radius: ${(p) => (p.$flush ? '0' : '16px')};
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  background: radial-gradient(125% 100% at 50% 42%, #313a7e 0%, #1b2052 44%, #0c0e2a 100%);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06)${(p) => (p.$flush ? '' : ', 0 18px 44px -20px rgba(13, 15, 44, 0.7)')};
  @media (max-width: 600px) {
    height: ${(p) => (p.$flush ? '100%' : '460px')};
  }
  html:not([data-theme='dark']) & {
    background: radial-gradient(125% 100% at 50% 42%, #ffffff 0%, #eef3f6 58%, #e1e9ed 100%);
    box-shadow: inset 0 0 0 1px rgba(43, 63, 73, 0.1), 0 18px 44px -26px rgba(43, 63, 73, 0.2);
  }
  html:not([data-theme='dark']) & .sk__label {
    color: #5d7a8a;
  }

  .sk__glow {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 150px;
    height: 150px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(124, 124, 236, 0.4), rgba(124, 124, 236, 0) 68%);
    animation: ${glowBreathe} 2.4s ease-in-out infinite;
  }
  .sk__core {
    position: relative;
    z-index: 1;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: radial-gradient(120% 120% at 32% 28%, #9b9bf6, #5b5bd6 60%, #4a45c0);
    box-shadow: inset 0 0 0 4px rgba(255, 255, 255, 0.18);
  }
  .sk__label {
    position: relative;
    z-index: 1;
    font-size: 12.5px;
    font-weight: 700;
    color: #aeb4e0;
    animation: ${dim} 1.8s ease-in-out infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    .sk__glow,
    .sk__label {
      animation: none;
    }
  }
`;

export function ConstellationSkeleton({ flush }: { flush?: boolean } = {}) {
  const { t } = useTranslation();
  return (
    <Root data-supervision-skeleton $flush={flush} role="status" aria-live="polite">
      <span className="sk__glow" />
      <span className="sk__core" />
      <span className="sk__label">{t('supervision.states.loading')}</span>
    </Root>
  );
}
