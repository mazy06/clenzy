import React, { useMemo } from 'react';
import { Alert, AlertDescription, Button } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Skeleton } from '../../components/ui';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui';
import { useTranslation } from 'react-i18next';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ExportPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  loading: boolean;
  content: string | null;
  format: 'csv' | 'txt' | 'xml';
  error?: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseCsv(content: string, separator: string): { headers: string[]; rows: string[][] } {
  // Remove BOM if present
  const clean = content.replace(/^\uFEFF/, '');
  const lines = clean.split('\n').filter(line => line.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const parse = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === separator && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parse(lines[0]);
  const rows = lines.slice(1).map(parse);
  return { headers, rows };
}

// ─── Styles ─────────────────────────────────────────────────────────────────

// Entêtes overline / lignes hairline — pattern Tableaux (baseline §2).
// `sticky top-0` + fond OPAQUE : sans le fond, les lignes defileraient par
// transparence sous l'entete fige.
const HEADER_CELL_CLASS =
  'sticky top-0 z-10 bg-[var(--card)] px-2 py-[6px] text-[10.5px] font-bold uppercase tracking-[0.05em] text-[var(--faint)] whitespace-nowrap border-b border-solid border-[var(--line)]';

const BODY_CELL_CLASS =
  'px-2 py-[4px] text-[12px] tabular-nums whitespace-nowrap max-w-[300px] overflow-hidden text-ellipsis';

// ─── Component ──────────────────────────────────────────────────────────────

const ExportPreviewDialog: React.FC<ExportPreviewDialogProps> = ({
  open,
  onClose,
  title,
  loading,
  content,
  format,
  error,
}) => {
  const { t } = useTranslation();

  const parsed = useMemo(() => {
    if (!content) return null;

    if (format === 'xml') {
      return { type: 'xml' as const, text: content };
    }

    // FEC = tab-separated, CSV = comma or semicolon
    const separator = format === 'txt' ? '\t' : (content.includes(';') ? ';' : ',');
    const { headers, rows } = parseCsv(content, separator);
    return { type: 'table' as const, headers, rows };
  }, [content, format]);

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-w-[1536px] h-[85vh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="min-w-0 truncate pe-8">{title}</DialogTitle>
        </DialogHeader>

        {/* `-mx-4` remet le corps a fleur de la modale : l'ancien DialogContent
            MUI etait en `p: 0`, les blocs internes portant leur propre marge. */}
        <div className="-mx-4 flex min-h-0 flex-col overflow-hidden">
        {loading && (
          <div className="p-3 flex flex-col gap-1.5">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-[28px] w-full rounded-[var(--radius-sm)]" />
            ))}
          </div>
        )}

        {error && (
          <div className="p-3">
            <Alert variant="destructive" className="text-[0.8125rem]">
              <TriangleAlert />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        )}

        {!loading && !error && parsed?.type === 'table' && (
          <>
            <div className="px-3 py-1 border-b border-[var(--line)] bg-[var(--surface-2)]">
              <p className="cn-text-body1 text-[11.5px] text-[var(--muted)] tabular-nums">
                {parsed.rows.length} {t('common.lines')} · {parsed.headers.length} {t('common.columns')}
              </p>
            </div>
            {/* stickyHeader : c'est le conteneur INTERNE du primitif Table qui est
                le bloc de defilement (il porte deja overflow-x). La hauteur et le
                defilement vertical doivent donc lui etre poses, sinon les en-tetes
                `sticky` n'ont aucun ancetre scrollable et ne se figent jamais. */}
            <div className="flex-1 min-h-0 [&_[data-slot=table-container]]:h-full [&_[data-slot=table-container]]:overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {parsed.headers.map((h, i) => (
                      <TableHead key={i} className={HEADER_CELL_CLASS}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.rows.map((row, ri) => (
                    <TableRow key={ri} className="even:bg-[var(--hover)]">
                      {row.map((cell, ci) => (
                        <TableCell key={ci} className={BODY_CELL_CLASS} title={cell}>{cell}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {!loading && !error && parsed?.type === 'xml' && (
          <div className="flex-1 overflow-auto p-3">
            <pre style={{ margin: 0, fontSize: '12px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--body)' }}>
              {parsed.text}
            </pre>
          </div>
        )}

        {!loading && !error && !parsed && (
          <div className="flex justify-center items-center flex-1">
            <p className="cn-text-body1 text-[12.5px] text-[var(--muted)]">
              {t('common.noData')}
            </p>
          </div>
        )}
        </div>

        <DialogFooter>
          {/* Apercu en lecture seule : la fermeture reste une action tertiaire. */}
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExportPreviewDialog;
