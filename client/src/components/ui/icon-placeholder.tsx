import * as React from 'react';
import {
  ArrowDownIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  MinusIcon,
  MoreHorizontalIcon,
  OctagonXIcon,
  PanelLeftIcon,
  SearchIcon,
  TriangleAlertIcon,
  XIcon,
  type IconComponent,
  type IconProps,
} from '../../icons/glyphs';

/**
 * Baitly UI — shim du IconPlaceholder du site shadcn (abstraction
 * multi-bibliothèques d'icônes). Chez nous : lucide uniquement, via un
 * mapping statique (pas d'import namespace → bundle tree-shakeable).
 */
const LUCIDE_MAP: Record<string, IconComponent> = {
  ArrowDownIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  MinusIcon,
  MoreHorizontalIcon,
  OctagonXIcon,
  PanelLeftIcon,
  SearchIcon,
  TriangleAlertIcon,
  XIcon,
};

export interface IconPlaceholderProps extends IconProps {
  lucide: string;
  tabler?: string;
  hugeicons?: string;
  phosphor?: string;
  remixicon?: string;
}

export function IconPlaceholder({
  lucide,
  tabler: _tabler,
  hugeicons: _hugeicons,
  phosphor: _phosphor,
  remixicon: _remixicon,
  ...props
}: IconPlaceholderProps) {
  const Icon = LUCIDE_MAP[lucide] ?? MinusIcon;
  return <Icon {...props} />;
}
