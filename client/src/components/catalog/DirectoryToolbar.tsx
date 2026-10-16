import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';
import './baitlyDirectory.css';

export function DirectoryToolbar({ children }: { children: ReactNode }) {
  return <div className="baitly-directory-toolbar">{children}</div>;
}

export function DirectorySegments({ label, children }: { label?: string; children: ReactNode }) {
  return <div className="inline-flex overflow-hidden rounded-md border border-border" role="group" aria-label={label}>{children}</div>;
}

export function DirectorySegment({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: ReactNode;
}) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={cn(
    'inline-flex cursor-pointer items-center gap-1.5 border-s border-border px-3 py-1.5 text-xs font-medium first:border-s-0',
    'transition-colors duration-150 outline-none focus-visible:ring-[2px] focus-visible:ring-inset focus-visible:ring-ring/50 motion-reduce:transition-none',
    active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
  )}>{children}</button>;
}
