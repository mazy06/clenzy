import React from 'react';
import {
  Download as DownloadIcon,
  Description as CsvIcon,
} from '../icons';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from './ui';
import { exportToCSV, type ExportColumn } from '../utils/exportUtils';
import { useTranslation } from '../hooks/useTranslation';
import { useNotification } from '../hooks/useNotification';
import { useHeaderCompact } from './compactHeaderActions';

interface ExportButtonProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>[];
  columns: ExportColumn[];
  fileName: string;
  disabled?: boolean;
  variant?: 'button' | 'icon' | 'menu';
  formats?: ('csv')[];
  onExport?: () => void;
}

export default function ExportButton({
  data,
  columns,
  fileName,
  disabled = false,
  variant = 'button',
  formats = ['csv'],
  onExport,
}: ExportButtonProps) {
  const { t } = useTranslation();
  const { notify } = useNotification();
  // Dans la barre de titre, tout se présente en icône : ce composant rend ses
  // boutons lui-même, la réduction ne peut pas l'atteindre — il s'y range seul.
  const compact = useHeaderCompact();
  const effectiveVariant = compact && variant === 'button' ? 'icon' : variant;

  const isDataEmpty = !data || data.length === 0;
  const isDisabled = disabled || isDataEmpty;

  const handleExportCSV = () => {
    exportToCSV(data, columns, fileName);
    notify.success(t('export.success'), 3000);
    onExport?.();
  };

  const tooltipTitle = isDataEmpty ? t('export.noData') : '';

  if (effectiveVariant === 'icon') {
    const iconLabel = isDataEmpty ? t('export.noData') : t('export.button');
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {/* Le span porte le declencheur : un bouton desactive n'emet plus
              d'evenement de survol, le tooltip ne s'ouvrirait jamais. */}
          <span className="inline-flex">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleExportCSV}
              disabled={isDisabled}
              aria-label={iconLabel}
              // Dans la barre de titre, aucun bouton n'a de contour : ce serait
              // le seul encadre de la rangee. Ailleurs, l'encadre le detache du
              // contenu qui l'entoure.
              className={compact ? 'disabled:opacity-45' : 'rounded-md border border-solid border-border text-muted-foreground hover:bg-muted hover:border-faint hover:text-foreground disabled:opacity-45'}
            >
              <DownloadIcon size={16} strokeWidth={1.75} />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{iconLabel}</TooltipContent>
      </Tooltip>
    );
  }

  if (effectiveVariant === 'menu') {
    const trigger = (
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={isDisabled}
        >
          <DownloadIcon size={13} strokeWidth={1.75} />
          {t('export.button')}
        </Button>
      </DropdownMenuTrigger>
    );
    return (
      <DropdownMenu>
        {tooltipTitle ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">{trigger}</span>
            </TooltipTrigger>
            <TooltipContent>{tooltipTitle}</TooltipContent>
          </Tooltip>
        ) : trigger}
        <DropdownMenuContent align="end" className="w-auto min-w-[10rem]">
          {formats.includes('csv') && (
            <DropdownMenuItem onSelect={handleExportCSV} className="text-[0.8125rem]">
              <CsvIcon size={16} strokeWidth={1.75} />
              {t('export.csv')}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Default: variant === 'button'
  const exportButton = (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExportCSV}
      disabled={isDisabled}
      title={t('export.button')}
    >
      <DownloadIcon size={13} strokeWidth={1.75} />
      {t('export.button')}
    </Button>
  );
  if (!tooltipTitle) return exportButton;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{exportButton}</span>
      </TooltipTrigger>
      <TooltipContent>{tooltipTitle}</TooltipContent>
    </Tooltip>
  );
}
