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

const STATUS_COLORS: Record<string, 'default' | 'info' | 'success' | 'error' | 'warning'> = {
  PENDING: 'default',
  GENERATING: 'info',
  COMPLETED: 'success',
  FAILED: 'error',
  SENT: 'success',
  LOCKED: 'warning',
  ARCHIVED: 'default',
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
                            <Chip
                              icon={gen.locked ? <Lock sx={{ fontSize: 14 }} /> : undefined}
                              label={gen.legalNumber}
                              size="small"
                              color={gen.locked ? 'warning' : 'default'}
                              variant="outlined"
                              sx={{ fontFamily: 'monospace', fontWeight: 600, borderWidth: 1.5 }}
                            />
                          </Tooltip>
                        ) : (
                          <Typography variant="body2" color="text.secondary">—</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip label={gen.documentType} size="small" variant="outlined"
                          sx={{ borderWidth: 1.5, borderColor: 'primary.main' }} />
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
                        <Chip
                          label={STATUS_LABELS[gen.status] || gen.status}
                          size="small"
                          variant="outlined"
                          color={STATUS_COLORS[gen.status] || 'default'}
                          sx={{ borderWidth: 1.5 }}
                        />
                      </TableCell>
                      <TableCell>
                        {gen.emailTo ? (
                          <Tooltip title={gen.emailTo}>
                            <Chip
                              label={gen.emailStatus === 'SENT' ? 'Envoyé' : gen.emailStatus || 'En attente'}
                              size="small"
                              variant="outlined"
                              color={gen.emailStatus === 'SENT' ? 'success' : gen.emailStatus === 'FAILED' ? 'error' : 'default'}
                              sx={{ borderWidth: 1.5 }}
                            />
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
