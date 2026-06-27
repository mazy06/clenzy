import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, ButtonBase, InputBase, Skeleton } from '@mui/material';
import { Plus, Wand2, Trash2, ArrowLeft, Check, AlertTriangle, FileText, Languages } from 'lucide-react';
import { sitesApi, type BlogPost, type BlogPostUpsert } from '../../../../services/api/sitesApi';
import { useNotification } from '../../../../hooks/useNotification';
import TranslateModal from '../TranslateModal';
import type { StudioConfigState } from '../useStudioConfig';

/**
 * Section « Blog » du Studio (2.13). Gère les articles d'un site (CRUD réutilisant le backend
 * BlogPost) + génération d'un brouillon par IA (`/sites/{id}/blog/ai`, réutilise SiteContentAiService).
 * Résout le site via `ensureForConfig` (comme le builder). Les articles publiés sont servis par le
 * SSR (`clenzy-sites`) via la livraison blog existante.
 */

type Draft = {
  title: string; slug: string; excerpt: string; body: string;
  status: string; locale: string; seoTitle: string; seoDescription: string; coverImageUrl: string;
  aiGenerated: boolean;
};

const EMPTY: Draft = { title: '', slug: '', excerpt: '', body: '', status: 'DRAFT', locale: '', seoTitle: '', seoDescription: '', coverImageUrl: '', aiGenerated: false };

function slugify(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60).replace(/-$/, '');
}

function toDraft(p: BlogPost): Draft {
  return {
    title: p.title ?? '', slug: p.slug ?? '', excerpt: p.excerpt ?? '', body: p.body ?? '',
    // PENDING_REVIEW est un statut serveur ; dans l'éditeur on n'édite que DRAFT vs « soumettre ».
    status: p.status === 'PUBLISHED' ? 'PUBLISHED' : (p.status ?? 'DRAFT'),
    locale: p.locale ?? '', seoTitle: p.seoTitle ?? '',
    seoDescription: p.seoDescription ?? '', coverImageUrl: p.coverImageUrl ?? '', aiGenerated: p.aiGenerated ?? false,
  };
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Brouillon', color: 'var(--muted)' },
  PENDING_REVIEW: { label: 'En attente de validation', color: 'var(--warn, #B26B00)' },
  PUBLISHED: { label: 'Publié', color: 'var(--ok)' },
};

/** Locales supportées par le Studio (alignées sur GrapesStudio). */
const SUPPORTED_LOCALES = ['fr', 'en', 'ar'] as const;

