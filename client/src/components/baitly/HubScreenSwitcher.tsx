import { useNavigate } from 'react-router-dom';
import { ChevronDownIcon } from 'lucide-react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui';
import { useTranslation } from '../../hooks/useTranslation';
import type { ScreenIdentity } from '../../config/navigationHubs';

/**
 * Baitly — remaster de components/HubScreenSwitcher.tsx (MUI).
 * Identité d'écran : pastille du hub + pilule de bascule entre les écrans
 * frères du hub (DropdownMenu). Réutilise la config navigationHubs réelle.
 */
export interface HubScreenSwitcherProps {
  identity: ScreenIdentity;
}

export default function HubScreenSwitcher({ identity }: HubScreenSwitcherProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (identity.kind === 'single') {
    return (
      <span className="inline-flex h-8 items-center rounded-full border border-border bg-card px-3 text-sm font-medium text-foreground">
        {t(identity.translationKey, identity.fallbackLabel)}
      </span>
    );
  }

  const { hub, tabs, activeTabPath } = identity;
  const active = tabs.find((tab) => tab.path === activeTabPath) ?? tabs[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-full">
          {t(active.translationKey, active.fallbackLabel)}
          <ChevronDownIcon className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>{t(hub.translationKey, hub.fallbackLabel)}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {tabs.map((tab) => (
          <DropdownMenuItem
            key={tab.path}
            data-active={tab.path === activeTabPath || undefined}
            className="data-active:bg-accent data-active:font-medium"
            onClick={() => navigate(tab.path)}
          >
            {t(tab.translationKey, tab.fallbackLabel)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
