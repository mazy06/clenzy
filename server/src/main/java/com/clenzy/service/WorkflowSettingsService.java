package com.clenzy.service;

import com.clenzy.dto.WorkflowSettingsDto;
import com.clenzy.model.WorkflowSettings;
import com.clenzy.repository.WorkflowSettingsRepository;
import com.clenzy.tenant.TenantContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Parametres workflow par organisation (auto-assignation, delais d'annulation,
 * approbations). Logique deplacee depuis {@code WorkflowSettingsController}
 * (refactor T-ARCH-01 — controller mince).
 *
 * <p>Scope organisation : resolu via le {@link TenantContext} du requester,
 * jamais depuis un parametre client.</p>
 */
@Service
public class WorkflowSettingsService {

    private final WorkflowSettingsRepository repository;
    private final TenantContext tenantContext;

    public WorkflowSettingsService(WorkflowSettingsRepository repository,
                                   TenantContext tenantContext) {
        this.repository = repository;
        this.tenantContext = tenantContext;
    }

    /** Parametres de l'organisation courante, ou valeurs par defaut si absents. */
    @Transactional(readOnly = true)
    public WorkflowSettingsDto getForCurrentOrganization() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return repository.findByOrganizationId(orgId)
                .map(this::toDto)
                .orElseGet(WorkflowSettingsDto::new);
    }

    /** Upsert des parametres de l'organisation courante. */
    @Transactional
    public WorkflowSettingsDto updateForCurrentOrganization(WorkflowSettingsDto dto) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        WorkflowSettings entity = repository.findByOrganizationId(orgId)
                .orElseGet(() -> {
                    WorkflowSettings ws = new WorkflowSettings();
                    ws.setOrganizationId(orgId);
                    return ws;
                });

        entity.setAutoAssignInterventions(dto.isAutoAssignInterventions());
        entity.setCancellationDeadlineHours(dto.getCancellationDeadlineHours());
        entity.setRequireApprovalForChanges(dto.isRequireApprovalForChanges());

        return toDto(repository.save(entity));
    }

    private WorkflowSettingsDto toDto(WorkflowSettings entity) {
        return new WorkflowSettingsDto(
                entity.isAutoAssignInterventions(),
                entity.getCancellationDeadlineHours(),
                entity.isRequireApprovalForChanges()
        );
    }
}
