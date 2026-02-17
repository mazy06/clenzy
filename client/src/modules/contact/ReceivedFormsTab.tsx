import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Chip,
  TextField,
  CircularProgress,
  Divider,
  IconButton,
  Tooltip,
  Button,
  TablePagination,
} from '@mui/material';
import {
  Search as SearchIcon,
  Description as DescriptionIcon,
  Build as BuildIcon,
  SupportAgent as SupportIcon,
  CheckCircle as CheckCircleIcon,
  Archive as ArchiveIcon,
  Refresh as RefreshIcon,
  Inbox as InboxIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
} from '@mui/icons-material';
import { receivedFormsApi, type ReceivedForm } from '../../services/api/receivedFormsApi';

// ─── Config types & statuts (tokens MUI palette) ─────────────────────────────

const FORM_TYPE_CONFIG: Record<string, { label: string; palette: string; icon: React.ReactNode }> = {
  DEVIS: { label: 'Devis', palette: 'primary', icon: <DescriptionIcon sx={{ fontSize: 14 }} /> },
  MAINTENANCE: { label: 'Maintenance', palette: 'warning', icon: <BuildIcon sx={{ fontSize: 14 }} /> },
  SUPPORT: { label: 'Support', palette: 'success', icon: <SupportIcon sx={{ fontSize: 14 }} /> },
};

const STATUS_CONFIG: Record<string, { label: string; palette: string }> = {
  NEW: { label: 'Nouveau', palette: 'warning' },
  READ: { label: 'Lu', palette: 'info' },
  PROCESSED: { label: 'Traite', palette: 'success' },
  ARCHIVED: { label: 'Archive', palette: 'primary' },
};

// ─── Labels devis ────────────────────────────────────────────────────────────

const DEVIS_LABELS: Record<string, string> = {
  propertyType: 'Type de bien', propertyCount: 'Nombre de logements', guestCapacity: 'Capacite voyageurs',
  surface: 'Surface (m\u00B2)', bookingFrequency: 'Frequence reservations', cleaningSchedule: 'Planning menage',
  services: 'Services forfait', servicesDevis: 'Services sur devis', calendarSync: 'Synchro calendrier',
  fullName: 'Nom complet', email: 'Email', phone: 'Telephone', city: 'Ville', postalCode: 'Code postal',
};

const MAINTENANCE_LABELS: Record<string, string> = {
  selectedWorks: 'Travaux demandes', customNeed: 'Besoin personnalise', description: 'Description',
  urgency: 'Urgence', fullName: 'Nom complet', email: 'Email', phone: 'Telephone',
  city: 'Ville', postalCode: 'Code postal',
};

const SUPPORT_LABELS: Record<string, string> = {
  name: 'Nom', email: 'Email', phone: 'Telephone', subject: 'Sujet', message: 'Message',
};

// ─── Composant principal ─────────────────────────────────────────────────────

