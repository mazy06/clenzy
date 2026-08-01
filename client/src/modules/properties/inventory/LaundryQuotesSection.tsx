import React, { useState } from 'react';
import { Card } from '../../../components/ui';
import { Button, IconButton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Collapse, Tooltip } from '@mui/material';
import {
  Receipt, Add, CheckCircle, ExpandMore, ExpandLess,
} from '../../../icons';
import type { LaundryQuote, GenerateLaundryQuoteRequest } from '../../../services/api/propertyInventoryApi';
import { Money } from '../../../components/Money';
import StatusChip, { type StatusTone } from '../../../components/StatusChip';

const STATUS_CONFIG: Record<string, { label: string; tone: StatusTone }> = {
  DRAFT: { label: 'Brouillon', tone: 'warn' },
  CONFIRMED: { label: 'Confirme', tone: 'ok' },
  INVOICED: { label: 'Facture', tone: 'info' },
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

interface Props {
  quotes: LaundryQuote[];
  hasLaundryItems: boolean;
  canEdit: boolean;
  onGenerate: (data: GenerateLaundryQuoteRequest) => Promise<unknown>;
  onConfirm: (quoteId: number) => Promise<unknown>;
}

export default function LaundryQuotesSection({ quotes, hasLaundryItems, canEdit, onGenerate, onConfirm }: Props) {
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

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex text-[var(--bui-warning-ink)]"><Receipt size={22} strokeWidth={1.75} /></span>
          <div>
            <h6 className="cn-text-subtitle1 font-semibold">Devis / Factures blanchisserie</h6>
            <p className="cn-text-body2 text-muted-foreground text-[0.8rem]">
              Historique des devis generes pour cette propriete
            </p>
          </div>
        </div>
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
      </div>

      {!hasLaundryItems && (
        <Card className="gap-0 py-0 p-4 text-center mb-3 bg-[var(--hover)]">
          <p className="cn-text-body2 text-muted-foreground">
            Configurez d'abord les articles de linge avant de generer un devis
          </p>
        </Card>
      )}

      {quotes.length === 0 ? (
        <Card className="gap-0 py-0 p-6 text-center">
          <span className="inline-flex text-muted-foreground opacity-60 mb-1.5"><Receipt size={40} strokeWidth={1.5} /></span>
          <p className="cn-text-body1 text-muted-foreground">Aucun devis genere pour cette propriete</p>
        </Card>
      ) : (
        <TableContainer component="div" className="overflow-x-auto rounded-xl border border-border bg-card">
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
                        <StatusChip tone={statusConf.tone} label={statusConf.label} />
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        <Money value={Number(quote.totalHt)} from={quote.currency ?? 'EUR'} />
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
                          <div className="p-3 bg-[var(--hover)]">
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
                                {quote.lines.map((line) => (
                                  <TableRow key={line.key}>
                                    <TableCell>{line.label}</TableCell>
                                    <TableCell align="center">{line.quantity}</TableCell>
                                    <TableCell align="right"><Money value={Number(line.unitPrice)} from="EUR" /></TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 500 }}>
                                      <Money value={Number(line.lineTotal)} from="EUR" />
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                            {quote.notes && (
                              <p className="cn-text-body2 text-muted-foreground mt-1.5 italic">
                                {quote.notes}
                              </p>
                            )}
                            {quote.confirmedAt && (
                              <span className="cn-text-caption text-muted-foreground opacity-60 mt-0.5 block">
                                Confirme le {formatDate(quote.confirmedAt)}
                              </span>
                            )}
                          </div>
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
    </div>
  );
}
