import InterventionAssignDialog from '../interventions/InterventionAssignDialog';
import {
  AssignDialog,
  DeleteConfirmDialog,
  ErrorDialog,
  StatusChangeDialog,
  SuccessDialog,
} from '../service-requests/ServiceRequestsDialogs';
import type { PrestationActions } from './PrestationActionsContext';

/** Dialogues des actions de ligne, rendus une fois pour tout l'écran. */
export default function PrestationDialogs({ actions }: { actions: PrestationActions }) {
  const intervention = actions.intervention;
  const request = actions.request;
  const t = request.t;
  const statusTarget = request.selectedRequestForStatusChange?.status ?? '';
  return (
    <>
      <InterventionAssignDialog
        open={intervention.assignDialogOpen}
        selectedIntervention={intervention.selectedIntervention}
        assignType={intervention.assignType}
        assignTargetId={intervention.assignTargetId}
        teams={intervention.teams}
        availableUsers={intervention.availableUsers}
        assignLoading={intervention.assignLoading}
        onClose={intervention.handleCloseAssignDialog}
        onAssign={intervention.handleAssign}
        setAssignType={intervention.setAssignType}
        setAssignTargetId={intervention.setAssignTargetId}
      />
      <DeleteConfirmDialog
        open={request.deleteDialogOpen}
        onClose={() => request.setDeleteDialogOpen(false)}
        onConfirm={request.confirmDelete}
        requestTitle={request.selectedRequestForDeletion?.title}
        t={t}
      />
      <StatusChangeDialog
        open={request.statusChangeDialogOpen}
        onClose={() => { if (!request.changingStatus) request.setStatusChangeDialogOpen(false); }}
        onConfirm={request.confirmStatusChange}
        requestTitle={request.selectedRequestForStatusChange?.title}
        newStatus={request.newStatus}
        pending={request.changingStatus}
        onStatusChange={request.setNewStatus}
        statuses={request.statuses.filter((s) =>
          s.value === statusTarget
          || (s.value === 'REJECTED' && statusTarget === 'PENDING')
          || (s.value === 'CANCELLED' && ['PENDING', 'ASSIGNED', 'AWAITING_PAYMENT', 'IN_PROGRESS'].includes(statusTarget)))}
        t={t}
      />
      <AssignDialog
        open={request.assignDialogOpen}
        onClose={request.closeAssignDialog}
        onConfirm={request.confirmAssignment}
        selectedRequest={request.selectedRequestForAssignment}
        assignmentType={request.assignAssignmentType}
        onAssignmentTypeChange={request.setAssignAssignmentType}
        selectedTeamId={request.assignSelectedTeamId}
        onTeamChange={request.setAssignSelectedTeamId}
        selectedUserId={request.assignSelectedUserId}
        onUserChange={request.setAssignSelectedUserId}
        teams={request.assignTeams}
        users={request.assignUsers}
        loadingData={request.loadingAssignData}
        assigning={request.assigning}
        t={t}
      />
      <ErrorDialog open={request.errorDialogOpen} onClose={() => request.setErrorDialogOpen(false)} message={request.errorMessage} t={t} />
      <SuccessDialog open={request.successDialogOpen} onClose={() => request.setSuccessDialogOpen(false)} message={request.successMessage} t={t} />
    </>
  );
}