export default function BlogPanel({ cfg }: { cfg: StudioConfigState }) {
  const { t } = useTranslation();
  const { notify } = useNotification();
  const configId = cfg.config?.id;
  const [siteId, setSiteId] = useState<number | null>(null);
  const [posts, setPosts] = useState<BlogPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<BlogPost | 'new' | null>(null);
  // Auto-traduction IA d'un article (crée des variantes en brouillon, relecture humaine).
  const [translatingPost, setTranslatingPost] = useState<BlogPost | null>(null);

  useEffect(() => {
    if (!configId) return;
    let alive = true;
    setError(null);
    sitesApi.ensureForConfig(configId)
      .then((s) => { if (!alive) return null; setSiteId(s.id); return sitesApi.listPosts(s.id); })
      .then((list) => { if (alive && list) setPosts(list); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Blog indisponible'); });
    return () => { alive = false; };
  }, [configId]);

  const reload = async () => {
    if (siteId == null) return;
    setPosts(await sitesApi.listPosts(siteId));
  };

  // Auto-traduit (IA) un article vers les langues choisies : variantes en brouillon (relecture humaine).
  const handleAutoTranslatePost = async (targets: string[]) => {
    if (siteId == null || !translatingPost) {
      throw new Error(t('bookingEngine.studio.ai.translate.noPost', 'Aucun article sélectionné.'));
    }
    const result = await sitesApi.autoTranslatePost(siteId, translatingPost.id, targets);
    const created = result.createdPosts.length;
    const skipped = result.skippedLocales.length;
    setTranslatingPost(null);
    if (created > 0) {
      notify.success(t('bookingEngine.studio.ai.translate.success', '{{count}} variante(s) créée(s) en brouillon — à relire avant publication.', { count: created }));
    } else {
      notify.info(t('bookingEngine.studio.ai.translate.noneCreated', 'Aucune variante créée (langues déjà traduites).'));
    }
    if (skipped > 0) {
      notify.info(t('bookingEngine.studio.ai.translate.skipped', '{{count}} langue(s) ignorée(s) (déjà traduite(s)).', { count: skipped }));
    }
    await reload();
    return result;
  };

  /** Langues cibles d'un article = locales supportées hors langue de l'article (vide = langue par défaut). */
  const postTargets = (p: BlogPost) => SUPPORTED_LOCALES.filter((l) => l !== (p.locale ?? 'fr'));

  if (error) {
    return (
      <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 1, color: 'var(--err)', fontSize: 'var(--text-sm)' }}>
        <AlertTriangle size={16} strokeWidth={2} /> {error}
      </Box>
    );
  }

  if (editing != null && siteId != null) {
    return (
      <BlogEditor
        siteId={siteId}
        post={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
        onSaved={async () => { await reload(); setEditing(null); }}
      />
    );
  }

  return (
    <Box sx={{ maxWidth: 1080, mx: 'auto', px: { xs: 2, md: 3 }, py: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2, mb: 3 }}>
        <Box>
          <Box sx={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', fontWeight: 'var(--fw-bold)' }}>Articles de blog</Box>
          <Box sx={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', mt: 0.25 }}>Rédige ou génère des articles ; les articles publiés apparaissent sur ton site.</Box>
        </Box>
        <Box sx={{ flex: 1 }} />
        <ButtonBase onClick={() => setEditing('new')} disabled={siteId == null} sx={primaryBtnSx}>
          <Plus size={16} strokeWidth={2.2} /> Nouvel article
        </ButtonBase>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, p: 1.25, borderRadius: 'var(--radius-md)', bgcolor: 'var(--accent-soft)', color: 'var(--accent)', fontSize: 'var(--text-2xs)', lineHeight: 1.4 }}>
        <AlertTriangle size={15} strokeWidth={2} style={{ flexShrink: 0 }} />
        La publication est soumise à <strong>validation manuelle</strong> : un article (surtout s'il est généré par IA) doit être relu puis approuvé. Les relecteurs de l'organisation sont alertés à chaque soumission.
      </Box>

      {posts === null && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={64} sx={{ borderRadius: 'var(--radius-md)', bgcolor: 'var(--hover)' }} />)}
        </Box>
      )}

      {posts?.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 7, color: 'var(--muted)' }}>
          <Box sx={{ width: 52, height: 52, mx: 'auto', mb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-lg)', bgcolor: 'var(--accent-soft)', color: 'var(--accent)' }}>
            <FileText size={24} strokeWidth={1.8} />
          </Box>
          <Box sx={{ fontSize: 'var(--text-md)', fontWeight: 'var(--fw-semibold)', color: 'var(--ink)', mb: 0.5 }}>Aucun article</Box>
          <Box sx={{ fontSize: 'var(--text-sm)' }}>Crée ton premier article ou laisse l'IA t'en proposer un.</Box>
        </Box>
      )}

      {posts && posts.length > 0 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 1.5 }}>
          {posts.map((p) => {
            const meta = STATUS_META[p.status] ?? STATUS_META.DRAFT;
            const pending = p.status === 'PENDING_REVIEW';
            return (
              <Box key={p.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, borderRadius: 'var(--radius-md)', border: '1px solid var(--line)', bgcolor: 'var(--card)' }}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                    <Box sx={{ fontSize: 'var(--text-md)', fontWeight: 'var(--fw-semibold)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title || '(sans titre)'}</Box>
                    {p.aiGenerated && <Box component="span" sx={aiChipSx}>IA</Box>}
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25, fontSize: 'var(--text-2xs)', color: meta.color }}>
                    <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: meta.color, flexShrink: 0 }} />
                    {meta.label} · /{p.slug}
                  </Box>
                </Box>
                {pending && (
                  <>
                    <ButtonBase onClick={async () => { if (siteId != null) { await sitesApi.approvePost(siteId, p.id); reload(); } }} sx={{ ...primaryBtnSx, height: 32, px: 1.25 }}>
                      <Check size={14} strokeWidth={2.4} /> Valider &amp; publier
                    </ButtonBase>
                    <ButtonBase onClick={async () => { if (siteId != null) { await sitesApi.rejectPost(siteId, p.id); reload(); } }} sx={ghostBtnSx}>Brouillon</ButtonBase>
                  </>
                )}
                <ButtonBase
                  onClick={() => setTranslatingPost(p)}
                  disabled={postTargets(p).length === 0}
                  aria-label={t('bookingEngine.studio.ai.translate.postAction', 'Traduire (IA)')}
                  title={t('bookingEngine.studio.ai.translate.postTooltip', 'Traduire cet article (IA) — crée des variantes en brouillon')}
                  sx={{ ...ghostBtnSx, gap: 0.5, color: 'var(--accent)', borderColor: 'var(--accent)' }}>
                  <Languages size={14} strokeWidth={2.2} /> {t('bookingEngine.studio.ai.translate.postAction', 'Traduire (IA)')}
                </ButtonBase>
                <ButtonBase onClick={() => setEditing(p)} sx={ghostBtnSx}>Éditer</ButtonBase>
                <ButtonBase
                  onClick={async () => { if (siteId != null) { await sitesApi.deletePost(siteId, p.id); reload(); } }}
                  aria-label="Supprimer" sx={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', color: 'var(--muted)', cursor: 'pointer', flexShrink: 0, '&:hover': { bgcolor: 'var(--err-soft)', color: 'var(--err)' } }}>
                  <Trash2 size={15} strokeWidth={2} />
                </ButtonBase>
              </Box>
            );
          })}
        </Box>
      )}

      <TranslateModal
        open={translatingPost != null}
        onClose={() => setTranslatingPost(null)}
        targetName={translatingPost?.title ?? null}
        availableTargets={translatingPost ? postTargets(translatingPost) : []}
        onTranslate={handleAutoTranslatePost}
      />
    </Box>
  );
}

