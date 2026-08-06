import React, { useState } from 'react';
import { Button, Tooltip, TooltipContent, TooltipTrigger } from '../../../components/ui';
import { ContentCopy, Check } from '../../../icons';
import { cn } from '../../../utils/cn';

interface DetailFieldProps {
  /** Small uppercase label rendered above the value (Baitly product register). */
  label: string;
  /** Primary value. Falls back to em-dash when empty. */
  value?: React.ReactNode;
  /** Optional value used for copy-to-clipboard. Defaults to `value` when it's a string. */
  copyValue?: string;
  /** Optional inline icon next to the label. */
  icon?: React.ReactNode;
  /** Optional href to render the value as an `<a>` (mailto / tel / external). */
  href?: string;
  /** Tone for the value text. Default = primary text. */
  tone?: 'default' | 'muted';
  /** Use tabular-nums (dates, ids, phone). */
  monospace?: boolean;
}

/**
 * One labeled field. Used inside `DetailSection` for consistent typography across the
 * user details page (and reusable elsewhere).
 *
 * Notes:
 * - Avoids the "centered KPI tile" template — left-aligned, single column.
 * - Optional copy button gives an inline action without a modal-first reflex.
 */
const DetailField: React.FC<DetailFieldProps> = ({
  label,
  value,
  copyValue,
  icon,
  href,
  tone = 'default',
  monospace = false,
}) => {
  const [copied, setCopied] = useState(false);
  const isEmpty = value === undefined || value === null || value === '';

  const copyableString = copyValue ?? (typeof value === 'string' ? value : undefined);
  const canCopy = !!copyableString && !isEmpty;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!copyableString) return;
    try {
      await navigator.clipboard.writeText(copyableString);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — no-op */
    }
  };

  // Couleur portee par une CLASSE et non par `style` : le lien a un hover, et un
  // style inline battrait la regle de survol.
  const valueColorClass = isEmpty
    ? 'text-faint'
    : tone === 'muted'
      ? 'text-muted-foreground'
      : 'text-foreground';

  const isLink = !!href && !isEmpty;

  const valueClass = cn(
    'min-w-0 truncate text-sm font-medium',
    '[transition:color_150ms_ease] motion-reduce:transition-none',
    valueColorClass,
    monospace && 'tabular-nums',
    isLink && 'no-underline hover:text-primary hover:underline',
  );

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-0.5 mb-0.5">
        {icon && (
          <span className="inline-flex text-muted-foreground opacity-60">
            {icon}
          </span>
        )}
        <span className="text-[0.6875rem] font-semibold tracking-[0.04em] uppercase text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="flex items-center gap-0.5 min-w-0">
        {isLink ? (
          <a href={href} className={valueClass}>
            {value}
          </a>
        ) : (
          <span className={valueClass}>{isEmpty ? '—' : value}</span>
        )}
        {canCopy && (
          <Tooltip>
            {/* Le Button du kit ne transmet pas de ref : span intermediaire pour l'ancrage du tooltip. */}
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className={cn('size-5', copied ? 'text-success' : 'text-faint')}
                  onClick={handleCopy}
                  aria-label={copied ? 'Copié' : `Copier ${label}`}
                >
                  {copied ? (
                    <Check size={14} strokeWidth={2} />
                  ) : (
                    <ContentCopy size={13} strokeWidth={1.75} />
                  )}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{copied ? 'Copié' : 'Copier'}</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
};

export default DetailField;
