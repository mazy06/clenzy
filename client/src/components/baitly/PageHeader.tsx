import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon } from 'lucide-react';
import { Button } from '../ui';
import { cn } from '../../utils/cn';

/**
 * Baitly — remaster de components/PageHeader.tsx (MUI) avec le kit Baitly UI.
 * API équivalente (title/subtitle/iconBadge/titleAdornment/back/actions/filters).
 */
export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Icône dans une pastille soft primaire à gauche du titre. */
  iconBadge?: React.ReactNode;
  /** Élément inline à droite du titre (chip de statut de l'entité). */
  titleAdornment?: React.ReactNode;
  backPath?: string;
  backLabel?: string;
  onBack?: () => void;
  actions?: React.ReactNode;
  /** Slot recherche/filtres, rendu avec les actions sur la ligne du titre. */
  filters?: React.ReactNode;
  showBackButton?: boolean;
  className?: string;
}

export default function PageHeader({
  title,
  subtitle,
  iconBadge,
  titleAdornment,
  backPath,
  backLabel = 'Retour',
  onBack,
  actions,
  filters,
  showBackButton = true,
  className,
}: PageHeaderProps) {
  const navigate = useNavigate();
  const hasBack = showBackButton && (onBack || backPath);

  return (
    <header className={cn('mb-6 flex flex-col gap-2', className)}>
      {hasBack && (
        <Button
          variant="ghost"
          size="sm"
          className="self-start text-muted-foreground"
          onClick={() => (onBack ? onBack() : navigate(backPath as string))}
        >
          <ArrowLeftIcon className="cn-rtl-flip" /> {backLabel}
        </Button>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {iconBadge && (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary [&>svg]:size-5">
              {iconBadge}
            </span>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="cn-font-heading m-0 text-2xl font-semibold tracking-tight text-foreground [text-wrap:balance]">
                {title}
              </h1>
              {titleAdornment}
            </div>
            {subtitle && <p className="m-0 mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {(actions || filters) && (
          <div className="flex flex-wrap items-center gap-2">
            {filters}
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
