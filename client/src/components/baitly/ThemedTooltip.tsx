import * as React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui';

/**
 * Baitly — remaster de components/ThemedTooltip.tsx (MUI Tooltip stylé).
 * Fine façade sur le Tooltip du kit : API compacte { title, children }.
 */
export interface ThemedTooltipProps {
  title: React.ReactNode;
  children: React.ReactElement;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export default function ThemedTooltip({ title, children, side = 'top' }: ThemedTooltipProps) {
  if (!title) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{title}</TooltipContent>
    </Tooltip>
  );
}
