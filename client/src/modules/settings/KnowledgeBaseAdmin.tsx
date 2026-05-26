import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Tooltip,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { AttachFile, Delete } from '../../icons';
import apiClient from '../../services/apiClient';
import { useNotification } from '../../hooks/useNotification';
import { useAuth } from '../../hooks/useAuth';

interface KbDoc {
  id: number;
  sourcePath: string;
  title: string | null;
  scope: 'global' | 'org';
  lang: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Administration de la knowledge base RAG : liste les documents indexes
 * (globaux Clenzy + propres a l'org), permet d'uploader un nouveau .md et
 * de supprimer les docs existants. Les actions d'admin sont gatees cote
 * backend (PreAuthorize hasAnyRole...).
 */
export const KnowledgeBaseAdmin: React.FC = () => {
  const theme = useTheme();
  const { notify } = useNotification();
  const { hasAnyRole } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [docs, setDocs] = useState<KbDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEdit = hasAnyRole(['SUPER_ADMIN', 'HOST', 'SUPER_MANAGER']);
  const canUploadGlobal = hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER']);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<KbDoc[]>('/admin/kb/documents');
      setDocs(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const handleUpload = useCallback(async (file: File, scope: 'global' | 'org') => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('scope', scope);
      await apiClient.upload<KbDoc>('/admin/kb/ingest?scope=' + scope, form);
      notify.success(`Document indexe : ${file.name}`);
      await loadDocs();
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Upload echoue');
    } finally {
      setUploading(false);
    }
  }, [notify, loadDocs]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const scope = canUploadGlobal ? 'global' : 'org';
      handleUpload(file, scope);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [handleUpload, canUploadGlobal]);

  const handleDelete = useCallback(async (doc: KbDoc) => {
    if (!window.confirm(`Supprimer "${doc.title || doc.sourcePath}" ? Les chunks et embeddings seront effaces.`)) {
      return;
    }
    try {
      await apiClient.delete<void>(`/admin/kb/documents/${doc.id}`);
      notify.success('Document supprime');
      await loadDocs();
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Suppression impossible');
    }
  }, [notify, loadDocs]);

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 2, md: 3 },
        bgcolor: alpha(theme.palette.primary.main, 0.025),
        border: 'none',
        borderRadius: 2,
      }}
    >
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
        Knowledge base (RAG)
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Documents indexes que l'assistant peut citer. Les docs <strong>globaux</strong> sont
        accessibles a toutes les organisations (doc produit Clenzy) ; les docs <strong>org</strong>
        sont prives a la votre. Format supporte : Markdown (.md), max 2 MB.
      </Typography>

      <Box sx={{ mb: 2, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        {canEdit && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,text/markdown,text/plain"
              hidden
              onChange={handleFileChange}
            />
            <Button
              variant="contained"
              startIcon={<AttachFile size={16} />}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              sx={{ textTransform: 'none', cursor: 'pointer' }}
            >
              {uploading ? 'Indexation...' : 'Uploader un document'}
            </Button>
            {uploading && <CircularProgress size={20} />}
          </>
        )}
        <Box sx={{ flex: 1 }} />
        <Button
          variant="text"
          size="small"
          onClick={loadDocs}
          disabled={loading}
          sx={{ textTransform: 'none', cursor: 'pointer' }}
        >
          Rafraichir
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress size={24} />
        </Box>
      ) : docs.length === 0 ? (
        <Box sx={{
          p: 3, textAlign: 'center',
          bgcolor: alpha(theme.palette.text.primary, 0.03),
          borderRadius: 1.5,
        }}>
          <Typography variant="body2" color="text.secondary">
            Aucun document indexe. Upload ton premier markdown pour activer le RAG.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Titre</TableCell>
                <TableCell>Source</TableCell>
                <TableCell>Portee</TableCell>
                <TableCell>Maj</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {docs.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell sx={{ fontWeight: 500 }}>
                    {doc.title || '(sans titre)'}
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.75rem', color: theme.palette.text.secondary }}>
                    {doc.sourcePath}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={doc.scope === 'global' ? 'Global Clenzy' : 'Mon organisation'}
                      size="small"
                      sx={{
                        bgcolor: doc.scope === 'global'
                          ? alpha(theme.palette.info.main, 0.14)
                          : alpha(theme.palette.success.main, 0.14),
                        color: doc.scope === 'global'
                          ? theme.palette.info.dark
                          : theme.palette.success.dark,
                        height: 20,
                        fontSize: '0.7rem',
                        fontWeight: 600,
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.75rem', color: theme.palette.text.secondary }}>
                    {new Date(doc.updatedAt).toLocaleDateString('fr-FR')}
                  </TableCell>
                  <TableCell align="right">
                    {canEdit && (
                      <Tooltip title="Supprimer">
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(doc)}
                          sx={{ cursor: 'pointer' }}
                        >
                          <Delete size={16} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </Paper>
  );
};

export default KnowledgeBaseAdmin;
