import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Chip,
  Divider,
  IconButton,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TextField,
  Tooltip,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { AttachFile, Delete } from '../../icons';
import apiClient from '../../services/apiClient';
import { useNotification } from '../../hooks/useNotification';
import { useAuth } from '../../hooks/useAuth';
import AiSettingsCard from './AiSettingsCard';

interface KbDoc {
  id: number;
  sourcePath: string;
  title: string | null;
  scope: 'global' | 'org';
  lang: string | null;
  createdAt: string;
  updatedAt: string;
}

interface KbStats {
  documents: { total: number; global: number; org: number };
  chunks: { total: number; indexed: number; orphans: number };
  index: {
    status: string;
    currentLists: number | null;
    optimalLists: number | null;
    autoTuneEnabled: boolean;
    retuneRecommended: boolean;
  };
}

interface KbEvalMiss {
  question: string;
  expected: string;
  retrieved: string[];
}

interface KbEvalReport {
  topK: number;
  recallAtK: number;
  mrr: number;
  total: number;
  hits: number;
  misses: KbEvalMiss[];
}

interface KbSearchTestHit {
  documentId: number;
  title: string | null;
  sourcePath: string;
  snippet: string;
  relevance: number;
}

interface KbSearchTestResponse {
  query: string;
  lang: string;
  relevanceThreshold: number;
  items: KbSearchTestHit[];
  count: number;
}

