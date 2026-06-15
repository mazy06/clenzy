package com.clenzy.service.report;

import com.clenzy.dto.ReportViewDto;
import com.clenzy.dto.ReportViewRequest;
import com.clenzy.model.ReportView;
import com.clenzy.repository.ReportViewRepository;
import com.clenzy.service.access.OrganizationAccessGuard;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

/**
 * CRUD des vues de rapport sauvegardées (CLZ-P0-15).
 *
 * <p>Valide les champs contre la whitelist ({@link ReportFieldCatalog}, anti-injection)
 * avant persistance, et applique {@code requireSameOrganization} à chaque chargement par
 * ID (audit #3). L'exécution des agrégations (et le partage) sont des sous-tâches à venir.</p>
 */
@Service
@Transactional
public class ReportViewService {

    private final ReportViewRepository repository;
    private final ReportFieldCatalog catalog;
    private final OrganizationAccessGuard organizationAccessGuard;

    public ReportViewService(ReportViewRepository repository,
                             ReportFieldCatalog catalog,
                             OrganizationAccessGuard organizationAccessGuard) {
        this.repository = repository;
        this.catalog = catalog;
        this.organizationAccessGuard = organizationAccessGuard;
    }

    public ReportViewDto create(ReportViewRequest request, Long orgId, String ownerKeycloakId) {
        catalog.validate(request.dimensions(), request.metrics(), request.granularity());
        ReportView view = new ReportView();
        view.setOrganizationId(orgId);
        view.setName(request.name());
        view.setOwnerKeycloakId(ownerKeycloakId);
        view.setDimensions(joinCodes(request.dimensions()));
        view.setMetrics(joinCodes(request.metrics()));
        view.setFiltersJson(request.filtersJson());
        view.setGranularity(normalizeGranularity(request.granularity()));
        return toDto(repository.save(view));
    }

    @Transactional(readOnly = true)
    public List<ReportViewDto> list(Long orgId) {
        return repository.findByOrganizationId(orgId).stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public ReportViewDto get(Long id, Long orgId) {
        return toDto(load(id, orgId));
    }

    public void delete(Long id, Long orgId) {
        repository.delete(load(id, orgId));
    }

    private ReportView load(Long id, Long orgId) {
        ReportView view = repository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Vue de rapport introuvable: " + id));
        organizationAccessGuard.requireSameOrganization(
            view.getOrganizationId(), orgId, "Vue de rapport hors de votre organisation");
        return view;
    }

    private String joinCodes(List<String> codes) {
        return codes.stream().map(c -> c.trim().toUpperCase(Locale.ROOT)).collect(Collectors.joining(","));
    }

    private List<String> splitCodes(String csv) {
        if (csv == null || csv.isBlank()) {
            return List.of();
        }
        return Arrays.stream(csv.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }

    private String normalizeGranularity(String granularity) {
        return (granularity == null || granularity.isBlank()) ? "MONTH" : granularity.trim().toUpperCase(Locale.ROOT);
    }

    private ReportViewDto toDto(ReportView v) {
        return new ReportViewDto(v.getId(), v.getName(), splitCodes(v.getDimensions()),
            splitCodes(v.getMetrics()), v.getGranularity(), v.getFiltersJson());
    }
}
