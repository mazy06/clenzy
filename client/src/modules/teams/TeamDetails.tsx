import React, { useState, useEffect } from 'react';
import StatusChip from '../../components/StatusChip';
import { Alert, AlertDescription, Button, Card, CardContent } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Spinner } from '../../components/ui';
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
            <Button size="sm" onClick={handleEdit} title="Modifier">
              <Edit />
              Modifier
            </Button>
          )
        }
      />

      {/* Row 1: Carte principale avec résumé */}
      {/* `--card-spacing` porte le p:4 d'origine (24 px) : la Card du kit pose le
          padding vertical, CardContent l'horizontal. */}
      <Card className="mb-[18px] [--card-spacing:24px]">
        <CardContent>
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              {getInterventionTypeIcon(team.interventionType)}
              <h5 className="text-sm font-semibold tracking-tight">
                {team.name}
              </h5>
            </div>
            {/* Teinte du type d'intervention : valeur runtime hors palette
                sémantique → la primitive en dérive elle-même le fond doux. */}
            <StatusChip
              color={getInterventionTypeHex(team.interventionType)}
              label={getInterventionTypeLabel(team.interventionType, t)}
            />
          </div>

          <div className="mb-4 p-3 bg-field rounded-xl border border-field-line">
            <h6 className="text-xs font-medium mb-1.5 text-primary">
              Description de l'équipe
            </h6>
            <p className="text-sm text-muted-foreground">
              {team.description || 'Aucune description disponible pour cette équipe.'}
            </p>
          </div>

          <div className="grid grid-cols-12 gap-[18px] mb-[18px]">
            <div className="col-span-6 min-[900px]:col-span-3">
              <div className="text-center">
                <span className="inline-flex text-muted-foreground mb-0.5"><Group size={20} strokeWidth={1.75} /></span>
                <p className="text-xs font-medium tabular-nums">{team.memberCount}</p>
                <span className="text-xs text-muted-foreground">Membres</span>
              </div>
            </div>
            <div className="col-span-6 min-[900px]:col-span-3">
              <div className="text-center">
                <span className="inline-flex text-muted-foreground mb-0.5"><Build size={20} strokeWidth={1.75} /></span>
                <p className="text-xs font-medium">{getInterventionTypeLabel(team.interventionType, t)}</p>
                <span className="text-xs text-muted-foreground">Spécialité</span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-field rounded-xl border border-field-line">
            <h6 className="text-xs font-medium mb-1.5 text-primary">
              Informations de l'équipe
            </h6>
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12 min-[900px]:col-span-6">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground font-medium">Créée le:</span>
                  <span className="text-xs text-foreground tabular-nums">
                    {team.createdAt ? new Date(team.createdAt).toLocaleDateString('fr-FR') : 'N/A'}
                  </span>
                </div>
              </div>
              {team.updatedAt && (
                <div className="col-span-12 min-[900px]:col-span-6">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground font-medium">Modifiée le:</span>
                    <span className="text-xs text-foreground tabular-nums">
                      {new Date(team.updatedAt).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Row 2: Workload + Performance */}
      <div className="grid grid-cols-12 gap-[18px] mb-[18px]">
        <div className="col-span-12 min-[900px]:col-span-6">
          <TeamWorkloadCard teamId={team.id} teamName={team.name} />
        </div>
        <div className="col-span-12 min-[900px]:col-span-6">
          <TeamPerformanceChart teamId={team.id} teamName={team.name} />
        </div>
      </div>

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