function BlogEditor({ siteId, post, onClose, onSaved }: { siteId: number; post: BlogPost | null; onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState<Draft>(post ? toDraft(post) : EMPTY);
  const [topic, setTopic] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof Draft, v: string) => setDraft((d) => ({ ...d, [k]: v }));

  const generate = async () => {
    if (!topic.trim() || generating) return;
    setGenerating(true);
    setErr(null);
    try {
      const a = await sitesApi.generateArticle(siteId, topic.trim(), draft.locale || undefined);
      setDraft((d) => ({
        ...d,
        title: a.title ?? d.title,
        slug: d.slug || slugify(a.title ?? ''),
        excerpt: a.excerpt ?? d.excerpt,
        body: a.body ?? d.body,
        seoTitle: a.seoTitle ?? d.seoTitle,
        seoDescription: a.seoDescription ?? d.seoDescription,
        aiGenerated: true, // contenu IA → relecture manuelle d'autant plus requise
      }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Génération impossible (IA désactivée ou budget atteint ?)');
    } finally {
      setGenerating(false);
    }
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setErr(null);
    const body: BlogPostUpsert = {
      title: draft.title.trim(),
      slug: (draft.slug.trim() || slugify(draft.title)) || 'article',
      excerpt: draft.excerpt.trim() || null,
      body: draft.body,
      status: draft.status,
      locale: draft.locale.trim() || null,
      seoTitle: draft.seoTitle.trim() || null,
      seoDescription: draft.seoDescription.trim() || null,
      coverImageUrl: draft.coverImageUrl.trim() || null,
      aiGenerated: draft.aiGenerated,
    };
    try {
      if (post) await sitesApi.updatePost(siteId, post.id, body);
      else await sitesApi.createPost(siteId, body);
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Enregistrement impossible');
      setSaving(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 760, mx: 'auto', px: { xs: 2, md: 3 }, py: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ButtonBase onClick={onClose} aria-label="Retour" sx={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', color: 'var(--muted)', cursor: 'pointer', '&:hover': { bgcolor: 'var(--hover)', color: 'var(--ink)' } }}>
          <ArrowLeft size={17} strokeWidth={2} />
        </ButtonBase>
        <Box sx={{ flex: 1, fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-bold)' }}>{post ? "Éditer l'article" : 'Nouvel article'}</Box>
        <ButtonBase onClick={save} disabled={saving || !draft.title.trim()} sx={primaryBtnSx}>
          <Check size={15} strokeWidth={2.4} /> {saving ? 'Enregistrement…' : 'Enregistrer'}
        </ButtonBase>
      </Box>

      {/* Génération IA */}
      <Box sx={{ p: 1.5, borderRadius: 'var(--radius-md)', border: '1px solid var(--line)', bgcolor: 'var(--accent-soft)', display: 'flex', gap: 1, alignItems: 'center' }}>
        <Wand2 size={16} strokeWidth={2} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <InputBase value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Sujet de l'article (ex. « Que faire à Lyon en hiver »)"
          onKeyDown={(e) => { if (e.key === 'Enter') generate(); }}
          sx={{ flex: 1, fontSize: 'var(--text-sm)', color: 'var(--ink)' }} />
        <ButtonBase onClick={generate} disabled={generating || !topic.trim()} sx={{ ...ghostBtnSx, color: 'var(--accent)', borderColor: 'var(--accent)' }}>
          {generating ? 'Génération…' : 'Générer (IA)'}
        </ButtonBase>
      </Box>

      {err && <Box sx={{ fontSize: 'var(--text-sm)', color: 'var(--err)' }}>{err}</Box>}

      <Field label="Titre"><InputBase value={draft.title} onChange={(e) => set('title', e.target.value)} sx={inputSx} placeholder="Titre de l'article" /></Field>
      <Box sx={{ display: 'flex', gap: 1.5 }}>
        <Field label="Chemin (slug)"><InputBase value={draft.slug} onChange={(e) => set('slug', e.target.value)} sx={inputSx} placeholder="auto depuis le titre" /></Field>
        <Field label="Statut">
          <Box component="select" value={draft.status} onChange={(e) => set('status', (e.target as HTMLSelectElement).value)} sx={selectSx}>
            <option value="DRAFT">Brouillon</option>
            <option value="PENDING_REVIEW">Soumettre à validation</option>
            {draft.status === 'PUBLISHED' && <option value="PUBLISHED">Publié — en ligne</option>}
          </Box>
        </Field>
        <Field label="Langue"><InputBase value={draft.locale} onChange={(e) => set('locale', e.target.value)} sx={inputSx} placeholder="fr, en… (vide = toutes)" /></Field>
      </Box>
      {draft.status === 'PUBLISHED' && (
        <Box sx={{ fontSize: 'var(--text-2xs)', color: 'var(--warn, #B26B00)' }}>
          Toute modification enregistrée repassera par la validation avant une nouvelle mise en ligne.
        </Box>
      )}
      <Field label="Extrait"><InputBase value={draft.excerpt} onChange={(e) => set('excerpt', e.target.value)} sx={inputSx} multiline minRows={2} placeholder="Résumé court (listes, SEO)" /></Field>
      <Field label="Contenu (markdown)"><InputBase value={draft.body} onChange={(e) => set('body', e.target.value)} sx={{ ...inputSx, '& textarea': { lineHeight: 1.6, fontFamily: 'var(--font-mono, monospace)' } }} multiline minRows={12} placeholder="Corps de l'article en markdown…" /></Field>
      <Field label="Image de couverture (URL)"><InputBase value={draft.coverImageUrl} onChange={(e) => set('coverImageUrl', e.target.value)} sx={inputSx} placeholder="https://…" /></Field>
      <Field label="Titre SEO"><InputBase value={draft.seoTitle} onChange={(e) => set('seoTitle', e.target.value)} sx={inputSx} placeholder="≤ 60 caractères" /></Field>
      <Field label="Meta description SEO"><InputBase value={draft.seoDescription} onChange={(e) => set('seoDescription', e.target.value)} sx={inputSx} multiline minRows={2} placeholder="≤ 155 caractères" /></Field>
    </Box>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Box component="label" sx={{ display: 'block', mb: 0.5, fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--body)' }}>{label}</Box>
      {children}
    </Box>
  );
}

const inputSx = {
  width: '100%', px: 1.25, py: 0.75, fontSize: 'var(--text-md)', color: 'var(--ink)',
  bgcolor: 'var(--field)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)',
  '&.Mui-focused': { borderColor: 'var(--accent)', boxShadow: '0 0 0 3px var(--accent-soft)' },
} as const;

const selectSx = {
  width: '100%', height: 38, px: 1, fontSize: 'var(--text-md)', color: 'var(--ink)',
  bgcolor: 'var(--field)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', cursor: 'pointer',
} as const;

const primaryBtnSx = {
  display: 'inline-flex', alignItems: 'center', gap: 0.5, height: 36, px: 1.75, flexShrink: 0,
  borderRadius: 'var(--radius-md)', bgcolor: 'var(--accent)', color: 'var(--on-accent)',
  fontWeight: 'var(--fw-semibold)', fontSize: 'var(--text-sm)', cursor: 'pointer',
  '&:hover': { bgcolor: 'var(--accent-deep)' }, '&.Mui-disabled': { opacity: 0.5 },
  '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
} as const;

const ghostBtnSx = {
  display: 'inline-flex', alignItems: 'center', gap: 0.5, height: 32, px: 1.5, flexShrink: 0,
  borderRadius: 'var(--radius-md)', border: '1px solid var(--line)', color: 'var(--body)',
  fontWeight: 'var(--fw-medium)', fontSize: 'var(--text-sm)', cursor: 'pointer',
  '&:hover': { borderColor: 'var(--accent)', color: 'var(--ink)' }, '&.Mui-disabled': { opacity: 0.5 },
  '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
} as const;

const aiChipSx = {
  flexShrink: 0, display: 'inline-flex', alignItems: 'center', px: 0.75, height: 17,
  borderRadius: 999, bgcolor: 'var(--accent-soft)', color: 'var(--accent)',
  fontSize: 'var(--text-2xs)', fontWeight: 'var(--fw-bold)', letterSpacing: '.04em',
} as const;