const ReceivedFormsTab: React.FC = () => {
  const [forms, setForms] = useState<ReceivedForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedForm, setSelectedForm] = useState<ReceivedForm | null>(null);
  const [filterType, setFilterType] = useState<string>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [updating, setUpdating] = useState(false);
  const rowsPerPage = 20;

  // ─── Chargement ──────────────────────────────────────────────

  const loadForms = useCallback(async () => {
    setLoading(true);
    try {
      const result = await receivedFormsApi.list({
        page,
        size: rowsPerPage,
        type: filterType || undefined,
      });
      setForms(result.content);
      setTotalElements(result.totalElements);
    } finally {
      setLoading(false);
    }
  }, [page, filterType]);

  useEffect(() => { loadForms(); }, [loadForms]);

  // ─── Filtrage client ─────────────────────────────────────────

  const filteredForms = search.trim()
    ? forms.filter(f => {
        const q = search.toLowerCase();
        return f.fullName.toLowerCase().includes(q)
          || f.email.toLowerCase().includes(q)
          || (f.subject && f.subject.toLowerCase().includes(q))
          || (f.city && f.city.toLowerCase().includes(q));
      })
    : forms;

  // ─── Handlers ────────────────────────────────────────────────

  const handleSelect = async (form: ReceivedForm) => {
    setSelectedForm(form);
    if (form.status === 'NEW') {
      const updated = await receivedFormsApi.updateStatus(form.id, 'READ');
      if (updated) {
        setForms(prev => prev.map(f => f.id === form.id ? { ...f, status: 'READ', readAt: updated.readAt } : f));
        setSelectedForm(prev => prev && prev.id === form.id ? { ...prev, status: 'READ', readAt: updated.readAt } : prev);
      }
    }
  };

  const handleUpdateStatus = async (status: string) => {
    if (!selectedForm) return;
    setUpdating(true);
    const updated = await receivedFormsApi.updateStatus(selectedForm.id, status);
    if (updated) {
      setForms(prev => prev.map(f => f.id === selectedForm.id ? { ...f, ...updated } : f));
      setSelectedForm({ ...selectedForm, ...updated });
    }
    setUpdating(false);
  };

  // ─── Format date ─────────────────────────────────────────────

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return d; }
  };

  // ─── Parse & render payload ──────────────────────────────────

  const renderPayload = (form: ReceivedForm) => {
    let data: Record<string, unknown>;
    try { data = JSON.parse(form.payload); } catch { return <Typography variant="body2" sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>Donnees non lisibles</Typography>; }

    const labels = form.formType === 'DEVIS' ? DEVIS_LABELS
      : form.formType === 'MAINTENANCE' ? MAINTENANCE_LABELS
      : SUPPORT_LABELS;

    // Filtrer les champs vides et les champs deja affiches dans le header
    const skipKeys = ['fullName', 'name', 'email', 'phone', 'city', 'postalCode'];
    const entries = Object.entries(data).filter(([k, v]) =>
      !skipKeys.includes(k) && v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)
    );

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {entries.map(([key, value]) => (
          <Box key={key}>
            <Typography variant="caption" sx={{ fontSize: '0.6875rem', color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {labels[key] || key}
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '0.8125rem', color: 'text.primary', mt: 0.25 }}>
              {Array.isArray(value) ? value.join(', ') : String(value)}
            </Typography>
          </Box>
        ))}
      </Box>
    );
  };

  // ─── Render ──────────────────────────────────────────────────

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Toolbar */}
      <Box sx={{ display: 'flex', gap: 1, p: 1.5, borderBottom: 1, borderColor: 'divider', alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Rechercher..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <SearchIcon sx={{ mr: 0.5, fontSize: 18, color: 'text.secondary' }} /> }}
          sx={{
            minWidth: 180, flex: 1,
            '& .MuiOutlinedInput-root': { fontSize: '0.8125rem', borderRadius: '8px' },
          }}
        />
        {['', 'DEVIS', 'MAINTENANCE', 'SUPPORT'].map(t => {
          const conf = t ? FORM_TYPE_CONFIG[t] : null;
          return (
            <Chip
              key={t || 'all'}
              label={conf ? conf.label : 'Tous'}
              size="small"
              variant="outlined"
              color={(conf?.palette || 'primary') as 'primary' | 'info' | 'success' | 'warning' | 'error'}
              onClick={() => { setFilterType(t); setPage(0); }}
              sx={{
                fontSize: '0.6875rem', height: 26, borderRadius: '6px', cursor: 'pointer',
                borderWidth: 1.5, '& .MuiChip-label': { px: 1 },
                fontWeight: filterType === t ? 600 : 400,
                ...(filterType === t && {
                  bgcolor: `${conf?.palette || 'primary'}.main`,
                  color: `${conf?.palette || 'primary'}.contrastText`,
                }),
                '&:hover': { opacity: 0.85 },
              }}
            />
          );
        })}
        <Tooltip title="Rafraichir">
          <IconButton size="small" onClick={() => { receivedFormsApi.resetAvailability(); loadForms(); }}>
            <RefreshIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Content */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
          <CircularProgress size={32} color="primary" />
        </Box>
      ) : filteredForms.length === 0 ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 1.5 }}>
          <Box sx={{ width: 56, height: 56, borderRadius: '50%', bgcolor: 'action.selected', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <InboxIcon sx={{ fontSize: 28, color: 'primary.main' }} />
          </Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.9375rem', color: 'text.primary' }}>Aucun formulaire recu</Typography>
          <Typography variant="body2" sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>Les formulaires soumis depuis la landing page apparaitront ici.</Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

          {/* ─── Liste gauche (35%) ─── */}
          <Box sx={{ width: '35%', borderRight: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Box sx={{ flex: 1, overflowY: 'auto' }}>
              {filteredForms.map(form => {
                const typeConf = FORM_TYPE_CONFIG[form.formType] || FORM_TYPE_CONFIG.DEVIS;
                const isSelected = selectedForm?.id === form.id;
                const isNew = form.status === 'NEW';

                return (
                  <Box
                    key={form.id}
                    onClick={() => handleSelect(form)}
                    sx={{
                      p: 1.25,
                      cursor: 'pointer',
                      borderBottom: 1, borderColor: 'divider',
                      bgcolor: isSelected ? 'action.selected' : 'transparent',
                      borderLeft: isSelected ? 3 : 3,
                      borderLeftColor: isSelected ? 'primary.main' : 'transparent',
                      transition: 'all 0.15s ease',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                      <Chip
                        icon={typeConf.icon as React.ReactElement}
                        label={typeConf.label}
                        size="small"
                        variant="outlined"
                        color={typeConf.palette as 'primary' | 'info' | 'success' | 'warning' | 'error'}
                        sx={{
                          fontSize: '0.625rem', height: 22, borderWidth: 1.5,
                          fontWeight: 500, '& .MuiChip-label': { px: 0.75 },
                        }}
                      />
                      {isNew && (
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'warning.main', flexShrink: 0 }} />
                      )}
                    </Box>
                    <Typography variant="body2" sx={{ fontSize: '0.8125rem', fontWeight: isNew ? 700 : 500, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {form.fullName}
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: '0.6875rem', color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                      {form.subject}
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: '0.625rem', color: 'text.secondary', mt: 0.25, display: 'block' }}>
                      {formatDate(form.createdAt)}
                    </Typography>
                  </Box>
                );
              })}
            </Box>

            {/* Pagination */}
            <TablePagination
              component="div"
              count={totalElements}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              rowsPerPageOptions={[]}
              sx={{
                borderTop: 1, borderColor: 'divider', flexShrink: 0,
                '& .MuiTablePagination-displayedRows': { fontSize: '0.75rem', color: 'text.secondary' },
              }}
            />
          </Box>

          {/* ─── Detail droite (65%) ─── */}
          <Box sx={{ width: '65%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {selectedForm ? (
              <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
                {/* Header */}
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Chip
                      icon={(FORM_TYPE_CONFIG[selectedForm.formType]?.icon || <DescriptionIcon sx={{ fontSize: 14 }} />) as React.ReactElement}
                      label={FORM_TYPE_CONFIG[selectedForm.formType]?.label || selectedForm.formType}
                      size="small"
                      variant="outlined"
                      color={(FORM_TYPE_CONFIG[selectedForm.formType]?.palette || 'primary') as 'primary' | 'info' | 'success' | 'warning' | 'error'}
                      sx={{
                        fontSize: '0.6875rem', height: 22, borderWidth: 1.5,
                        fontWeight: 500, '& .MuiChip-label': { px: 0.75 },
                      }}
                    />
                    <Chip
                      label={STATUS_CONFIG[selectedForm.status]?.label || selectedForm.status}
                      size="small"
                      variant="outlined"
                      color={(STATUS_CONFIG[selectedForm.status]?.palette || 'primary') as 'primary' | 'info' | 'success' | 'warning' | 'error'}
                      sx={{
                        fontSize: '0.6875rem', height: 22, borderWidth: 1.5,
                        fontWeight: 500, '& .MuiChip-label': { px: 0.75 },
                      }}
                    />
                  </Box>

                  <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 700, color: 'text.primary', mb: 1 }}>
                    {selectedForm.subject || `Formulaire #${selectedForm.id}`}
                  </Typography>

                  {/* Infos contact */}
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <EmailIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                      <Typography variant="body2" sx={{ fontSize: '0.8125rem', color: 'text.primary' }}>{selectedForm.email}</Typography>
                    </Box>
                    {selectedForm.phone && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <PhoneIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography variant="body2" sx={{ fontSize: '0.8125rem', color: 'text.primary' }}>{selectedForm.phone}</Typography>
                      </Box>
                    )}
                    {(selectedForm.city || selectedForm.postalCode) && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <LocationIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography variant="body2" sx={{ fontSize: '0.8125rem', color: 'text.primary' }}>
                          {[selectedForm.city, selectedForm.postalCode].filter(Boolean).join(' ')}
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  <Typography variant="caption" sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>
                    Recu le {formatDate(selectedForm.createdAt)}
                    {selectedForm.ipAddress && ` • IP: ${selectedForm.ipAddress}`}
                  </Typography>
                </Box>

                <Divider sx={{ mb: 2 }} />

                {/* Payload */}
                {renderPayload(selectedForm)}

                {/* Actions */}
                <Divider sx={{ my: 2 }} />
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {selectedForm.status !== 'PROCESSED' && (
                    <Button
                      size="small"
                      variant="contained"
                      color="success"
                      startIcon={<CheckCircleIcon sx={{ fontSize: 16 }} />}
                      onClick={() => handleUpdateStatus('PROCESSED')}
                      disabled={updating}
                      sx={{ textTransform: 'none', fontSize: '0.8125rem', fontWeight: 600, borderRadius: '8px' }}
                    >
                      Marquer traite
                    </Button>
                  )}
                  {selectedForm.status !== 'ARCHIVED' && (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<ArchiveIcon sx={{ fontSize: 16 }} />}
                      onClick={() => handleUpdateStatus('ARCHIVED')}
                      disabled={updating}
                      sx={{ textTransform: 'none', fontSize: '0.8125rem', fontWeight: 500, borderRadius: '8px' }}
                    >
                      Archiver
                    </Button>
                  )}
                </Box>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 1 }}>
                <DescriptionIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
                <Typography variant="body2" sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>
                  Selectionnez un formulaire pour voir son contenu
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default ReceivedFormsTab;
