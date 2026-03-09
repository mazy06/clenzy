import React, { useState, forwardRef, useImperativeHandle } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Download, Lock, VerifiedUser, Fingerprint } from '@mui/icons-material';
import { documentsApi, DocumentGeneration } from '../../services/api/documentsApi';
import { useGenerations, useVerifyDocumentIntegrity } from './hooks/useDocuments';
import GenerateDialog from './GenerateDialog';

export interface GenerationsListRef {
  fetchGenerations: () => void;
  openGenerate: () => void;
}

const STATUS_HEX: Record<string, string> = {
  PENDING: '#757575',
  GENERATING: '#0288d1',
  COMPLETED: '#4A9B8E',
  FAILED: '#d32f2f',
  SENT: '#4A9B8E',
  LOCKED: '#ED6C02',
  ARCHIVED: '#757575',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  GENERATING: 'En cours',
  COMPLETED: 'Terminé',
  FAILED: 'Échoué',
  SENT: 'Envoyé',
  LOCKED: 'Verrouillé',
  ARCHIVED: 'Archivé',
};

const GenerationsList = forwardRef<GenerationsListRef>((_, ref) => {
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [verifyResult, setVerifyResult] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useGenerations(page, size);
  const verifyMutation = useVerifyDocumentIntegrity();

  const generations = data?.content ?? [];
  const totalElements = data?.totalElements ?? 0;

  const handleDownload = async (gen: DocumentGeneration) => {
    try {
      await documentsApi.downloadGeneration(gen.id, gen.fileName || 'document.pdf');
    } catch {
      setActionError('Erreur lors du téléchargement');
    }
  };

  const handleVerify = async (gen: DocumentGeneration) => {
    try {
      const result = await verifyMutation.mutateAsync(gen.id);
      if (result.verified) {
        setVerifyResult(`Document ${gen.legalNumber || '#' + gen.id} : Intégrité vérifiée`);
      } else {
        setVerifyResult(`Document ${gen.legalNumber || '#' + gen.id} : INTÉGRITÉ COMPROMISE — ${result.reason || 'Hash différent'}`);
      }
    } catch {
      setActionError('Erreur lors de la vérification');
    }
  };

  useImperativeHandle(ref, () => ({
    fetchGenerations: () => refetch(),
    openGenerate: () => setGenerateOpen(true),
  }));

  const handleGenerateSuccess = () => {
    setGenerateOpen(false);
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const displayError = actionError || (error ? 'Erreur lors du chargement de l\'historique' : null);

  return (
    <Box>
      {displayError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>{displayError}</Alert>}
      {verifyResult && (
        <Alert
          severity={verifyResult.includes('vérifiée') ? 'success' : 'error'}
          sx={{ mb: 2 }}
          onClose={() => setVerifyResult(null)}
        >
          {verifyResult}
        </Alert>
      )}

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>N. Légal</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Template</TableCell>
                  <TableCell>Fichier</TableCell>
                  <TableCell>Taille</TableCell>
                  <TableCell>Statut</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Durée</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {generations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">Aucune génération</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  generations.map((gen) => (
                    <TableRow key={gen.id} hover>
                      <TableCell>
                        <Typography variant="body2">{formatDate(gen.createdAt)}</Typography>
                      </TableCell>
                      <TableCell>
                        {gen.legalNumber ? (
                          <Tooltip title={gen.locked ? `Verrouillé${gen.documentHash ? ' — SHA-256: ' + gen.documentHash.substring(0, 16) + '...' : ''}` : 'Non verrouillé'}>
                            {(() => { const c = gen.locked ? '#ED6C02' : '#757575'; return (
                            <Chip
                              icon={gen.locked ? <Lock sx={{ fontSize: 14, color: `${c} !important` }} /> : undefined}
                              label={gen.legalNumber}
                              size="small"
                              sx={{ fontFamily: 'monospace', fontWeight: 600, backgroundColor: `${c}18`, color: c, border: `1px solid ${c}40`, borderRadius: '6px', '& .MuiChip-label': { px: 0.75 } }}
                            />
                            ); })()}
                          </Tooltip>
                        ) : (
                          <Typography variant="body2" color="text.secondary">—</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip label={gen.documentType} size="small"
                          sx={{ backgroundColor: '#1976d218', color: '#1976d2', border: '1px solid #1976d240', borderRadius: '6px', fontWeight: 600, fontSize: '0.75rem', height: 24, '& .MuiChip-label': { px: 1 } }} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 150 }}>
                          {gen.templateName || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 180 }}>
                          {gen.fileName || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>{formatFileSize(gen.fileSize)}</TableCell>
                      <TableCell>
                        {(() => { const c = STATUS_HEX[gen.status] ?? '#757575'; return (
                        <Chip
                          label={STATUS_LABELS[gen.status] || gen.status}
                          size="small"
                          sx={{ backgroundColor: `${c}18`, color: c, border: `1px solid ${c}40`, borderRadius: '6px', fontWeight: 600, fontSize: '0.75rem', height: 24, '& .MuiChip-label': { px: 1 } }}
                        />
                        ); })()}
                      </TableCell>
                      <TableCell>
                        {gen.emailTo ? (
                          <Tooltip title={gen.emailTo}>
                            {(() => { const c = gen.emailStatus === 'SENT' ? '#4A9B8E' : gen.emailStatus === 'FAILED' ? '#d32f2f' : '#757575'; return (
                            <Chip
                              label={gen.emailStatus === 'SENT' ? 'Envoyé' : gen.emailStatus || 'En attente'}
                              size="small"
                              sx={{ backgroundColor: `${c}18`, color: c, border: `1px solid ${c}40`, borderRadius: '6px', fontWeight: 600, fontSize: '0.75rem', height: 24, '& .MuiChip-label': { px: 1 } }}
                            />
                            ); })()}
                          </Tooltip>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        {gen.generationTimeMs ? `${gen.generationTimeMs}ms` : '—'}
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                          {(gen.status === 'COMPLETED' || gen.status === 'SENT' || gen.status === 'LOCKED') && (
                            <Tooltip title="Télécharger">
                              <IconButton size="small" color="primary" onClick={() => handleDownload(gen)}>
                                <Download />
                              </IconButton>
                            </Tooltip>
                          )}
                          {gen.locked && gen.documentHash && (
                            <Tooltip title="Vérifier l'intégrité (SHA-256)">
                              <IconButton size="small" color="info" onClick={() => handleVerify(gen)}>
                                <Fingerprint />
                              </IconButton>
                            </Tooltip>
                          )}
                          {gen.correctsId && (
                            <Tooltip title={`Correction du document #${gen.correctsId}`}>
                              <VerifiedUser sx={{ fontSize: 18, color: 'text.secondary', mt: 0.5 }} />
                            </Tooltip>
                          )}
                          {gen.status === 'FAILED' && (
                            <Tooltip title={gen.errorMessage || 'Erreur'}>
                              <Typography variant="caption" color="error">Erreur</Typography>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={totalElements}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={size}
            onRowsPerPageChange={(e) => { setSize(parseInt(e.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[10, 20, 50]}
            labelRowsPerPage="Par page"
          />
        </>
      )}

      <GenerateDialog open={generateOpen} onClose={() => setGenerateOpen(false)} onSuccess={handleGenerateSuccess} />
    </Box>
  );
});

GenerationsList.displayName = 'GenerationsList';

export default GenerationsList;
