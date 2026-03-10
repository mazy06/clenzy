package com.clenzy.dto;

/**
 * DTO pour les parametres workflow d'une organisation.
 */
public class WorkflowSettingsDto {

    private boolean autoAssignInterventions = true;
    private int cancellationDeadlineHours = 24;
    private boolean requireApprovalForChanges = true;

    public WorkflowSettingsDto() {}

    public WorkflowSettingsDto(boolean autoAssignInterventions, int cancellationDeadlineHours, boolean requireApprovalForChanges) {
        this.autoAssignInterventions = autoAssignInterventions;
        this.cancellationDeadlineHours = cancellationDeadlineHours;
        this.requireApprovalForChanges = requireApprovalForChanges;
    }

    public boolean isAutoAssignInterventions() { return autoAssignInterventions; }
    public void setAutoAssignInterventions(boolean autoAssignInterventions) { this.autoAssignInterventions = autoAssignInterventions; }

    public int getCancellationDeadlineHours() { return cancellationDeadlineHours; }
    public void setCancellationDeadlineHours(int cancellationDeadlineHours) { this.cancellationDeadlineHours = cancellationDeadlineHours; }

    public boolean isRequireApprovalForChanges() { return requireApprovalForChanges; }
    public void setRequireApprovalForChanges(boolean requireApprovalForChanges) { this.requireApprovalForChanges = requireApprovalForChanges; }
}
