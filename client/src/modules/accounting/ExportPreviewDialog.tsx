import React, { useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Skeleton,
  Alert,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
} from '@mui/material';
import { Close as CloseIcon } from '../../icons';
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
const HEADER_CELL_SX = {
  fontSize: '10.5px',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  color: 'var(--faint)',
  whiteSpace: 'nowrap' as const,
  py: 0.75,
  px: 1,
  borderBottom: '1px solid',
  borderColor: 'var(--line)',
  bgcolor: 'var(--card)',
} as const;

const BODY_CELL_SX = {
  fontSize: '12px',
  fontVariantNumeric: 'tabular-nums',
  py: 0.5,
  px: 1,
  whiteSpace: 'nowrap' as const,
  maxWidth: 300,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
} as const;

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
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      PaperProps={{ sx: { height: '85vh', display: 'flex', flexDirection: 'column' } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box component="span" sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</Box>
        <IconButton size="small" onClick={onClose} sx={{ ml: 1 }}>
          <CloseIcon size={18} strokeWidth={1.75} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {loading && (
          <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} variant="rounded" height={28} sx={{ borderRadius: 'var(--radius-sm)' }} />
            ))}
          </Box>
        )}

        {error && (
          <Box sx={{ p: 2 }}>
            <Alert severity="error" sx={{ fontSize: '0.8125rem' }}>{error}</Alert>
          </Box>
        )}

        {!loading && !error && parsed?.type === 'table' && (
          <>
            <Box sx={{ px: 2, py: 0.75, borderBottom: '1px solid', borderColor: 'var(--line)', bgcolor: 'var(--surface-2)' }}>
              <Typography sx={{ fontSize: '11.5px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                {parsed.rows.length} {t('common.lines')} · {parsed.headers.length} {t('common.columns')}
              </Typography>
            </Box>
            <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {parsed.headers.map((h, i) => (
                      <TableCell key={i} sx={HEADER_CELL_SX}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {parsed.rows.map((row, ri) => (
                    <TableRow key={ri} hover sx={{ '&:nth-of-type(even)': { bgcolor: 'var(--hover)' } }}>
                      {row.map((cell, ci) => (
                        <TableCell key={ci} sx={BODY_CELL_SX} title={cell}>{cell}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}

        {!loading && !error && parsed?.type === 'xml' && (
          <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
            <pre style={{ margin: 0, fontSize: '12px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--body)' }}>
              {parsed.text}
            </pre>
          </Box>
        )}

        {!loading && !error && !parsed && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
            <Typography sx={{ fontSize: '12.5px', color: 'var(--muted)' }}>
              {t('common.noData')}
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} size="small">
          {t('common.close')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ExportPreviewDialog;
