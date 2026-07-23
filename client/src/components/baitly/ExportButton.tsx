import { DownloadIcon, FileTextIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui';
import { exportToCSV, type ExportColumn } from '../../utils/exportUtils';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * Baitly — remaster de components/ExportButton.tsx (MUI).
 * Même logique d'export (utils/exportUtils) ; le Snackbar MUI devient un
 * toast Sonner, le Menu MUI un DropdownMenu du kit.
 */
export interface ExportButtonProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>[];
  columns: ExportColumn[];
  fileName: string;
  disabled?: boolean;
  variant?: 'button' | 'icon' | 'menu';
  formats?: 'csv'[];
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
  const isDisabled = disabled || !data || data.length === 0;

  const handleExportCSV = () => {
    exportToCSV(data, columns, fileName);
    toast.success(t('export.success', 'Export téléchargé'), { description: `${fileName}.csv` });
    onExport?.();
  };

  if (variant === 'icon') {
    return (
      <Button
        size="icon-sm"
        variant="outline"
        aria-label={t('export.label', 'Exporter')}
        disabled={isDisabled}
        onClick={handleExportCSV}
      >
        <DownloadIcon />
      </Button>
    );
  }

  if (variant === 'menu' && formats.length > 0) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" disabled={isDisabled}>
            <DownloadIcon /> {t('export.label', 'Exporter')}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleExportCSV}>
            <FileTextIcon /> CSV
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Button size="sm" variant="outline" disabled={isDisabled} onClick={handleExportCSV}>
      <DownloadIcon /> {t('export.label', 'Exporter')} CSV
    </Button>
  );
}
