import React, { useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Collapse,
  IconButton,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Tooltip,
  useTheme,
  Button,
  CircularProgress,
  SelectChangeEvent,
} from '@mui/material';
import {
  Search,
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
} from '../../icons';
import { useProspects, useUpdateProspect } from '../../hooks/useProspects';
import type { ProspectDto } from '../../services/api/prospectsApi';
import ProspectImportModal from './ProspectImportModal';

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

const STATUS_CONFIG: Record<ProspectStatus, { label: string; color: string }> = {
  TO_CONTACT: { label: 'A contacter', color: '#ED6C02' },
  IN_DISCUSSION: { label: 'En discussion', color: '#0288d1' },
  PARTNER: { label: 'Partenaire', color: '#4A9B8E' },
  REJECTED: { label: 'Rejete', color: '#9e9e9e' },
};

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ReactElement; color: string }> = {
  CONCIERGERIES: { label: 'Conciergeries & Agences', icon: <Business size={20} strokeWidth={1.75} />, color: '#0288d1' },
  MENAGE: { label: 'Societes de menage', icon: <CleaningServices size={20} strokeWidth={1.75} />, color: '#9B7FC4' },
  ARTISANS: { label: 'Artisans & Travaux', icon: <Handyman size={20} strokeWidth={1.75} />, color: '#7EBAD0' },
  ENTRETIEN: { label: 'Entretien exterieur', icon: <Yard size={20} strokeWidth={1.75} />, color: '#66BB6A' },
  BLANCHISSERIES: { label: 'Blanchisseries', icon: <LocalLaundryService size={20} strokeWidth={1.75} />, color: '#AB47BC' },
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
        const cfg = CATEGORY_CONFIG[key] || { label: key, icon: <Business size={20} strokeWidth={1.75} />, color: '#757575' };
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
    return categories
      .filter((cat) => categoryFilter === 'all' || cat.key === categoryFilter)
      .map((cat) => ({
        ...cat,
        prospects: cat.prospects.filter((p) => {
          if (statusFilter !== 'all' && p.status !== statusFilter) return false;
          if (q) {
            const name = (p.name || '').toLowerCase();
            const city = (p.city || '').toLowerCase();
            const specialty = (p.specialty || '').toLowerCase();
            if (!name.includes(q) && !city.includes(q) && !specialty.includes(q)) return false;
          }
          return true;
        }),
      }))
      .filter((cat) => cat.prospects.length > 0);
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
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Button
        variant="contained"
        size="small"
        startIcon={<CloudUpload />}
        onClick={() => setImportOpen(true)}
        sx={{ textTransform: 'none', fontSize: '0.8125rem' }}
      >
        Importer CSV
      </Button>
      <Chip
        label={`${totalProspects} prospect${totalProspects > 1 ? 's' : ''}`}
        size="small"
        sx={{ fontWeight: 600, fontSize: '0.75rem' }}
      />
    </Box>
  );

  // ── Loading state ──
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {embedded && actionsContainer && createPortal(actionButtons, actionsContainer)}

      {/* ── Import Modal ── */}
      <ProspectImportModal open={importOpen} onClose={() => setImportOpen(false)} />

      {/* ── Filters bar ── */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Rechercher un prospect..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><Search size={18} strokeWidth={1.75} /></Box>
                </InputAdornment>
              ),
            }}
            sx={{ flex: 1, minWidth: 200, '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }}
          />

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel sx={{ fontSize: '0.8125rem' }}>
              <Box component="span" sx={{ display: 'inline-flex', mr: 0.5, verticalAlign: 'middle' }}><FilterList size={14} strokeWidth={1.75} /></Box>
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
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: cfg.color }} />
                    {cfg.label}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {/* ── Empty state ── */}
      {prospects.length === 0 && !isLoading ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <Box component="span" sx={{ display: 'inline-flex', color: 'text.disabled', mb: 2 }}><CloudUpload size={48} strokeWidth={1.75} /></Box>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
            Aucun prospect pour le moment
          </Typography>
          <Typography variant="body2" color="text.disabled" sx={{ mb: 3 }}>
            Importez un fichier CSV depuis Vibe Prospecting pour commencer.
          </Typography>
          <Button
            variant="contained"
            startIcon={<CloudUpload />}
            onClick={() => setImportOpen(true)}
          >
            Importer des prospects
          </Button>
        </Paper>
      ) : filteredCategories.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary" sx={{ fontSize: '0.875rem' }}>
            Aucun prospect ne correspond aux filtres.
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {filteredCategories.map((cat) => {
            const isExpanded = expandedCategories.has(cat.key);
            return (
              <Paper key={cat.key} sx={{ overflow: 'hidden' }}>
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
                    borderLeft: `4px solid ${cat.color}`,
                    backgroundColor: isDark ? `${cat.color}12` : `${cat.color}08`,
                    '&:hover': { backgroundColor: isDark ? `${cat.color}1A` : `${cat.color}10` },
                    transition: 'background-color 0.15s',
                  }}
                >
                  <Box sx={{ color: cat.color, display: 'flex', alignItems: 'center' }}>
                    {cat.icon}
                  </Box>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', flex: 1 }}>
                    {cat.label}
                  </Typography>
                  <Chip
                    label={`${cat.prospects.length}`}
                    size="small"
                    sx={{
                      fontWeight: 700,
                      fontSize: '0.6875rem',
                      height: 22,
                      backgroundColor: `${cat.color}18`,
                      color: cat.color,
                      border: `1px solid ${cat.color}40`,
                    }}
                  />
                  <IconButton size="small" sx={{ ml: 0.5 }}>
                    {isExpanded ? <ExpandLess size={18} strokeWidth={1.75} /> : <ExpandMore size={18} strokeWidth={1.75} />}
                  </IconButton>
                </Box>

                {/* Prospects table */}
                <Collapse in={isExpanded}>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Nom</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Ville</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Specialite</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Taille</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>CA</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Liens</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Statut</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Notes</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {cat.prospects.map((p) => {
                          const sc = STATUS_CONFIG[(p.status as ProspectStatus) || 'TO_CONTACT'] || STATUS_CONFIG.TO_CONTACT;
                          return (
                            <TableRow
                              key={p.id}
                              hover
                              sx={{ '&:last-child td': { borderBottom: 0 } }}
                            >
                              <TableCell>
                                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                                  {p.name}
                                </Typography>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, mt: 0.25 }}>
                                  {p.email && (
                                    <Tooltip title={p.email}>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <Box component="span" sx={{ display: 'inline-flex', color: 'text.disabled' }}><Email size={11} strokeWidth={1.75} /></Box>
                                        <Typography sx={{ fontSize: '0.625rem', color: 'text.secondary' }}>
                                          {p.email}
                                        </Typography>
                                      </Box>
                                    </Tooltip>
                                  )}
                                  {p.phone && (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                      <Box component="span" sx={{ display: 'inline-flex', color: 'text.disabled' }}><Phone size={11} strokeWidth={1.75} /></Box>
                                      <Typography sx={{ fontSize: '0.625rem', color: 'text.secondary' }}>
                                        {p.phone}
                                      </Typography>
                                    </Box>
                                  )}
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><LocationOn size={12} strokeWidth={1.75} /></Box>
                                  <Typography sx={{ fontSize: '0.75rem' }}>{p.city || '\u2014'}</Typography>
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Typography sx={{ fontSize: '0.75rem' }}>{p.specialty || '\u2014'}</Typography>
                              </TableCell>
                              <TableCell>
                                <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>
                                  {p.employees || '\u2014'}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                                  {p.revenue ? `${p.revenue} \u20AC` : '\u2014'}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', gap: 0.5 }}>
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
                                        <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><Language size={16} strokeWidth={1.75} /></Box>
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
                                </Box>
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
                                    border: `1px solid ${sc.color}40`,
                                    borderRadius: '6px',
                                    '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                                  }}
                                >
                                  {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                                    <MenuItem key={key} value={key} sx={{ fontSize: '0.75rem' }}>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: cfg.color }} />
                                        {cfg.label}
                                      </Box>
                                    </MenuItem>
                                  ))}
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Typography
                                  sx={{
                                    fontSize: '0.6875rem',
                                    color: 'text.secondary',
                                    maxWidth: 220,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {p.notes || '\u2014'}
                                </Typography>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Collapse>
              </Paper>
            );
          })}
        </Box>
      )}
    </Box>
  );
};

export default ProspectionPage;
