import React, { useEffect, useState, useCallback, useRef } from 'react';
import { cn } from '../../utils/cn';
import StatusChip from '../../components/StatusChip';
import { Alert, AlertDescription } from '../../components/ui';
import { TriangleAlert, CircleCheck } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Button } from '../../components/ui';
import { Separator, Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui';
import { Input } from '../../components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui';

/** Surface « tuile » : report en classes des `alpha(text.primary, .03/.08)`. */
const TILE_CLASS =
  'rounded-[12px] bg-[color-mix(in_srgb,var(--ink)_3%,transparent)] border border-solid border-[color-mix(in_srgb,var(--ink)_8%,transparent)]';
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

interface KbEvalStatus {
  state: 'idle' | 'running' | 'done' | 'failed';
  done: number;
  total: number;
  error: string | null;
  report: KbEvalReport | null;
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
  const [evalProgress, setEvalProgress] = useState<{ done: number; total: number } | null>(null);
  const evalPollRef = useRef(false);

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

  const pollEvalStatus = useCallback(async () => {
    if (evalPollRef.current) return;
    evalPollRef.current = true;
    try {
      // Le run s'auto-espace quand l'API Voyage est rate-limitée : il peut
      // durer plusieurs minutes — on polle jusqu'à l'état final.
      for (;;) {
        const status = await apiClient.get<KbEvalStatus>('/admin/kb/eval/status');
        if (status.state === 'running') {
          setEvaluating(true);
          setEvalProgress({ done: status.done, total: status.total });
          await new Promise((resolve) => setTimeout(resolve, 3000));
          continue;
        }
        setEvaluating(false);
        setEvalProgress(null);
        if (status.state === 'done' && status.report) {
          setEvalReport(status.report);
        } else if (status.state === 'failed') {
          notify.error(status.error || 'Évaluation échouée');
        }
        return;
      }
    } catch (e) {
      setEvaluating(false);
      setEvalProgress(null);
      notify.error(e instanceof Error ? e.message : 'Suivi de l’évaluation impossible');
    } finally {
      evalPollRef.current = false;
    }
  }, [notify]);

  const handleRunEval = useCallback(async () => {
    setEvalReport(null);
    try {
      await apiClient.post<{ started: boolean }>('/admin/kb/eval', {});
      setEvaluating(true);
      pollEvalStatus();
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Évaluation impossible');
    }
  }, [notify, pollEvalStatus]);

  // Un run peut déjà être en cours (lancé avant un refresh de la page) : on s'y rattache.
  useEffect(() => {
    if (canUploadGlobal) pollEvalStatus();
  }, [canUploadGlobal, pollEvalStatus]);

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
          <div className="mb-3 flex gap-2 flex-wrap">
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
              <div className={cn(TILE_CLASS, 'px-[10.5px] py-1.5 min-w-[150px]')} key={kpi.label}>
                <div className="cn-text-caption text-muted-foreground">
                  {kpi.label}
                </div>
                <h6 className="cn-text-h6 tabular-nums leading-[1.2]">
                  {kpi.value}
                </h6>
                <div className="cn-text-caption text-muted-foreground">
                  {kpi.detail}
                </div>
              </div>
            ))}
          </div>
          {stats.index.retuneRecommended && (
            <Alert variant="warning" className="mb-3">
              <TriangleAlert />
              <AlertDescription>La base a grossi : l'index vectoriel (lists = {stats.index.currentLists}) est loin de
              sa taille optimale ({stats.index.optimalLists}) et dégrade la qualité de recherche de
              l'assistant. Activez la reconstruction automatique
              (<code>clenzy.assistant.kb.auto-tune-enabled</code>) ou recréez l'index — la commande
              exacte est dans les logs du serveur (KbIndexTuningScheduler).</AlertDescription>
            </Alert>
          )}
        </>
      )}

      <div className="mb-3 flex gap-1.5 items-center flex-wrap">
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
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <AttachFile size={16} />
              {uploading ? 'Indexation...' : 'Uploader un document'}
            </Button>
            {uploading && <Spinner className="size-5" />}
          </>
        )}
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={loadDocs}
          disabled={loading}
        >
          Rafraichir
        </Button>
      </div>

      {error && <Alert variant="destructive" className="mb-3">
        <TriangleAlert />
        <AlertDescription>{error}</AlertDescription>
      </Alert>}

      {loading ? (
        <div className="flex justify-center py-6">
          <Spinner className="size-6" />
        </div>
      ) : docs.length === 0 ? (
        <div className="p-[18px] text-center rounded-[12px] bg-[color-mix(in_srgb,var(--ink)_3%,transparent)]">
          <p className="cn-text-body2 text-muted-foreground">
            Aucun document indexe. Upload ton premier markdown pour activer le RAG.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titre</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Portee</TableHead>
                <TableHead>Maj</TableHead>
                <TableHead className="text-end">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium">
                    {doc.title || '(sans titre)'}
                  </TableCell>
                  <TableCell className="text-[0.75rem] text-[var(--muted)]">
                    {doc.sourcePath}
                  </TableCell>
                  <TableCell>
                    {/* `tone` plutot que des tokens calcules : la paire
                        encre/fond doux de la primitive est l'equivalent
                        semantique des anciennes teintes `info`/`success`. */}
                    <StatusChip
                      tone={doc.scope === 'global' ? 'info' : 'ok'}
                      label={doc.scope === 'global' ? 'Global Baitly' : 'Mon organisation'}
                      className="h-[20px] text-[0.7rem]"
                    />
                  </TableCell>
                  <TableCell className="text-[0.75rem] text-[var(--muted)]">
                    {new Date(doc.updatedAt).toLocaleDateString('fr-FR')}
                  </TableCell>
                  <TableCell className="text-end">
                    {canEdit && (
                      // span intermediaire : TooltipTrigger asChild pose une ref DOM,
                      // que le Button du kit (fonction, React 18) ne transmet pas.
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Supprimer"
                              onClick={() => handleDelete(doc)}
                            >
                              <Delete size={16} />
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>Supprimer</TooltipContent>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {canUploadGlobal && (
        <>
          <Separator className="my-[18px]" />
          <div className="flex gap-1.5 items-start flex-wrap">
            <div className="flex-1 min-w-[240px]">
              <h6 className="cn-text-subtitle2 font-semibold mb-0.5">
                Évaluer le retrieval
              </h6>
              <p className="cn-text-body2 text-muted-foreground">
                Lance les {evalReport?.total ?? 40} questions du jeu de test officiel sur le
                pipeline réel et mesure la qualité de recherche. À relancer après chaque
                changement de documentation, de seuils ou de modèle (~30&nbsp;secondes,
                quelques centimes d'API).
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleRunEval}
              disabled={evaluating}
            >
              {evaluating
                ? evalProgress
                  ? `Évaluation… ${evalProgress.done}/${evalProgress.total}`
                  : 'Évaluation en cours…'
                : "Lancer l'évaluation"}
            </Button>
          </div>
          {evaluating && (
            <div className="flex items-center gap-2 py-3">
              <Spinner className="size-5" />
              <span className="cn-text-caption text-muted-foreground">
                {evalProgress && evalProgress.done < evalProgress.total
                  ? `${evalProgress.done} question(s) sur ${evalProgress.total} évaluée(s) — le rythme s'adapte aux limites de l'API (jusqu'à ~15 min si elle est bridée).`
                  : 'Démarrage du run…'}
              </span>
            </div>
          )}
          {evalReport && (
            <div className="mt-3">
              <div className="flex gap-2 flex-wrap mb-2">
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
                  <div className={cn(TILE_CLASS, 'px-[10.5px] py-1.5 min-w-[170px]')} key={kpi.label}>
                    <div className="cn-text-caption text-muted-foreground">
                      {kpi.label}
                    </div>
                    <h6 className="cn-text-h6 tabular-nums leading-[1.2]">
                      {kpi.value}
                    </h6>
                    <div className="cn-text-caption text-muted-foreground">
                      {kpi.detail}
                    </div>
                  </div>
                ))}
              </div>
              {evalReport.misses.length === 0 ? (
                <Alert variant="success">
                  <CircleCheck />
                  <AlertDescription>Toutes les questions du jeu de test retrouvent leur fiche : le retrieval est sain.</AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="cn-text-caption text-muted-foreground mb-0.5">
                    Questions sans leur fiche attendue dans le top {evalReport.topK} :
                  </div>
                  <div className="flex flex-col gap-1">
                    {evalReport.misses.map((miss, idx) => (
                      <div className="px-[9px] py-1.5 rounded-[12px] bg-[color-mix(in_srgb,var(--warn)_8%,transparent)] border border-solid border-[color-mix(in_srgb,var(--warn)_25%,transparent)]" key={idx}>
                        <p className="cn-text-body2 font-semibold">
                          {miss.question}
                        </p>
                        <div className="cn-text-caption text-muted-foreground">
                          attendu : {miss.expected} · obtenu : {miss.retrieved.join(', ') || 'aucun résultat'}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      {canEdit && (
        <>
          <Separator className="my-[18px]" />
          <h6 className="cn-text-subtitle2 font-semibold mb-0.5">
            Tester la recherche
          </h6>
          <p className="cn-text-body2 text-muted-foreground mb-2">
            Exécute la même recherche que l'assistant (vectorielle + mots-clés + re-ranking)
            et montre les extraits retrouvés avec leur score de pertinence.
          </p>
          <div className="flex gap-1.5 items-center mb-3">
            {/* Pas de libelle visible : le champ suit le titre « Tester la
                recherche » — d'ou l'aria-label qui le nomme pour l'assistance. */}
            <Input
              aria-label="Question à tester"
              placeholder="Ex. : comment configurer la taxe de séjour ?"
              value={testQuery}
              onChange={(e) => setTestQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearchTest(); }}
              disabled={testing}
            />
            <Button
              variant="outline"
              onClick={handleSearchTest}
              disabled={testing || !testQuery.trim()}
            >
              {testing ? 'Recherche...' : 'Tester'}
            </Button>
          </div>
          {testing && (
            <div className="flex justify-center py-3">
              <Spinner className="size-5" />
            </div>
          )}
          {testResult && testResult.items.length === 0 && (
            <Alert variant="warning">
              <TriangleAlert />
              <AlertDescription>Aucun extrait trouvé pour cette question. L'assistant répondra sans contexte
              documentaire — envisagez d'ajouter ou de compléter un document.</AlertDescription>
            </Alert>
          )}
          {testResult && testResult.items.length > 0 && (
            <div className="flex flex-col gap-2">
              {testResult.items.map((hit, idx) => {
                const aboveThreshold = hit.relevance >= testResult.relevanceThreshold;
                return (
                  <div className={cn(TILE_CLASS, 'p-[9px]')} key={`${hit.documentId}-${idx}`}>
                    <div className="flex gap-1.5 items-center mb-0.5 flex-wrap">
                      <p className="cn-text-body2 font-semibold">
                        {hit.title || hit.sourcePath}
                      </p>
                      <StatusChip
                        tone={aboveThreshold ? 'ok' : 'warn'}
                        label={`${Math.round(hit.relevance * 100)} %`}
                        className="h-[20px] text-[0.7rem] tabular-nums"
                      />
                      {!aboveThreshold && (
                        <span className="cn-text-caption text-muted-foreground">
                          sous le seuil d'injection automatique
                          ({Math.round(testResult.relevanceThreshold * 100)} %)
                        </span>
                      )}
                    </div>
                    <div className="cn-text-caption text-muted-foreground mb-0.5">
                      {hit.sourcePath}
                    </div>
                    <p className="cn-text-body2 whitespace-pre-line">
                      {hit.snippet}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </AiSettingsCard>
  );
};

export default KnowledgeBaseAdmin;
