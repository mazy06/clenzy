import React, { useState } from 'react';
import {
  Box, Typography, Button, IconButton, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Collapse, Tooltip,
} from '@mui/material';
import {
  Receipt, Add, CheckCircle, ExpandMore, ExpandLess,
} from '../../../icons';
import type { LaundryQuote, GenerateLaundryQuoteRequest } from '../../../services/api/propertyInventoryApi';
import { useCurrency } from '../../../hooks/useCurrency';

const STATUS_CONFIG: Record<string, { label: string; color: 'default' | 'warning' | 'success' | 'info' }> = {
  DRAFT: { label: 'Brouillon', color: 'warning' },
  CONFIRMED: { label: 'Confirme', color: 'success' },
  INVOICED: { label: 'Facture', color: 'info' },
};

interface Props {
  quotes: LaundryQuote[];
  hasLaundryItems: boolean;
  canEdit: boolean;
  onGenerate: (data: GenerateLaundryQuoteRequest) => Promise<unknown>;
  onConfirm: (quoteId: number) => Promise<unknown>;
}

export default function LaundryQuotesSection({ quotes, hasLaundryItems, canEdit, onGenerate, onConfirm }: Props) {
  const { convertAndFormat } = useCurrency();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await onGenerate({});
    } finally {
      setGenerating(false);
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box component="span" sx={{ display: 'inline-flex', color: 'warning.main' }}><Receipt size={22} strokeWidth={1.75} /></Box>
          <Box>
            <Typography variant="subtitle1" fontWeight={600}>Devis / Factures blanchisserie</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
              Historique des devis generes pour cette propriete
            </Typography>
          </Box>
        </Box>
        {canEdit && (
          <Button
            size="small"
            startIcon={<Add size={18} strokeWidth={1.75} />}
            onClick={handleGenerate}
            variant="contained"
            disabled={!hasLaundryItems || generating}
          >
            {generating ? 'Generation...' : 'Generer un devis'}
          </Button>
        )}
      </Box>

      {!hasLaundryItems && (
        <Paper sx={{ p: 3, textAlign: 'center', mb: 2, bgcolor: 'action.hover' }}>
          <Typography variant="body2" color="text.secondary">
            Configurez d'abord les articles de linge avant de generer un devis
          </Typography>
        </Paper>
      )}

      {quotes.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Box component="span" sx={{ display: 'inline-flex', color: 'text.disabled', mb: 1 }}><Receipt size={40} strokeWidth={1.5} /></Box>
          <Typography color="text.secondary">Aucun devis genere pour cette propriete</Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 40 }} />
                <TableCell>N°</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Statut</TableCell>
                <TableCell align="right">Total HT</TableCell>
                {canEdit && <TableCell align="right" sx={{ width: 80 }} />}
              </TableRow>
            </TableHead>
            <TableBody>
              {quotes.map((quote) => {
                const statusConf = STATUS_CONFIG[quote.status] ?? STATUS_CONFIG.DRAFT;
                const isExpanded = expandedId === quote.id;

                return (
                  <React.Fragment key={quote.id}>
                    <TableRow hover sx={{ cursor: 'pointer' }} onClick={() => toggleExpand(quote.id)}>
                      <TableCell>
                        <IconButton size="small">
                          {isExpanded ? <ExpandLess size={16} strokeWidth={1.75} /> : <ExpandMore size={16} strokeWidth={1.75} />}
                        </IconButton>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>#{quote.id}</TableCell>
                      <TableCell>{formatDate(quote.generatedAt)}</TableCell>
                      <TableCell>
                        <Chip label={statusConf.label} color={statusConf.color} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        {convertAndFormat(Number(quote.totalHt), quote.currency ?? 'EUR')}
                      </TableCell>
                      {canEdit && (
                        <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                          {quote.status === 'DRAFT' && (
                            <Tooltip title="Confirmer le devis">
                              <Button
                                size="small"
                                variant="outlined"
                                color="success"
                                startIcon={<CheckCircle size={14} strokeWidth={1.75} />}
                                onClick={() => onConfirm(quote.id)}
                                sx={{ fontSize: '0.75rem', py: 0.25 }}
                              >
                                Confirmer
                              </Button>
                            </Tooltip>
                          )}
                        </TableCell>
                      )}
                    </TableRow>

                    {/* Expanded detail */}
                    <TableRow>
                      <TableCell colSpan={canEdit ? 6 : 5} sx={{ p: 0, border: isExpanded ? undefined : 'none' }}>
                        <Collapse in={isExpanded}>
                          <Box sx={{ p: 2, bgcolor: 'action.hover' }}>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>Article</TableCell>
                                  <TableCell align="center">Qte</TableCell>
                                  <TableCell align="right">Prix unitaire</TableCell>
                                  <TableCell align="right">Sous-total</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {quote.lines.map((line, idx) => (
                                  <TableRow key={idx}>
                                    <TableCell>{line.label}</TableCell>
                                    <TableCell align="center">{line.quantity}</TableCell>
                                    <TableCell align="right">{Number(line.unitPrice).toFixed(2)} {'\u20AC'}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 500 }}>
                                      {Number(line.lineTotal).toFixed(2)} {'\u20AC'}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                            {quote.notes && (
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: 'italic' }}>
                                {quote.notes}
                              </Typography>
                            )}
                            {quote.confirmedAt && (
                              <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block' }}>
                                Confirme le {formatDate(quote.confirmedAt)}
                              </Typography>
                            )}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