/**
 * Administration de la knowledge base RAG : liste les documents indexes
 * (globaux Baitly + propres a l'org), permet d'uploader un nouveau .md et
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
  const [testQuery, setTestQuery] = useState('');
  const [testResult, setTestResult] = useState<KbSearchTestResponse | null>(null);
  const [testing, setTesting] = useState(false);
  const [stats, setStats] = useState<KbStats | null>(null);
  const [evalReport, setEvalReport] = useState<KbEvalReport | null>(null);
  const [evaluating, setEvaluating] = useState(false);

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

  const loadStats = useCallback(async () => {
    if (!canUploadGlobal) return;
    try {
      const data = await apiClient.get<KbStats>('/admin/kb/stats');
      setStats(data);
    } catch {
      // KPI best-effort : l'ecran reste utilisable sans les stats
      setStats(null);
    }
  }, [canUploadGlobal]);

  useEffect(() => { loadDocs(); loadStats(); }, [loadDocs, loadStats]);

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

  const handleRunEval = useCallback(async () => {
    setEvaluating(true);
    setEvalReport(null);
    try {
      const data = await apiClient.post<KbEvalReport>('/admin/kb/eval', {});
      setEvalReport(data);
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Évaluation impossible");
    } finally {
      setEvaluating(false);
    }
  }, [notify]);

  const handleSearchTest = useCallback(async () => {
    const query = testQuery.trim();
    if (!query) return;
    setTesting(true);
    setTestResult(null);
    try {
      const data = await apiClient.get<KbSearchTestResponse>(
        `/admin/kb/search-test?query=${encodeURIComponent(query)}&topK=5`,
      );
      setTestResult(data);
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Test de recherche impossible');
    } finally {
      setTesting(false);
    }
  }, [testQuery, notify]);

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
    <AiSettingsCard
      title="Knowledge base (RAG)"
      subtitle={
        <>
          Documents indexés que l'assistant peut citer. Les docs <strong>globaux</strong> sont
          accessibles à toutes les organisations (doc produit Baitly) ; les docs <strong>org</strong>
          {' '}sont privés à la vôtre. Format supporté : Markdown (.md), max 2&nbsp;MB.
        </>
      }
    >
      {stats && (
        <>
          <Box sx={{ mb: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            {[
              { label: 'Documents', value: stats.documents.total, detail: `${stats.documents.global} globaux · ${stats.documents.org} org` },
              { label: 'Extraits indexés', value: stats.chunks.indexed, detail: `sur ${stats.chunks.total}` },
              { label: 'Sans embedding', value: stats.chunks.orphans, detail: stats.chunks.orphans > 0 ? 'ré-indexation en cours' : 'aucun retard' },
              {
                label: 'Index vectoriel',
                value: stats.index.currentLists ?? '—',
                detail: `lists · optimal ${stats.index.optimalLists ?? '—'}${stats.index.autoTuneEnabled ? ' · auto-tune actif' : ''}`,
              },
            ].map((kpi) => (
              <Box
                key={kpi.label}
                sx={{
                  px: 1.75, py: 1, minWidth: 150, borderRadius: 1.5,
                  bgcolor: alpha(theme.palette.text.primary, 0.03),
                  border: `1px solid ${alpha(theme.palette.text.primary, 0.08)}`,
                }}
              >
                <Typography variant="caption" color="text.secondary" component="div">
                  {kpi.label}
                </Typography>
                <Typography variant="h6" sx={{ fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
                  {kpi.value}
                </Typography>
                <Typography variant="caption" color="text.secondary" component="div">
                  {kpi.detail}
                </Typography>
              </Box>
            ))}
          </Box>
          {stats.index.retuneRecommended && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              La base a grossi : l'index vectoriel (lists = {stats.index.currentLists}) est loin de
              sa taille optimale ({stats.index.optimalLists}) et dégrade la qualité de recherche de
              l'assistant. Activez la reconstruction automatique
              (<code>clenzy.assistant.kb.auto-tune-enabled</code>) ou recréez l'index — la commande
              exacte est dans les logs du serveur (KbIndexTuningScheduler).
            </Alert>
          )}
        </>
      )}

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
                      label={doc.scope === 'global' ? 'Global Baitly' : 'Mon organisation'}
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

      {canUploadGlobal && (
        <>
          <Divider sx={{ my: 3 }} />
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <Box sx={{ flex: 1, minWidth: 240 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                Évaluer le retrieval
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Lance les {evalReport?.total ?? 40} questions du jeu de test officiel sur le
                pipeline réel et mesure la qualité de recherche. À relancer après chaque
                changement de documentation, de seuils ou de modèle (~30&nbsp;secondes,
                quelques centimes d'API).
              </Typography>
            </Box>
            <Button
              variant="outlined"
              onClick={handleRunEval}
              disabled={evaluating}
              sx={{ textTransform: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              {evaluating ? 'Évaluation en cours…' : "Lancer l'évaluation"}
            </Button>
          </Box>
          {evaluating && (
            <Box display="flex" justifyContent="center" py={2}>
              <CircularProgress size={20} />
            </Box>
          )}
          {evalReport && (
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 1.5 }}>
                {[
                  {
                    label: `Recall@${evalReport.topK}`,
                    value: `${Math.round(evalReport.recallAtK * 100)} %`,
                    detail: `${evalReport.hits}/${evalReport.total} questions trouvent leur fiche`,
                  },
                  {
                    label: 'MRR',
                    value: evalReport.mrr.toFixed(3),
                    detail: 'position moyenne du bon résultat',
                  },
                ].map((kpi) => (
                  <Box
                    key={kpi.label}
                    sx={{
                      px: 1.75, py: 1, minWidth: 170, borderRadius: 1.5,
                      bgcolor: alpha(theme.palette.text.primary, 0.03),
                      border: `1px solid ${alpha(theme.palette.text.primary, 0.08)}`,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" component="div">
                      {kpi.label}
                    </Typography>
                    <Typography variant="h6" sx={{ fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
                      {kpi.value}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" component="div">
                      {kpi.detail}
                    </Typography>
                  </Box>
                ))}
              </Box>
              {evalReport.misses.length === 0 ? (
                <Alert severity="success">
                  Toutes les questions du jeu de test retrouvent leur fiche : le retrieval est sain.
                </Alert>
              ) : (
                <>
                  <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.5 }}>
                    Questions sans leur fiche attendue dans le top {evalReport.topK} :
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                    {evalReport.misses.map((miss, idx) => (
                      <Box
                        key={idx}
                        sx={{
                          px: 1.5, py: 1, borderRadius: 1.5,
                          bgcolor: alpha(theme.palette.warning.main, 0.08),
                          border: `1px solid ${alpha(theme.palette.warning.main, 0.25)}`,
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {miss.question}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" component="div">
                          attendu : {miss.expected} · obtenu : {miss.retrieved.join(', ') || 'aucun résultat'}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </>
              )}
            </Box>
          )}
        </>
      )}

      {canEdit && (
        <>
          <Divider sx={{ my: 3 }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
            Tester la recherche
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Exécute la même recherche que l'assistant (vectorielle + mots-clés + re-ranking)
            et montre les extraits retrouvés avec leur score de pertinence.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Ex. : comment configurer la taxe de séjour ?"
              value={testQuery}
              onChange={(e) => setTestQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearchTest(); }}
              disabled={testing}
            />
            <Button
              variant="outlined"
              onClick={handleSearchTest}
              disabled={testing || !testQuery.trim()}
              sx={{ textTransform: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              {testing ? 'Recherche...' : 'Tester'}
            </Button>
          </Box>
          {testing && (
            <Box display="flex" justifyContent="center" py={2}>
              <CircularProgress size={20} />
            </Box>
          )}
          {testResult && testResult.items.length === 0 && (
            <Alert severity="warning">
              Aucun extrait trouvé pour cette question. L'assistant répondra sans contexte
              documentaire — envisagez d'ajouter ou de compléter un document.
            </Alert>
          )}
          {testResult && testResult.items.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {testResult.items.map((hit, idx) => {
                const aboveThreshold = hit.relevance >= testResult.relevanceThreshold;
                return (
                  <Box
                    key={`${hit.documentId}-${idx}`}
                    sx={{
                      p: 1.5,
                      borderRadius: 1.5,
                      bgcolor: alpha(theme.palette.text.primary, 0.03),
                      border: `1px solid ${alpha(theme.palette.text.primary, 0.08)}`,
                    }}
                  >
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.5, flexWrap: 'wrap' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {hit.title || hit.sourcePath}
                      </Typography>
                      <Chip
                        label={`${Math.round(hit.relevance * 100)} %`}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          fontVariantNumeric: 'tabular-nums',
                          bgcolor: aboveThreshold
                            ? alpha(theme.palette.success.main, 0.14)
                            : alpha(theme.palette.warning.main, 0.14),
                          color: aboveThreshold
                            ? theme.palette.success.dark
                            : theme.palette.warning.dark,
                        }}
                      />
                      {!aboveThreshold && (
                        <Typography variant="caption" color="text.secondary">
                          sous le seuil d'injection automatique
                          ({Math.round(testResult.relevanceThreshold * 100)} %)
                        </Typography>
                      )}
                    </Box>
                    <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.5 }}>
                      {hit.sourcePath}
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                      {hit.snippet}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          )}
        </>
      )}
    </AiSettingsCard>
  );
};

export default KnowledgeBaseAdmin;
