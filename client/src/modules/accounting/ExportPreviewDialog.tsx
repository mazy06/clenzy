import React, { useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
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
import { Close as CloseIcon } from '@mui/icons-material';
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

const HEADER_CELL_SX = {
  fontSize: '0.6875rem',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
  color: 'text.secondary',
  whiteSpace: 'nowrap' as const,
  py: 0.75,
  px: 1,
  borderBottom: '2px solid',
  borderColor: 'divider',
} as const;

const BODY_CELL_SX = {
  fontSize: '0.75rem',
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
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5, px: 2 }}>
        <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700 }}>{title}</Typography>
        <IconButton size="small" onClick={onClose} sx={{ ml: 1 }}>
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
            <CircularProgress size={32} />
          </Box>
        )}

        {error && (
          <Box sx={{ p: 2 }}>
            <Alert severity="error" sx={{ fontSize: '0.8125rem' }}>{error}</Alert>
          </Box>
        )}

        {!loading && !error && parsed?.type === 'table' && (
          <>
            <Box sx={{ px: 2, py: 0.75, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.default' }}>
              <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>
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
                    <TableRow key={ri} hover sx={{ '&:nth-of-type(even)': { bgcolor: 'action.hover' } }}>
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
            <pre style={{ margin: 0, fontSize: '0.75rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {parsed.text}
            </pre>
          </Box>
        )}

        {!loading && !error && !parsed && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
            <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>
              {t('common.noData')}
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2, py: 1 }}>
        <Button onClick={onClose} size="small" sx={{ textTransform: 'none', fontSize: '0.75rem' }}>
          {t('common.close')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ExportPreviewDialog;
