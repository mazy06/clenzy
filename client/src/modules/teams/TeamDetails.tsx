import React, { useState, useEffect } from 'react';
import StatusChip from '../../components/StatusChip';
import { Alert, AlertDescription } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Card, CardContent, Grid, Button } from '@mui/material';
import {
  Group,
  Edit,
  Build,
  CleaningServices,
} from '../../icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { teamsApi } from '../../services/api/teamsApi';
import type { TeamMember } from '../../services/api';
import PageHeader from '../../components/PageHeader';
import TeamWorkloadCard from './TeamWorkloadCard';
import TeamPerformanceChart from './TeamPerformanceChart';
import TeamMembersList from './TeamMembersList';
import { teamsKeys } from './useTeamsList';
import { getInterventionTypeHex, getInterventionTypeLabel } from '../../utils/statusUtils';
import { useTranslation } from '../../hooks/useTranslation';

interface Team {
  id: number;
  name: string;
  description: string;
  interventionType: string;
  memberCount: number;
  members: TeamMember[];
  createdAt?: string;
  updatedAt?: string;
}

const getInterventionTypeIcon = (type: string) => {
  switch (type) {
    case 'CLEANING': return <CleaningServices />;
    case 'MAINTENANCE': return <Build />;
    case 'REPAIR': return <Build />;
    default: return <Group />;
  }
};

const TeamDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermissionAsync } = useAuth();
  const { t } = useTranslation();

  // ─── Permissions (useEffect — NOT React Query) ──────────────────────────
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    const checkPermissions = async () => {
      const canEditPermission = await hasPermissionAsync('teams:edit');
      setCanEdit(canEditPermission);
    };
    checkPermissions();
  }, [hasPermissionAsync]);

  // ─── Team detail query ──────────────────────────────────────────────────
  const teamQuery = useQuery({
    queryKey: teamsKeys.detail(id ?? ''),
    queryFn: async () => {
      const data = await teamsApi.getById(Number(id));
      return data as unknown as Team;
    },
    enabled: !!id,
    staleTime: 30_000,
  });

  const team = teamQuery.data ?? null;
  const loading = teamQuery.isLoading;
  const error = teamQuery.isError ? 'Erreur lors du chargement de l\'équipe' : null;

  const handleEdit = () => {
    navigate(`/teams/${id}/edit`);
  };


  if (loading) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <Spinner className="size-10" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="p-4">
        <Alert variant="warning">
          <TriangleAlert />
          <AlertDescription>Équipe non trouvée</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-4">
      <PageHeader
        title={team.name}
        subtitle="Détails de l'équipe et de ses membres"
        backPath="/teams"
        backLabel="Retour aux équipes"
        showBackButton={true}
        actions={
          canEdit && (
            <Button
              variant="contained"
              size="small"
              startIcon={<Edit />}
              onClick={handleEdit}
              title="Modifier"
            >
              Modifier
            </Button>
          )
        }
      />

      {/* Row 1: Carte principale avec résumé */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 4 }}>
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              {getInterventionTypeIcon(team.interventionType)}
              <h5 className="cn-text-h5 font-semibold">
                {team.name}
              </h5>
            </div>
            {(() => { const c = getInterventionTypeHex(team.interventionType); return (
            <StatusChip tokens={{ color: c, bg: `${c}18` }} label={getInterventionTypeLabel(team.interventionType, t)} />
            ); })()}
          </div>

          <div className="mb-4 p-3 bg-[var(--field)] rounded-[12px] border border-[var(--field-line)]">
            <h6 className="cn-text-subtitle2 mb-1.5 font-semibold text-[var(--accent)]">
              Description de l'équipe
            </h6>
            <p className="cn-text-body1 text-muted-foreground">
              {team.description || 'Aucune description disponible pour cette équipe.'}
            </p>
          </div>

          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={6} md={3}>
              <div className="text-center">
                <span className="inline-flex text-muted-foreground mb-0.5"><Group size={20} strokeWidth={1.75} /></span>
                <p className="cn-text-body2 font-medium">{team.memberCount}</p>
                <span className="cn-text-caption text-muted-foreground">Membres</span>
              </div>
            </Grid>
            <Grid item xs={6} md={3}>
              <div className="text-center">
                <span className="inline-flex text-muted-foreground mb-0.5"><Build size={20} strokeWidth={1.75} /></span>
                <p className="cn-text-body2 font-medium">{getInterventionTypeLabel(team.interventionType, t)}</p>
                <span className="cn-text-caption text-muted-foreground">Spécialité</span>
              </div>
            </Grid>
          </Grid>

          <div className="p-3 bg-[var(--field)] rounded-[12px] border border-[var(--field-line)]">
            <h6 className="cn-text-subtitle2 mb-1.5 font-semibold text-[var(--accent)]">
              Informations de l'équipe
            </h6>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <div className="flex items-center gap-1.5">
                  <span className="cn-text-caption text-muted-foreground font-medium">Créée le:</span>
                  <span className="cn-text-caption text-foreground">
                    {team.createdAt ? new Date(team.createdAt).toLocaleDateString('fr-FR') : 'N/A'}
                  </span>
                </div>
              </Grid>
              {team.updatedAt && (
                <Grid item xs={12} md={6}>
                  <div className="flex items-center gap-1.5">
                    <span className="cn-text-caption text-muted-foreground font-medium">Modifiée le:</span>
                    <span className="cn-text-caption text-foreground">
                      {new Date(team.updatedAt).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                </Grid>
              )}
            </Grid>
          </div>
        </CardContent>
      </Card>

      {/* Row 2: Workload + Performance */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <TeamWorkloadCard teamId={team.id} teamName={team.name} />
        </Grid>
        <Grid item xs={12} md={6}>
          <TeamPerformanceChart teamId={team.id} teamName={team.name} />
        </Grid>
      </Grid>

      {/* Row 3: TeamMembersList */}
      <TeamMembersList
        members={team.members || []}
        teamId={team.id}
        teamName={team.name}
        canEdit={canEdit}
      />
    </div>
  );
};

export default TeamDetails;
