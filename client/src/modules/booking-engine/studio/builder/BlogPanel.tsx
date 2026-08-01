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

/** Langues cibles d'un article = locales supportées hors langue de l'article (vide = langue par défaut). */
const postTargets = (p: BlogPost) => SUPPORTED_LOCALES.filter((l) => l !== (p.locale ?? 'fr'));

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

  if (error) {
    return (
      <div className="p-4 flex items-center gap-1.5 text-[var(--err)] text-[var(--text-sm)]">
        <AlertTriangle size={16} strokeWidth={2} /> {error}
      </div>
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
    <div className="max-w-[1080px] mx-auto px-3 min-[900px]:px-[18px] py-[18px]">
      <div className="flex items-end gap-3 mb-4">
        <div>
          <div className="font-[var(--font-display)] text-[var(--text-xl)] font-[var(--fw-bold)]">Articles de blog</div>
          <div className="text-[var(--text-sm)] text-[var(--muted)] mt-0.5">Rédige ou génère des articles ; les articles publiés apparaissent sur ton site.</div>
        </div>
        <div className="flex-1" />
        <ButtonBase onClick={() => setEditing('new')} disabled={siteId == null} sx={primaryBtnSx}>
          <Plus size={16} strokeWidth={2.2} /> Nouvel article
        </ButtonBase>
      </div>

      <div className="flex items-center gap-1.5 mb-3 p-2 rounded-[var(--radius-md)] bg-[var(--accent-soft)] text-[var(--accent)] text-[var(--text-2xs)] leading-[1.4]">
        <AlertTriangle size={15} strokeWidth={2} style={{ flexShrink: 0 }} />
        La publication est soumise à <strong>validation manuelle</strong> : un article (surtout s'il est généré par IA) doit être relu puis approuvé. Les relecteurs de l'organisation sont alertés à chaque soumission.
      </div>

      {posts === null && (
        <div className="flex flex-col gap-1.5">
          {[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={64} sx={{ borderRadius: 'var(--radius-md)', bgcolor: 'var(--hover)' }} />)}
        </div>
      )}

      {posts?.length === 0 && (
        <div className="text-center py-10 text-[var(--muted)]">
          <div className="w-[52px] h-[52px] mx-auto mb-2 flex items-center justify-center rounded-[var(--radius-lg)] bg-[var(--accent-soft)] text-[var(--accent)]">
            <FileText size={24} strokeWidth={1.8} />
          </div>
          <div className="text-[var(--text-md)] font-[var(--fw-semibold)] text-[var(--ink)] mb-0.5">Aucun article</div>
          <div className="text-[var(--text-sm)]">Crée ton premier article ou laisse l'IA t'en proposer un.</div>
        </div>
      )}

      {posts && posts.length > 0 && (
        <div className="grid grid-cols-[1fr] min-[1200px]:grid-cols-[1fr_1fr] gap-[9px]">
          {posts.map((p) => {
            const meta = STATUS_META[p.status] ?? STATUS_META.DRAFT;
            const pending = p.status === 'PENDING_REVIEW';
            return (
              <div className="flex items-center gap-1.5 p-2 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--card)]" key={p.id}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 min-w-0">
                    <div className="text-[var(--text-md)] font-[var(--fw-semibold)] whitespace-nowrap overflow-hidden text-ellipsis">{p.title || '(sans titre)'}</div>
                    {p.aiGenerated && <Box component="span" sx={aiChipSx}>IA</Box>}
                  </div>
                  <div className="flex items-center gap-[3px] mt-[1.5px] text-[var(--text-2xs)]" style={{ color: meta.color }}>
                    <span className="w-[6px] h-[6px] rounded-[50%] shrink-0" style={{ backgroundColor: meta.color }} />
                    {meta.label} · /{p.slug}
                  </div>
                </div>
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
              </div>
            );
          })}
        </div>
      )}

      <TranslateModal
        open={translatingPost != null}
        onClose={() => setTranslatingPost(null)}
        targetName={translatingPost?.title ?? null}
        availableTargets={translatingPost ? postTargets(translatingPost) : []}
        onTranslate={handleAutoTranslatePost}
      />
    </div>
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
    <div className="max-w-[760px] mx-auto px-3 min-[900px]:px-[18px] py-[18px] flex flex-col gap-3">
      <div className="flex items-center gap-1.5">
        <ButtonBase onClick={onClose} aria-label="Retour" sx={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', color: 'var(--muted)', cursor: 'pointer', '&:hover': { bgcolor: 'var(--hover)', color: 'var(--ink)' } }}>
          <ArrowLeft size={17} strokeWidth={2} />
        </ButtonBase>
        <div className="flex-1 font-[var(--font-display)] text-[var(--text-lg)] font-[var(--fw-bold)]">{post ? "Éditer l'article" : 'Nouvel article'}</div>
        <ButtonBase onClick={save} disabled={saving || !draft.title.trim()} sx={primaryBtnSx}>
          <Check size={15} strokeWidth={2.4} /> {saving ? 'Enregistrement…' : 'Enregistrer'}
        </ButtonBase>
      </div>

      {/* Génération IA */}
      <div className="p-2 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--accent-soft)] flex gap-1.5 items-center">
        <Wand2 size={16} strokeWidth={2} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <InputBase value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Sujet de l'article (ex. « Que faire à Lyon en hiver »)"
          onKeyDown={(e) => { if (e.key === 'Enter') generate(); }}
          sx={{ flex: 1, fontSize: 'var(--text-sm)', color: 'var(--ink)' }} />
        <ButtonBase onClick={generate} disabled={generating || !topic.trim()} sx={{ ...ghostBtnSx, color: 'var(--accent)', borderColor: 'var(--accent)' }}>
          {generating ? 'Génération…' : 'Générer (IA)'}
        </ButtonBase>
      </div>

      {err && <div className="text-[var(--text-sm)] text-[var(--err)]">{err}</div>}

      <Field label="Titre"><InputBase value={draft.title} onChange={(e) => set('title', e.target.value)} sx={inputSx} placeholder="Titre de l'article" /></Field>
      <div className="flex gap-2">
        <Field label="Chemin (slug)"><InputBase value={draft.slug} onChange={(e) => set('slug', e.target.value)} sx={inputSx} placeholder="auto depuis le titre" /></Field>
        <Field label="Statut">
          <Box component="select" value={draft.status} onChange={(e) => set('status', (e.target as HTMLSelectElement).value)} sx={selectSx}>
            <option value="DRAFT">Brouillon</option>
            <option value="PENDING_REVIEW">Soumettre à validation</option>
            {draft.status === 'PUBLISHED' && <option value="PUBLISHED">Publié — en ligne</option>}
          </Box>
        </Field>
        <Field label="Langue"><InputBase value={draft.locale} onChange={(e) => set('locale', e.target.value)} sx={inputSx} placeholder="fr, en… (vide = toutes)" /></Field>
      </div>
      {draft.status === 'PUBLISHED' && (
        <div className="text-[var(--text-2xs)] text-[var(--warn,_#B26B00)]">
          Toute modification enregistrée repassera par la validation avant une nouvelle mise en ligne.
        </div>
      )}
      <Field label="Extrait"><InputBase value={draft.excerpt} onChange={(e) => set('excerpt', e.target.value)} sx={inputSx} multiline minRows={2} placeholder="Résumé court (listes, SEO)" /></Field>
      <Field label="Contenu (markdown)"><InputBase value={draft.body} onChange={(e) => set('body', e.target.value)} sx={{ ...inputSx, '& textarea': { lineHeight: 1.6, fontFamily: 'var(--font-mono, monospace)' } }} multiline minRows={12} placeholder="Corps de l'article en markdown…" /></Field>
      <Field label="Image de couverture (URL)"><InputBase value={draft.coverImageUrl} onChange={(e) => set('coverImageUrl', e.target.value)} sx={inputSx} placeholder="https://…" /></Field>
      <Field label="Titre SEO"><InputBase value={draft.seoTitle} onChange={(e) => set('seoTitle', e.target.value)} sx={inputSx} placeholder="≤ 60 caractères" /></Field>
      <Field label="Meta description SEO"><InputBase value={draft.seoDescription} onChange={(e) => set('seoDescription', e.target.value)} sx={inputSx} multiline minRows={2} placeholder="≤ 155 caractères" /></Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex-1 min-w-0">
      <label className="block mb-0.5 text-[var(--text-sm)] font-[var(--fw-medium)] text-[var(--body)]">{label}</label>
      {children}
    </div>
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
