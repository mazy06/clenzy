package com.clenzy.service.report;

import com.clenzy.dto.ReportViewDto;
import com.clenzy.dto.ReportViewRequest;
import com.clenzy.model.ReportView;
import com.clenzy.repository.ReportViewRepository;
import com.clenzy.service.access.OrganizationAccessGuard;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * CRUD des vues de rapport (CLZ-P0-15) : whitelist + ownership org.
 */
@ExtendWith(MockitoExtension.class)
class ReportViewServiceTest {

    @Mock
    ReportViewRepository repository;

    private final ReportFieldCatalog catalog = new ReportFieldCatalog();
    private final TenantContext tenantContext = new TenantContext();
    private final OrganizationAccessGuard guard = new OrganizationAccessGuard(tenantContext);
    private ReportViewService service;

    @BeforeEach
    void setUp() {
        service = new ReportViewService(repository, catalog, guard);
    }

    @Test
    void create_validatesAndNormalizesAndSaves() {
        when(repository.save(any())).thenAnswer(a -> {
            ReportView v = a.getArgument(0);
            v.setId(1L);
            return v;
        });

        ReportViewRequest req = new ReportViewRequest(
            "Ma vue", List.of("property", "country"), List.of("revenue"), null, "month");

        ReportViewDto dto = service.create(req, 7L, "kc-1");

        assertThat(dto.id()).isEqualTo(1L);
        assertThat(dto.dimensions()).containsExactly("PROPERTY", "COUNTRY");
        assertThat(dto.metrics()).containsExactly("REVENUE");
        assertThat(dto.granularity()).isEqualTo("MONTH");
    }

    @Test
    void create_rejectsUnknownFieldWithoutSaving() {
        ReportViewRequest req = new ReportViewRequest(
            "x", List.of("HACK"), List.of("revenue"), null, "month");

        assertThatThrownBy(() -> service.create(req, 7L, "kc"))
            .isInstanceOf(IllegalArgumentException.class);
        verify(repository, never()).save(any());
    }

    @Test
    void get_deniesCrossOrgAccess() {
        ReportView v = new ReportView();
        v.setId(5L);
        v.setOrganizationId(1L);
        when(repository.findById(5L)).thenReturn(Optional.of(v));

        assertThatThrownBy(() -> service.get(5L, 2L)).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void get_allowsSameOrg() {
        ReportView v = new ReportView();
        v.setId(5L);
        v.setOrganizationId(1L);
        v.setName("V");
        v.setDimensions("PROPERTY");
        v.setMetrics("REVENUE");
        v.setGranularity("MONTH");
        when(repository.findById(5L)).thenReturn(Optional.of(v));

        assertThat(service.get(5L, 1L).name()).isEqualTo("V");
    }
}
