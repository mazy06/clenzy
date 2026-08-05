import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Field as FieldRoot,
  FieldLabel,
  Input,
  Item,
  ItemActions,
  ItemContent,
  ItemTitle,
  NativeSelect,
  Skeleton,
  Textarea,
} from '../../../../components/ui';
import EmptyState from '../../../../components/EmptyState';
import { Plus, Wand2, Trash2, ArrowLeft, Check, AlertTriangle, FileText, Languages } from 'lucide-react';
import { sitesApi, type BlogPost, type BlogPostUpsert } from '../../../../services/api/sitesApi';
import { useNotification } from '../../../../hooks/useNotification';
import TranslateModal from '../TranslateModal';
import type { StudioConfigState } from '../useStudioConfig';

/**
 * Section « Blog » du Studio (2.13). Gère les articles d'un site (CRUD réutilisant le backend
 * BlogPost) + génération d'un brouillon par IA (`/sites/{id}/blog/ai`, réutilise SiteContentAiService).
 * Résout le site via `ensureForConfig` (comme le builder). Les articles publiés sont servis par le
 * SSR (dépôt `clenzy-sites`) via la livraison blog existante.
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

/** Statut d'article → pastille du kit (le ton porte le sens, plus la couleur brute). */
const STATUS_META: Record<string, { label: string; variant: 'secondary' | 'warning' | 'success' }> = {
  DRAFT: { label: 'Brouillon', variant: 'secondary' },
  PENDING_REVIEW: { label: 'En attente de validation', variant: 'warning' },
  PUBLISHED: { label: 'Publié', variant: 'success' },
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
      <Alert variant="destructive" className="m-4">
        <AlertTriangle />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
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
          <div className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight text-balance text-foreground">Articles de blog</div>
          <div className="text-xs text-muted-foreground mt-0.5">Rédige ou génère des articles ; les articles publiés apparaissent sur ton site.</div>
        </div>
        <div className="flex-1" />
        <Button size="lg" onClick={() => setEditing('new')} disabled={siteId == null} className="cursor-pointer">
          <Plus size={16} strokeWidth={2.2} /> Nouvel article
        </Button>
      </div>

      <Alert variant="warning" className="mb-3">
        <AlertTriangle />
        <AlertDescription>
          La publication est soumise à <strong>validation manuelle</strong> : un article (surtout s'il est généré par IA) doit être relu puis approuvé. Les relecteurs de l'organisation sont alertés à chaque soumission.
        </AlertDescription>
      </Alert>

      {posts === null && (
        <div className="flex flex-col gap-1.5">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      )}

      {posts?.length === 0 && (
        <EmptyState
          icon={<FileText />}
          title="Aucun article"
          description="Crée ton premier article ou laisse l'IA t'en proposer un."
        />
      )}

      {posts && posts.length > 0 && (
        <div className="grid grid-cols-[1fr] min-[1200px]:grid-cols-[1fr_1fr] gap-[9px]">
          {posts.map((p) => {
            const meta = STATUS_META[p.status] ?? STATUS_META.DRAFT;
            const pending = p.status === 'PENDING_REVIEW';
            return (
              <Item variant="outline" size="xs" className="bg-card" key={p.id}>
                <ItemContent className="min-w-0">
                  <ItemTitle className="w-full min-w-0 gap-1">
                    <span className="min-w-0 truncate text-sm font-semibold text-foreground">{p.title || '(sans titre)'}</span>
                    {p.aiGenerated && <Badge variant="secondary" className="shrink-0 text-2xs font-bold tracking-[.04em]">IA</Badge>}
                  </ItemTitle>
                  <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-2xs">
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                    <span className="truncate text-muted-foreground">/{p.slug}</span>
                  </div>
                </ItemContent>
                <ItemActions className="gap-1.5">
                  {pending && (
                    <>
                      <Button size="sm" onClick={async () => { if (siteId != null) { await sitesApi.approvePost(siteId, p.id); reload(); } }} className="cursor-pointer">
                        <Check size={14} strokeWidth={2.4} /> Valider &amp; publier
                      </Button>
                      <Button size="sm" variant="outline" onClick={async () => { if (siteId != null) { await sitesApi.rejectPost(siteId, p.id); reload(); } }} className="cursor-pointer">Brouillon</Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setTranslatingPost(p)}
                    disabled={postTargets(p).length === 0}
                    aria-label={t('bookingEngine.studio.ai.translate.postAction', 'Traduire (IA)')}
                    title={t('bookingEngine.studio.ai.translate.postTooltip', 'Traduire cet article (IA) — crée des variantes en brouillon')}
                    className="cursor-pointer">
                    <Languages size={14} strokeWidth={2.2} /> {t('bookingEngine.studio.ai.translate.postAction', 'Traduire (IA)')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(p)} className="cursor-pointer">Éditer</Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={async () => { if (siteId != null) { await sitesApi.deletePost(siteId, p.id); reload(); } }}
                    aria-label="Supprimer"
                    className="cursor-pointer text-muted-foreground hover:bg-destructive-soft hover:text-destructive-ink">
                    <Trash2 size={15} strokeWidth={2} />
                  </Button>
                </ItemActions>
              </Item>
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
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Retour" className="cursor-pointer text-muted-foreground hover:text-foreground">
          <ArrowLeft size={17} strokeWidth={2} />
        </Button>
        <div className="flex-1 font-[family-name:var(--font-display)] text-base font-bold tracking-tight text-balance text-foreground">{post ? "Éditer l'article" : 'Nouvel article'}</div>
        <Button size="lg" onClick={save} disabled={saving || !draft.title.trim()} className="cursor-pointer">
          <Check size={15} strokeWidth={2.4} /> {saving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </div>

      {/* Génération IA */}
      <div className="p-2 rounded-lg border border-border bg-primary-soft flex gap-1.5 items-center">
        <Wand2 size={16} strokeWidth={2} className="shrink-0 text-primary" />
        {/* Champ nu : la boite qui l'entoure porte deja bordure et fond. */}
        <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Sujet de l'article (ex. « Que faire à Lyon en hiver »)"
          aria-label="Sujet de l'article"
          onKeyDown={(e) => { if (e.key === 'Enter') generate(); }}
          className="flex-1 border-0 bg-transparent px-0 text-xs text-foreground focus-visible:ring-0" />
        <Button variant="outline" onClick={generate} disabled={generating || !topic.trim()} className="cursor-pointer">
          {generating ? 'Génération…' : 'Générer (IA)'}
        </Button>
      </div>

      {err && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      )}

      <Field label="Titre"><Input value={draft.title} onChange={(e) => set('title', e.target.value)} className={FIELD_CLASS} placeholder="Titre de l'article" /></Field>
      <div className="flex gap-2">
        <Field label="Chemin (slug)"><Input value={draft.slug} onChange={(e) => set('slug', e.target.value)} className={FIELD_CLASS} placeholder="auto depuis le titre" /></Field>
        <Field label="Statut">
          <NativeSelect
            value={draft.status}
            onChange={(e) => set('status', e.target.value)}
            className="w-full [&_select]:cursor-pointer"
          >
            <option value="DRAFT">Brouillon</option>
            <option value="PENDING_REVIEW">Soumettre à validation</option>
            {draft.status === 'PUBLISHED' && <option value="PUBLISHED">Publié — en ligne</option>}
          </NativeSelect>
        </Field>
        <Field label="Langue"><Input value={draft.locale} onChange={(e) => set('locale', e.target.value)} className={FIELD_CLASS} placeholder="fr, en… (vide = toutes)" /></Field>
      </div>
      {draft.status === 'PUBLISHED' && (
        <div className="text-2xs text-warning-ink">
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
    <FieldRoot className="flex-1 min-w-0">
      <FieldLabel className="text-xs font-medium text-foreground">{label}</FieldLabel>
      {children}
    </FieldRoot>
  );
}

// Le gabarit des champs (bordure, fond, rayon, anneau de focus) vient du kit :
// il ne reste plus que la largeur à imposer.
const FIELD_CLASS = 'w-full';
