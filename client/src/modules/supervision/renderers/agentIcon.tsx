/* ============================================================
   Mapping jeton d'icône → composant (lucide-react / Iconify)

   AGENT_META porte un jeton sémantique ; le rendu concret vit ici,
   dans la couche de rendu. Tout passe par le barrel ../../../icons
   (pas d'import direct lucide-react, cf. icons/README).
   ============================================================ */

import { Chat, TrendingUp, BroomFill, Payments, Star } from '../../../icons';
import type { AgentIconToken } from '../constants';

interface AgentIconProps {
  token: AgentIconToken;
  size?: number;
  strokeWidth?: number;
}

export function AgentIcon({ token, size = 24, strokeWidth = 2 }: AgentIconProps) {
  switch (token) {
    case 'chat':
      return <Chat size={size} strokeWidth={strokeWidth} />;
    case 'trend-up':
      return <TrendingUp size={size} strokeWidth={strokeWidth} />;
    case 'broom':
      return <BroomFill size={size} />; // glyphe Phosphor (Iconify) — pas de stroke
    case 'bank':
      return <Payments size={size} strokeWidth={strokeWidth} />;
    case 'star':
      return <Star size={size} strokeWidth={strokeWidth} />;
    default:
      return null;
  }
}
