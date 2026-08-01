import React, { useState, useMemo, useCallback } from 'react';
import StatusChip from '../../components/StatusChip';
import { Badge, Button } from '../../components/ui';
import { Spinner } from '../../components/ui';
import { Card } from '../../components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui';
import { createPortal } from 'react-dom';
import { Box, Collapse, IconButton, MenuItem, Select, FormControl, InputLabel, Tooltip, useTheme, SelectChangeEvent } from '@mui/material';
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
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

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
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel sx={{ fontSize: '0.8125rem' }}>
              <span className="inline-flex me-[3px] align-[middle]"><FilterList size={14} strokeWidth={1.75} /></span>
              Categorie
            </InputLabel>
            <Select
              value={categoryFilter}
              label="Categorie"
              onChange={(e) => setCategoryFilter(e.target.value)}
              sx={{ fontSize: '0.8125rem' }}
            >
              <MenuItem value="all">Toutes</MenuItem>
              {CATEGORY_ORDER.map((key) => (
                <MenuItem key={key} value={key}>
                  {CATEGORY_CONFIG[key]?.label || key}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel sx={{ fontSize: '0.8125rem' }}>Statut</InputLabel>
            <Select
              value={statusFilter}
              label="Statut"
              onChange={(e) => setStatusFilter(e.target.value as ProspectStatus | 'all')}
              sx={{ fontSize: '0.8125rem' }}
            >
              <MenuItem value="all">Tous</MenuItem>
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <MenuItem key={key} value={key}>
                  <div className="flex items-center gap-1.5">
                    <div className="w-[8px] h-[8px] rounded-[50%]" style={{ backgroundColor: cfg.color }} />
                    {cfg.label}
                  </div>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
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
                {/* Category header */}
                <Box
                  onClick={() => toggleCategory(cat.key)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    px: 2,
                    py: 1.5,
                    cursor: 'pointer',
                    backgroundColor: isDark ? `${cat.color}12` : `${cat.color}08`,
                    '&:hover': { backgroundColor: isDark ? `${cat.color}1A` : `${cat.color}10` },
                    transition: 'background-color 0.15s',
                  }}
                >
                  <div className="flex items-center" style={{ color: cat.color }}>
                    {cat.icon}
                  </div>
                  <p className="cn-text-body1 font-bold text-[0.875rem] flex-1">
                    {cat.label}
                  </p>
                  <StatusChip tokens={{ color: cat.color, bg: `${cat.color}18` }} label={`${cat.prospects.length}`} className="tabular-nums" />
                  <IconButton size="small" sx={{ ml: 0.5 }}>
                    {isExpanded ? <ExpandLess size={18} strokeWidth={1.75} /> : <ExpandMore size={18} strokeWidth={1.75} />}
                  </IconButton>
                </Box>

                {/* Prospects table */}
                <Collapse in={isExpanded}>
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
                                    <Tooltip title={p.email}>
                                      <div className="flex items-center gap-0.5">
                                        <span className="inline-flex text-muted-foreground opacity-60"><Email size={11} strokeWidth={1.75} /></span>
                                        <p className="cn-text-body1 text-[0.625rem] text-muted-foreground">
                                          {p.email}
                                        </p>
                                      </div>
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
                                    <Tooltip title={p.website}>
                                      <IconButton
                                        size="small"
                                        component="a"
                                        href={p.website.startsWith('http') ? p.website : `https://${p.website}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        sx={{ p: 0.25 }}
                                      >
                                        <span className="inline-flex text-muted-foreground"><Language size={16} strokeWidth={1.75} /></span>
                                      </IconButton>
                                    </Tooltip>
                                  )}
                                  {p.linkedIn && (
                                    <Tooltip title="LinkedIn">
                                      <IconButton
                                        size="small"
                                        component="a"
                                        href={p.linkedIn}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        sx={{ p: 0.25 }}
                                      >
                                        <LinkedIn size={16} strokeWidth={1.75} color='#0A66C2' />
                                      </IconButton>
                                    </Tooltip>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={p.status || 'TO_CONTACT'}
                                  size="small"
                                  onChange={(e: SelectChangeEvent) => handleStatusChange(p.id, e.target.value)}
                                  sx={{
                                    fontSize: '0.625rem',
                                    height: 24,
                                    '& .MuiSelect-select': { py: 0.25, px: 0.75 },
                                    backgroundColor: `${sc.color}18`,
                                    color: sc.color,
                                    fontWeight: 600,
                                    borderRadius: '999px',
                                    '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                                  }}
                                >
                                  {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                                    <MenuItem key={key} value={key} sx={{ fontSize: '0.75rem' }}>
                                      <div className="flex items-center gap-1">
                                        <div className="w-[8px] h-[8px] rounded-[50%]" style={{ backgroundColor: cfg.color }} />
                                        {cfg.label}
                                      </div>
                                    </MenuItem>
                                  ))}
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
                </Collapse>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProspectionPage;
