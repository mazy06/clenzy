import React, { useState } from 'react';
import {
  Alert,
  AlertDescription,
  Button,
  Collapsible,
  CollapsibleContent,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../components/ui';
import { cn } from '../../../utils/cn';
import {
  Receipt, Add, CheckCircle, ExpandMore, ExpandLess,
} from '../../../icons';
import type { LaundryQuote, GenerateLaundryQuoteRequest } from '../../../services/api/propertyInventoryApi';
import { Money } from '../../../components/Money';
import EmptyState from '../../../components/EmptyState';
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
          <span className="inline-flex text-warning"><Receipt size={22} strokeWidth={1.75} /></span>
          <div>
            <h6 className="text-sm font-semibold tracking-tight">Devis / Factures blanchisserie</h6>
            <p className="text-xs text-muted-foreground">
              Historique des devis generes pour cette propriete
            </p>
          </div>
        </div>
        {canEdit && (
          <Button size="sm" onClick={handleGenerate} disabled={!hasLaundryItems || generating}>
            <Add size={18} strokeWidth={1.75} />
            {generating ? 'Generation...' : 'Generer un devis'}
          </Button>
        )}
      </div>

      {!hasLaundryItems && (
        <Alert className="mb-3">
          <AlertDescription>
            Configurez d'abord les articles de linge avant de generer un devis
          </AlertDescription>
        </Alert>
      )}

      {quotes.length === 0 ? (
        <EmptyState
          icon={<Receipt />}
          title="Aucun devis genere pour cette propriete"
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-solid border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>N°</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-end">Total HT</TableHead>
                {canEdit && <TableHead className="text-end w-20" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.map((quote) => {
                const statusConf = STATUS_CONFIG[quote.status] ?? STATUS_CONFIG.DRAFT;
                const isExpanded = expandedId === quote.id;

                return (
                  <React.Fragment key={quote.id}>
                    <TableRow className="cursor-pointer" onClick={() => toggleExpand(quote.id)}>
                      <TableCell>
                        {/* La ligne entiere porte deja le toggle : ce bouton est
                            l'affordance visuelle, d'ou tabIndex -1 et aria-hidden. */}
                        <Button variant="ghost" size="icon-sm" tabIndex={-1} aria-hidden>
                          {isExpanded ? <ExpandLess size={16} strokeWidth={1.75} /> : <ExpandMore size={16} strokeWidth={1.75} />}
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium">#{quote.id}</TableCell>
                      <TableCell>{formatDate(quote.generatedAt)}</TableCell>
                      <TableCell>
                        <StatusChip tone={statusConf.tone} label={statusConf.label} />
                      </TableCell>
                      <TableCell className="text-end font-semibold">
                        <Money value={Number(quote.totalHt)} from={quote.currency ?? 'EUR'} />
                      </TableCell>
                      {canEdit && (
                        <TableCell className="text-end" onClick={(e) => e.stopPropagation()}>
                          {/* Le Button du kit ne transmet pas de ref : span d'ancrage.
                              Action de ligne repetee -> taille xs, teinte de succes (pas de
                              variante « success » dans le kit) : encre `-ink` pour le texte,
                              teinte vive pour le filet — cf. contrat §2.4. */}
                          {quote.status === 'DRAFT' && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex">
                                  <Button
                                    variant="outline"
                                    size="xs"
                                    className="text-success-ink border-success hover:bg-success-soft"
                                    onClick={() => onConfirm(quote.id)}
                                  >
                                    <CheckCircle size={14} strokeWidth={1.75} />
                                    Confirmer
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>Confirmer le devis</TooltipContent>
                            </Tooltip>
                          )}
                        </TableCell>
                      )}
                    </TableRow>

                    {/* Expanded detail */}
                    <TableRow>
                      <TableCell colSpan={canEdit ? 6 : 5} className={cn('p-0', !isExpanded && 'border-b-0')}>
                        {/* Collapsible pilote en lecture seule : le declencheur est
                            la ligne du tableau, pas un CollapsibleTrigger. */}
                        <Collapsible open={isExpanded}>
                          <CollapsibleContent>
                          <div className="p-3 bg-muted">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Article</TableHead>
                                  <TableHead className="text-center">Qte</TableHead>
                                  <TableHead className="text-end">Prix unitaire</TableHead>
                                  <TableHead className="text-end">Sous-total</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {quote.lines.map((line) => (
                                  <TableRow key={line.key}>
                                    <TableCell>{line.label}</TableCell>
                                    <TableCell className="text-center">{line.quantity}</TableCell>
                                    <TableCell className="text-end"><Money value={Number(line.unitPrice)} from="EUR" /></TableCell>
                                    <TableCell className="text-end font-medium">
                                      <Money value={Number(line.lineTotal)} from="EUR" />
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                            {quote.notes && (
                              <p className="text-xs text-muted-foreground mt-1.5 italic">
                                {quote.notes}
                              </p>
                            )}
                            {quote.confirmedAt && (
                              <span className="text-xs text-muted-foreground mt-0.5 block">
                                Confirme le {formatDate(quote.confirmedAt)}
                              </span>
                            )}
                          </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
