import type { ReactNode } from 'react';
import { SlidersHorizontal } from '../../icons/glyphs';
import { Popover, PopoverContent, PopoverTrigger } from '../ui';
import { useMapPanelState } from './MapCardCoordinator';
import { cn } from '../../utils/cn';

/** Filtres métier dans la barre de carte, exclusifs avec ses autres panneaux. */
export default function MapFilterTool({label,active,children,contentClassName}:{label:string;active?:boolean;children:ReactNode;contentClassName?:string}) {
  const [open,setOpen]=useMapPanelState();
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><button type="button" className="baitly-map-tool baitly-map-filter-tool" aria-label={label} title={label} data-active={active||undefined}>
      <SlidersHorizontal size={18} aria-hidden/>{active&&<span aria-hidden className="baitly-map-filter-tool__dot"/>}
    </button></PopoverTrigger>
    <PopoverContent side="bottom" align="center" sideOffset={10} collisionPadding={12} aria-label={label}
      onCloseAutoFocus={event=>event.preventDefault()} className={cn('w-80 max-w-[calc(100vw-24px)] space-y-3 p-3 text-xs',contentClassName)}>
      <h3 className="m-0 text-sm font-semibold">{label}</h3>{children}
    </PopoverContent>
  </Popover>;
}
