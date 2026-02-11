import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { useNavigate } from 'react-router-dom';
import { managersApi } from '../../services/api';
import { useTranslation } from '../../hooks/useTranslation';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ChipColor = 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';

export interface PortfolioClient {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  phoneNumber?: string;
  associatedAt: string;
}

export interface PortfolioProperty {
  id: number;
  name: string;
  address: string;
  city: string;
  type: string;
  createdAt: string;
  ownerId: number;
}

export interface PortfolioTeam {
  id: number;
  name: string;
  memberCount: number;
  description?: string;
  assignedAt: string;
}

export interface PortfolioUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  assignedAt: string;
}

export interface Manager {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
}

export interface ConfirmationModalState {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  severity?: 'warning' | 'error' | 'info';
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function usePortfoliosPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { hasPermission } = usePermissions();

  // Tab state
  const [tabValue, setTabValue] = useState(0);

  // Data states
  const [clients, setClients] = useState<PortfolioClient[]>([]);
  const [properties, setProperties] = useState<PortfolioProperty[]>([]);
  const [teams, setTeams] = useState<PortfolioTeam[]>([]);
  const [users, setUsers] = useState<PortfolioUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingClient, setEditingClient] = useState<PortfolioClient | null>(null);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [reassignLoading, setReassignLoading] = useState(false);
  const [expandedClients, setExpandedClients] = useState<Set<number>>(new Set());

  // Confirmation modal state
  const [confirmationModal, setConfirmationModal] = useState<ConfirmationModalState>({
    open: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // ── Permission check ────────────────────────────────────────────────────
  const canView = !!user && hasPermission('portfolios:view');

  // ── Tab handler ─────────────────────────────────────────────────────────
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // ── Client expansion toggle ─────────────────────────────────────────────
  const toggleClientExpansion = (clientId: number) => {
    setExpandedClients(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clientId)) {
        newSet.delete(clientId);
      } else {
        newSet.add(clientId);
      }
      return newSet;
    });
  };

  // ── Navigation handlers ─────────────────────────────────────────────────
  const handleClientAssignment = () => {
    navigate('/portfolios/client-assignment');
  };

  const handleTeamAssignment = () => {
    navigate('/portfolios/team-assignment');
  };

  // ── Data loading ────────────────────────────────────────────────────────
  useEffect(() => {
    if (user?.id) {
      loadAssociations();
      loadManagers();
    }
  }, [user?.id]);

  const loadManagers = async () => {
    try {
      const data = await managersApi.getAll();
      setManagers(data as Manager[]);
    } catch (error) {
      // Silent fail
    }
  };

  const loadAssociations = async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      const associationsData = await managersApi.getAssociations(user.id);
      setClients((associationsData.clients || []) as unknown as PortfolioClient[]);
      setProperties((associationsData.properties || []) as unknown as PortfolioProperty[]);
      setTeams((associationsData.teams || []) as unknown as PortfolioTeam[]);
      setUsers((associationsData.users || []) as unknown as PortfolioUser[]);
    } catch (err: any) {
      setError(err?.message || t('portfolios.errors.connectionError'));
    } finally {
      setLoading(false);
    }
  };

  // ── Reassignment ───────────────────────────────────────────────────────
  const handleReassignClient = async (clientId: number, newManagerId: number, _notes: string) => {
    setReassignLoading(true);
    try {
      await managersApi.reassignClient(clientId, { newManagerId });
      loadAssociations();
      setEditingClient(null);
    } catch (error: any) {
      setError(error?.message || t('portfolios.errors.reassignConnectionError'));
    } finally {
      setReassignLoading(false);
    }
  };

  // ── Unassign client ────────────────────────────────────────────────────
  const handleUnassignClient = (clientId: number) => {
    if (!user?.id) return;

    setConfirmationModal({
      open: true,
      title: t('portfolios.confirmations.unassignClientTitle'),
      message: t('portfolios.confirmations.unassignClientMessage'),
      severity: 'warning',
      onConfirm: () => {
        setConfirmationModal(prev => ({ ...prev, open: false }));
        performUnassignClient(clientId);
      },
    });
  };

  const performUnassignClient = async (clientId: number) => {
    if (!user?.id) return;
    try {
      await managersApi.removeClient(user.id, clientId);
      loadAssociations();
    } catch (error: any) {
      setError(error?.message || t('portfolios.errors.connectionError'));
    }
  };

  // ── Unassign team ──────────────────────────────────────────────────────
  const handleUnassignTeam = (teamId: number) => {
    if (!user?.id) return;

    setConfirmationModal({
      open: true,
      title: t('teams.delete'),
      message: 'Êtes-vous sûr de vouloir désassigner cette équipe ?',
      severity: 'warning',
      onConfirm: () => {
        setConfirmationModal(prev => ({ ...prev, open: false }));
        performUnassignTeam(teamId);
      },
    });
  };

  const performUnassignTeam = async (teamId: number) => {
    if (!user?.id) return;
    try {
      await managersApi.removeTeam(user.id, teamId);
      loadAssociations();
    } catch (error: any) {
      setError(error?.message || 'Erreur de connexion lors de la désassignation');
    }
  };

  // ── Unassign user ──────────────────────────────────────────────────────
  const handleUnassignUser = (userId: number) => {
    if (!user?.id) return;

    setConfirmationModal({
      open: true,
      title: t('portfolios.confirmations.unassignClientTitle'),
      message: t('portfolios.confirmations.unassignClientMessage'),
      severity: 'warning',
      onConfirm: () => {
        setConfirmationModal(prev => ({ ...prev, open: false }));
        performUnassignUser(userId);
      },
    });
  };

  const performUnassignUser = async (userId: number) => {
    if (!user?.id) return;
    try {
      await managersApi.removeUser(user.id, userId);
      loadAssociations();
    } catch (error: any) {
      setError(error?.message || t('portfolios.errors.connectionError'));
    }
  };

  // ── Property actions ───────────────────────────────────────────────────
  const handleReassignProperty = async (propertyId: number) => {
    if (!user?.id) return;
    try {
      await managersApi.assignProperty(user.id, propertyId);
      loadAssociations();
    } catch (error: any) {
      setError(error?.message || t('portfolios.errors.reassignConnectionError'));
    }
  };

  const handleUnassignProperty = (propertyId: number) => {
    if (!user?.id) return;

    setConfirmationModal({
      open: true,
      title: 'Désassigner la propriété',
      message: 'Êtes-vous sûr de vouloir désassigner cette propriété ? Le client restera assigné mais cette propriété ne sera plus gérée par vous.',
      severity: 'warning',
      onConfirm: () => {
        setConfirmationModal(prev => ({ ...prev, open: false }));
        performUnassignProperty(propertyId);
      },
    });
  };

  const performUnassignProperty = async (propertyId: number) => {
    if (!user?.id) return;
    try {
      await managersApi.removeProperty(user.id, propertyId);
      loadAssociations();
    } catch (error: any) {
      setError(error?.message || t('portfolios.errors.connectionError'));
    }
  };

  // ── Utility functions ──────────────────────────────────────────────────
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getRoleColor = (role: string): ChipColor => {
    switch (role) {
      case 'HOST': return 'primary';
      case 'TECHNICIAN': return 'secondary';
      case 'HOUSEKEEPER': return 'success';
      case 'SUPERVISOR': return 'warning';
      default: return 'default';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'HOST': return t('portfolios.roles.owner');
      case 'TECHNICIAN': return t('portfolios.roles.technician');
      case 'HOUSEKEEPER': return t('portfolios.roles.housekeeper');
      case 'SUPERVISOR': return t('portfolios.roles.supervisor');
      default: return role;
    }
  };

  // ── Close confirmation modal ───────────────────────────────────────────
  const closeConfirmationModal = () => {
    setConfirmationModal(prev => ({ ...prev, open: false }));
  };

  return {
    // Permission
    canView,
    // Translation
    t,
    // Tab
    tabValue,
    handleTabChange,
    // Data
    clients,
    properties,
    teams,
    users,
    loading,
    error,
    managers,
    reassignLoading,
    expandedClients,
    // Editing
    editingClient,
    setEditingClient,
    // Handlers
    handleClientAssignment,
    handleTeamAssignment,
    toggleClientExpansion,
    handleReassignClient,
    handleUnassignClient,
    handleUnassignTeam,
    handleUnassignUser,
    handleReassignProperty,
    handleUnassignProperty,
    // Confirmation modal
    confirmationModal,
    closeConfirmationModal,
    // Utilities
    formatDate,
    getRoleColor,
    getRoleLabel,
  };
}
