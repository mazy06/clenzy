import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Skeleton, Textarea } from '../../../../components/ui';
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
          <div className="font-[family-name:var(--font-display)] text-[var(--text-xl)] font-[family-name:var(--fw-bold)]">Articles de blog</div>
          <div className="text-[var(--text-sm)] text-[var(--muted)] mt-0.5">Rédige ou génère des articles ; les articles publiés apparaissent sur ton site.</div>
        </div>
        <div className="flex-1" />
        <Button size="lg" onClick={() => setEditing('new')} disabled={siteId == null} className={PRIMARY_BTN_CLASS}>
          <Plus size={16} strokeWidth={2.2} /> Nouvel article
        </Button>
      </div>

      <div className="flex items-center gap-1.5 mb-3 p-2 rounded-[var(--radius-md)] bg-[var(--accent-soft)] text-[var(--accent)] text-[var(--text-2xs)] leading-[1.4]">
        <AlertTriangle size={15} strokeWidth={2} style={{ flexShrink: 0 }} />
        La publication est soumise à <strong>validation manuelle</strong> : un article (surtout s'il est généré par IA) doit être relu puis approuvé. Les relecteurs de l'organisation sont alertés à chaque soumission.
      </div>

      {posts === null && (
        <div className="flex flex-col gap-1.5">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-[var(--radius-md)] bg-[var(--hover)]" />)}
        </div>
      )}

      {posts?.length === 0 && (
        <div className="text-center py-10 text-[var(--muted)]">
          <div className="w-[52px] h-[52px] mx-auto mb-2 flex items-center justify-center rounded-[var(--radius-lg)] bg-[var(--accent-soft)] text-[var(--accent)]">
            <FileText size={24} strokeWidth={1.8} />
          </div>
          <div className="text-[var(--text-md)] font-[family-name:var(--fw-semibold)] text-[var(--ink)] mb-0.5">Aucun article</div>
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
                    <div className="text-[var(--text-md)] font-[family-name:var(--fw-semibold)] whitespace-nowrap overflow-hidden text-ellipsis">{p.title || '(sans titre)'}</div>
                    {p.aiGenerated && <span className="shrink-0 inline-flex items-center px-[4.5px] h-[17px] rounded-full bg-[var(--accent-soft)] text-[var(--accent)] text-[var(--text-2xs)] font-bold tracking-[.04em]">IA</span>}
                  </div>
                  <div className="flex items-center gap-[3px] mt-[1.5px] text-[var(--text-2xs)]" style={{ color: meta.color }}>
                    <span className="w-[6px] h-[6px] rounded-[50%] shrink-0" style={{ backgroundColor: meta.color }} />
                    {meta.label} · /{p.slug}
                  </div>
                </div>
                {pending && (
                  <>
                    <Button onClick={async () => { if (siteId != null) { await sitesApi.approvePost(siteId, p.id); reload(); } }} className={PRIMARY_BTN_CLASS}>
                      <Check size={14} strokeWidth={2.4} /> Valider &amp; publier
                    </Button>
                    <Button variant="outline" onClick={async () => { if (siteId != null) { await sitesApi.rejectPost(siteId, p.id); reload(); } }} className={GHOST_BTN_CLASS}>Brouillon</Button>
                  </>
                )}
                <Button
                  variant="outline"
                  onClick={() => setTranslatingPost(p)}
                  disabled={postTargets(p).length === 0}
                  aria-label={t('bookingEngine.studio.ai.translate.postAction', 'Traduire (IA)')}
                  title={t('bookingEngine.studio.ai.translate.postTooltip', 'Traduire cet article (IA) — crée des variantes en brouillon')}
                  className={GHOST_ACCENT_BTN_CLASS}>
                  <Languages size={14} strokeWidth={2.2} /> {t('bookingEngine.studio.ai.translate.postAction', 'Traduire (IA)')}
                </Button>
                <Button variant="outline" onClick={() => setEditing(p)} className={GHOST_BTN_CLASS}>Éditer</Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={async () => { if (siteId != null) { await sitesApi.deletePost(siteId, p.id); reload(); } }}
                  aria-label="Supprimer"
                  className="text-[var(--muted)] hover:bg-[var(--err-soft)] hover:text-[var(--err)]">
                  <Trash2 size={15} strokeWidth={2} />
                </Button>
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
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Retour" className="text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--ink)]">
          <ArrowLeft size={17} strokeWidth={2} />
        </Button>
        <div className="flex-1 font-[family-name:var(--font-display)] text-[var(--text-lg)] font-[family-name:var(--fw-bold)]">{post ? "Éditer l'article" : 'Nouvel article'}</div>
        <Button size="lg" onClick={save} disabled={saving || !draft.title.trim()} className={PRIMARY_BTN_CLASS}>
          <Check size={15} strokeWidth={2.4} /> {saving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </div>

      {/* Génération IA */}
      <div className="p-2 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--accent-soft)] flex gap-1.5 items-center">
        <Wand2 size={16} strokeWidth={2} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        {/* Champ nu : la boite qui l'entoure porte deja bordure et fond. */}
        <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Sujet de l'article (ex. « Que faire à Lyon en hiver »)"
          aria-label="Sujet de l'article"
          onKeyDown={(e) => { if (e.key === 'Enter') generate(); }}
          className="flex-1 border-0 bg-transparent px-0 text-[var(--text-sm)] text-[var(--ink)] focus-visible:ring-0" />
        <Button variant="outline" onClick={generate} disabled={generating || !topic.trim()} className={GHOST_ACCENT_BTN_CLASS}>
          {generating ? 'Génération…' : 'Générer (IA)'}
        </Button>
      </div>

      {err && <div className="text-[var(--text-sm)] text-[var(--err)]">{err}</div>}

      <Field label="Titre"><Input value={draft.title} onChange={(e) => set('title', e.target.value)} className={FIELD_CLASS} placeholder="Titre de l'article" /></Field>
      <div className="flex gap-2">
        <Field label="Chemin (slug)"><Input value={draft.slug} onChange={(e) => set('slug', e.target.value)} className={FIELD_CLASS} placeholder="auto depuis le titre" /></Field>
        <Field label="Statut">
          <select
            value={draft.status}
            onChange={(e) => set('status', e.target.value)}
            className="w-full h-[38px] px-1.5 text-[var(--text-md)] text-[var(--ink)] bg-[var(--field)] border border-solid border-[var(--line)] rounded-[var(--radius-md)] cursor-pointer"
          >
            <option value="DRAFT">Brouillon</option>
            <option value="PENDING_REVIEW">Soumettre à validation</option>
            {draft.status === 'PUBLISHED' && <option value="PUBLISHED">Publié — en ligne</option>}
          </select>
        </Field>
        <Field label="Langue"><Input value={draft.locale} onChange={(e) => set('locale', e.target.value)} className={FIELD_CLASS} placeholder="fr, en… (vide = toutes)" /></Field>
      </div>
      {draft.status === 'PUBLISHED' && (
        <div className="text-[var(--text-2xs)] text-[var(--warn,_#B26B00)]">
          Toute modification enregistrée repassera par la validation avant une nouvelle mise en ligne.
        </div>
      )}
      {/* min-h-[Nlh] et pas `rows` : le Textarea du kit pose field-sizing:content,
          qui neutralise l'attribut rows. */}
      <Field label="Extrait"><Textarea value={draft.excerpt} onChange={(e) => set('excerpt', e.target.value)} className={`${FIELD_CLASS} min-h-[2lh]`} placeholder="Résumé court (listes, SEO)" /></Field>
      <Field label="Contenu (markdown)"><Textarea value={draft.body} onChange={(e) => set('body', e.target.value)} className={`${FIELD_CLASS} min-h-[12lh]`} style={{ lineHeight: 1.6, fontFamily: 'var(--font-mono, monospace)' }} placeholder="Corps de l'article en markdown…" /></Field>
      <Field label="Image de couverture (URL)"><Input value={draft.coverImageUrl} onChange={(e) => set('coverImageUrl', e.target.value)} className={FIELD_CLASS} placeholder="https://…" /></Field>
      <Field label="Titre SEO"><Input value={draft.seoTitle} onChange={(e) => set('seoTitle', e.target.value)} className={FIELD_CLASS} placeholder="≤ 60 caractères" /></Field>
      <Field label="Meta description SEO"><Textarea value={draft.seoDescription} onChange={(e) => set('seoDescription', e.target.value)} className={`${FIELD_CLASS} min-h-[2lh]`} placeholder="≤ 155 caractères" /></Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex-1 min-w-0">
      <label className="block mb-0.5 text-[var(--text-sm)] font-[family-name:var(--fw-medium)] text-[var(--body)]">{label}</label>
      {children}
    </div>
  );
}

// Peau des champs et des boutons du Studio : l'accent y est celui du site en
// cours d'edition (--accent), pas la primaire du kit. Seules ces couleurs sont
// reportees ; hauteurs, rayons et graisses viennent des gabarits du kit.
const FIELD_CLASS = 'w-full border-[var(--line)] bg-[var(--field)] text-[var(--ink)]';

const PRIMARY_BTN_CLASS = 'bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-deep)]';

const GHOST_BTN_CLASS =
  'border-[var(--line)] bg-transparent text-[var(--body)] hover:bg-transparent hover:border-[var(--accent)] hover:text-[var(--ink)]';

const GHOST_ACCENT_BTN_CLASS =
  'border-[var(--accent)] bg-transparent text-[var(--accent)] hover:bg-transparent hover:text-[var(--ink)]';
