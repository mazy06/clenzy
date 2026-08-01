import React, { useState, useMemo, useCallback } from 'react';
import StatusChip from '../../components/StatusChip';
import { Badge, Button } from '../../components/ui';
import { Spinner } from '../../components/ui';
import { Card } from '../../components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui';
import { createPortal } from 'react-dom';
import {
  Collapsible,
  CollapsibleContent,
  Field,
  FieldLabel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../components/ui';
import {
  ExpandMore,
  ExpandLess,
  Business,
  CleaningServices,
  Handyman,
  Yard,
  LocalLaundryService,
  Phone,
  Email,
  LocationOn,
  FilterList,
  Language,
  LinkedIn,
  CloudUpload,
  TrendingUp,
} from '../../icons';
import { useProspects, useUpdateProspect } from '../../hooks/useProspects';
import type { ProspectDto } from '../../services/api/prospectsApi';
import ProspectImportModal from './ProspectImportModal';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import { useScreenSearch } from '../../components/ScreenChrome';

// ─── Types ─────────────────────────────────────────────────────────────────────

type ProspectStatus = 'TO_CONTACT' | 'IN_DISCUSSION' | 'PARTNER' | 'REJECTED';

interface ProspectCategory {
  key: string;
  label: string;
  icon: React.ReactElement;
  color: string;
  prospects: ProspectDto[];
}

// ─── Constants ──────────────────────────────────────────────────────────────────

// Statuts → palette Baitly desaturee (a contacter = ambre, discussion = bleu info, partenaire = vert, rejete = neutre)
const STATUS_CONFIG: Record<ProspectStatus, { label: string; color: string }> = {
  TO_CONTACT: { label: 'A contacter', color: '#D4A574' },
  IN_DISCUSSION: { label: 'En discussion', color: '#7BA3C2' },
  PARTNER: { label: 'Partenaire', color: '#4A9B8E' },
  REJECTED: { label: 'Rejete', color: '#8A8378' },
};

// Couleurs data par categorie — palette Baitly desaturee
const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ReactElement; color: string }> = {
  CONCIERGERIES: { label: 'Conciergeries & Agences', icon: <Business size={20} strokeWidth={1.75} />, color: '#7BA3C2' },
  MENAGE: { label: 'Societes de menage', icon: <CleaningServices size={20} strokeWidth={1.75} />, color: '#7B68A8' },
  ARTISANS: { label: 'Artisans & Travaux', icon: <Handyman size={20} strokeWidth={1.75} />, color: '#7EBAD0' },
  ENTRETIEN: { label: 'Entretien exterieur', icon: <Yard size={20} strokeWidth={1.75} />, color: '#4A9B8E' },
  BLANCHISSERIES: { label: 'Blanchisseries', icon: <LocalLaundryService size={20} strokeWidth={1.75} />, color: '#9A7FA3' },
};

const CATEGORY_ORDER = ['CONCIERGERIES', 'MENAGE', 'ARTISANS', 'ENTRETIEN', 'BLANCHISSERIES'];

// ─── Props ──────────────────────────────────────────────────────────────────────

interface ProspectionPageProps {
  embedded?: boolean;
  actionsContainer?: HTMLDivElement | null;
}

// ─── Component ──────────────────────────────────────────────────────────────────

const ProspectionPage: React.FC<ProspectionPageProps> = ({ embedded, actionsContainer }) => {
  const [search, setSearch] = useState('');
  // Recherche de l'écran → champ UNIQUE du PageHeader (cf. ScreenChrome).
  useScreenSearch(search, setSearch, 'Rechercher un prospect…');
  const [statusFilter, setStatusFilter] = useState<ProspectStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    () => new Set(CATEGORY_ORDER),
  );
  const [importOpen, setImportOpen] = useState(false);

  // ── Data from API ──
  const { data: prospects = [], isLoading } = useProspects();
  const updateMutation = useUpdateProspect();

  // ── Group prospects by category ──
  const categories = useMemo<ProspectCategory[]>(() => {
    const grouped = new Map<string, ProspectDto[]>();
    for (const p of prospects) {
      const cat = p.category || 'CONCIERGERIES';
      if (!grouped.has(cat)) grouped.set(cat, []);
      grouped.get(cat)!.push(p);
    }

    return CATEGORY_ORDER
      .filter((key) => grouped.has(key) || categoryFilter === 'all')
      .map((key) => {
        const cfg = CATEGORY_CONFIG[key] || { label: key, icon: <Business size={20} strokeWidth={1.75} />, color: '#8A8378' };
        return {
          key,
          label: cfg.label,
          icon: cfg.icon,
          color: cfg.color,
          prospects: grouped.get(key) || [],
        };
      });
  }, [prospects, categoryFilter]);

  const toggleCategory = (key: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ── Filter categories + prospects ──
  const filteredCategories = useMemo(() => {
    const q = search.toLowerCase().trim();
    return categories.flatMap((cat) => {
      if (categoryFilter !== 'all' && cat.key !== categoryFilter) return [];
      const prospects = cat.prospects.filter((p) => {
        if (statusFilter !== 'all' && p.status !== statusFilter) return false;
        if (q) {
          const name = (p.name || '').toLowerCase();
          const city = (p.city || '').toLowerCase();
          const specialty = (p.specialty || '').toLowerCase();
          if (!name.includes(q) && !city.includes(q) && !specialty.includes(q)) return false;
        }
        return true;
      });
      return prospects.length > 0 ? [{ ...cat, prospects }] : [];
    });
  }, [categories, search, statusFilter, categoryFilter]);

  const totalProspects = filteredCategories.reduce((sum, c) => sum + c.prospects.length, 0);

  // ── Inline status change ──
  const handleStatusChange = useCallback(
    (prospectId: number, newStatus: string) => {
      updateMutation.mutate({ id: prospectId, data: { status: newStatus } });
    },
    [updateMutation],
  );

  // ── Action buttons (portal into PageHeader when embedded) ──
  const actionButtons = (
    <div className="flex items-center gap-1.5">
      <Button size="sm" onClick={() => setImportOpen(true)}>
        <CloudUpload />
        Importer CSV
      </Button>
      <Badge variant="secondary" className="font-semibold text-[0.75rem]">{`${totalProspects} prospect${totalProspects > 1 ? 's' : ''}`}</Badge>
    </div>
  );

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="size-10" />
      </div>
    );
  }

  return (
    <div>
      {embedded && actionsContainer && createPortal(actionButtons, actionsContainer)}

      {/* ── Header standalone (hors Annuaire multi-tabs) ── */}
      {!embedded && (
        <PageHeader
          title="Prospection"
          subtitle="Pipeline commercial : imports CSV, enrichissement et suivi des prospects qualifiés."
          iconBadge={<TrendingUp />}
          backPath="/dashboard"
          showBackButton={false}
          actions={actionButtons}
        />
      )}

      {/* ── Import Modal ── */}
      <ProspectImportModal open={importOpen} onClose={() => setImportOpen(false)} />

      {/* ── Filters bar ── */}
      <Card className="gap-0 py-0 p-3 mb-3">
        <div className="flex gap-3 flex-wrap items-center">
          <Field className="w-auto min-w-[160px]">
            <FieldLabel htmlFor="prospection-filter-category" className="items-center text-[0.8125rem]">
              <span className="inline-flex me-[3px]"><FilterList size={14} strokeWidth={1.75} /></span>
              Categorie
            </FieldLabel>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger id="prospection-filter-category" size="sm" className="w-full text-[0.8125rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {CATEGORY_ORDER.map((key) => (
                  <SelectItem key={key} value={key}>
                    {CATEGORY_CONFIG[key]?.label || key}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field className="w-auto min-w-[140px]">
            <FieldLabel htmlFor="prospection-filter-status" className="text-[0.8125rem]">Statut</FieldLabel>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as ProspectStatus | 'all')}
            >
              <SelectTrigger id="prospection-filter-status" size="sm" className="w-full text-[0.8125rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>
                    <span className="inline-flex items-center gap-1.5">
                      {/* La couleur vient de la donnee : style inline, une classe
                          Tailwind ne peut pas naitre d'une variable. */}
                      <span className="w-[8px] h-[8px] rounded-[50%]" style={{ backgroundColor: cfg.color }} />
                      {cfg.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </Card>

      {/* ── Empty state ── */}
      {prospects.length === 0 && !isLoading ? (
        <EmptyState
          icon={<CloudUpload />}
          title="Aucun prospect pour le moment"
          description="Importez un fichier CSV depuis Vibe Prospecting pour commencer."
          action={(
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <CloudUpload size={16} strokeWidth={1.75} />
              Importer des prospects
            </Button>
          )}
        />
      ) : filteredCategories.length === 0 ? (
        <EmptyState
          icon={<FilterList />}
          title="Aucun prospect ne correspond aux filtres"
          variant="plain"
        />
      ) : (
        <div className="flex flex-col gap-3">
          {filteredCategories.map((cat) => {
            const isExpanded = expandedCategories.has(cat.key);
            return (
              <Card className="gap-0 py-0 overflow-hidden" key={cat.key}>
                {/* Category header — la teinte derive de la couleur de categorie
                    (valeur d'execution) : passee en variables CSS, pas en style
                    inline, sinon le style l'emporterait sur la classe hover:. */}
                <div
                  onClick={() => toggleCategory(cat.key)}
                  className="flex items-center gap-[9px] px-3 py-[9px] cursor-pointer transition-colors duration-150 bg-[var(--cat-bg)] hover:bg-[var(--cat-bg-hover)] dark:bg-[var(--cat-bg-dark)] dark:hover:bg-[var(--cat-bg-hover-dark)]"
                  style={{
                    '--cat-bg': `${cat.color}08`,
                    '--cat-bg-hover': `${cat.color}10`,
                    '--cat-bg-dark': `${cat.color}12`,
                    '--cat-bg-hover-dark': `${cat.color}1A`,
                  } as React.CSSProperties}
                >
                  <div className="flex items-center" style={{ color: cat.color }}>
                    {cat.icon}
                  </div>
                  <p className="cn-text-body1 font-bold text-[0.875rem] flex-1">
                    {cat.label}
                  </p>
                  <StatusChip tokens={{ color: cat.color, bg: `${cat.color}18` }} label={`${cat.prospects.length}`} className="tabular-nums" />
                  {/* Le chevron porte l'action au clavier (l'entete n'est qu'une
                      surface de clic) : stopPropagation evite le double toggle. */}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="ms-[3px]"
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? `Replier ${cat.label}` : `Deplier ${cat.label}`}
                    onClick={(e) => { e.stopPropagation(); toggleCategory(cat.key); }}
                  >
                    {isExpanded ? <ExpandLess size={18} strokeWidth={1.75} /> : <ExpandMore size={18} strokeWidth={1.75} />}
                  </Button>
                </div>

                {/* Prospects table */}
                <Collapsible open={isExpanded}>
                  <CollapsibleContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[0.75rem]">Nom</TableHead>
                          <TableHead className="text-[0.75rem]">Ville</TableHead>
                          <TableHead className="text-[0.75rem]">Specialite</TableHead>
                          <TableHead className="text-[0.75rem]">Taille</TableHead>
                          <TableHead className="text-[0.75rem]">CA</TableHead>
                          <TableHead className="text-[0.75rem]">Liens</TableHead>
                          <TableHead className="text-[0.75rem]">Statut</TableHead>
                          <TableHead className="text-[0.75rem]">Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cat.prospects.map((p) => {
                          const sc = STATUS_CONFIG[(p.status as ProspectStatus) || 'TO_CONTACT'] || STATUS_CONFIG.TO_CONTACT;
                          // le filet de derniere ligne est deja absent cote kit : pas de sx a reporter
                          return (
                            <TableRow key={p.id}>
                              <TableCell>
                                <p className="cn-text-body1 text-[0.8125rem] font-semibold">
                                  {p.name}
                                </p>
                                <div className="flex flex-col gap-0.5 mt-0.5">
                                  {p.email && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="flex items-center gap-0.5 w-fit">
                                          <span className="inline-flex text-muted-foreground opacity-60"><Email size={11} strokeWidth={1.75} /></span>
                                          <p className="cn-text-body1 text-[0.625rem] text-muted-foreground">
                                            {p.email}
                                          </p>
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>{p.email}</TooltipContent>
                                    </Tooltip>
                                  )}
                                  {p.phone && (
                                    <div className="flex items-center gap-0.5">
                                      <span className="inline-flex text-muted-foreground opacity-60"><Phone size={11} strokeWidth={1.75} /></span>
                                      <p className="cn-text-body1 text-[0.625rem] text-muted-foreground">
                                        {p.phone}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-0.5">
                                  <span className="inline-flex text-muted-foreground"><LocationOn size={12} strokeWidth={1.75} /></span>
                                  <p className="cn-text-body1 text-[0.75rem]">{p.city || '\u2014'}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <p className="cn-text-body1 text-[0.75rem]">{p.specialty || '\u2014'}</p>
                              </TableCell>
                              <TableCell>
                                <p className="cn-text-body1 text-[0.6875rem] text-muted-foreground">
                                  {p.employees || '\u2014'}
                                </p>
                              </TableCell>
                              <TableCell>
                                <p className="cn-text-body1 text-[0.6875rem] text-muted-foreground whitespace-nowrap">
                                  {p.revenue ? `${p.revenue} \u20AC` : '\u2014'}
                                </p>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-0.5">
                                  {p.website && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        {/* span : TooltipTrigger asChild pose une ref DOM, que le
                                            Button du kit (fonction, React 18) ne transmet pas. */}
                                        <span className="inline-flex">
                                          <Button
                                            asChild
                                            variant="ghost"
                                            size="icon-sm"
                                            className="text-muted-foreground"
                                            aria-label={`Site web de ${p.name}`}
                                          >
                                            <a
                                              href={p.website.startsWith('http') ? p.website : `https://${p.website}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                            >
                                              <Language size={16} strokeWidth={1.75} />
                                            </a>
                                          </Button>
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent>{p.website}</TooltipContent>
                                    </Tooltip>
                                  )}
                                  {p.linkedIn && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="inline-flex">
                                          <Button
                                            asChild
                                            variant="ghost"
                                            size="icon-sm"
                                            aria-label={`LinkedIn de ${p.name}`}
                                          >
                                            <a href={p.linkedIn} target="_blank" rel="noopener noreferrer">
                                              <LinkedIn size={16} strokeWidth={1.75} color="#0A66C2" />
                                            </a>
                                          </Button>
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent>LinkedIn</TooltipContent>
                                    </Tooltip>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={p.status || 'TO_CONTACT'}
                                  onValueChange={(v) => handleStatusChange(p.id, v)}
                                >
                                  {/* Pastille de statut : la teinte vient de la donnee,
                                      donc en style inline ; le gabarit reste en classes. */}
                                  <SelectTrigger
                                    size="sm"
                                    aria-label={`Statut de ${p.name}`}
                                    className="h-[24px] w-auto gap-1 rounded-full border-none px-1.5 py-0.5 text-[0.625rem] font-semibold shadow-none"
                                    style={{ backgroundColor: `${sc.color}18`, color: sc.color }}
                                  >
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                                      <SelectItem key={key} value={key} className="text-[0.75rem]">
                                        <span className="inline-flex items-center gap-1">
                                          <span className="w-[8px] h-[8px] rounded-[50%]" style={{ backgroundColor: cfg.color }} />
                                          {cfg.label}
                                        </span>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <p className="cn-text-body1 text-[0.6875rem] text-muted-foreground max-w-[220px] overflow-hidden text-ellipsis whitespace-nowrap">
                                  {p.notes || '\u2014'}
                                </p>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProspectionPage;
