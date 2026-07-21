package com.clenzy.service;

import com.clenzy.model.InterventionStatus;
import com.clenzy.model.Property;
import com.clenzy.model.PropertyStatus;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.TeamRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/**
 * Sous-types de rapports et cas limites — agregats SQL bornes a la fenetre
 * (audit perf 2026-07-21) : les cas "scheduledDate null" et "estimatedCost
 * null" sont desormais geres par la requete elle-meme (filtre date + COALESCE),
 * les tests verifient que le rendu PDF reste valide avec des agregats vides
 * ou partiels.
 */
@ExtendWith(MockitoExtension.class)
class ReportServiceExtendedTest {

    @Mock
    private PropertyRepository propertyRepository;

    @Mock
    private InterventionRepository interventionRepository;

    @Mock
    private TeamRepository teamRepository;

    @Mock
    private TenantContext tenantContext;

    @InjectMocks
    private ReportService reportService;

    private LocalDate startDate;
    private LocalDate endDate;

    @BeforeEach
    void setUp() {
        startDate = LocalDate.now().minusMonths(1);
        endDate = LocalDate.now();
        lenient().when(tenantContext.getOrganizationId()).thenReturn(null);
    }

    // --- Intervention report: completion subtype ---

    @Test
    void generateInterventionReport_completion_producesValidPdf() {
        when(interventionRepository.countByStatusInWindowForPdfReport(any(), any(), isNull()))
                .thenReturn(List.<Object[]>of(
                        new Object[]{InterventionStatus.COMPLETED, 3L},
                        new Object[]{InterventionStatus.PENDING, 2L}));

        byte[] pdfBytes = reportService.generateInterventionReport("completion", startDate, endDate);

        assertValidPdf(pdfBytes);
    }

    // --- Team report: availability subtype ---

    @Test
    void generateTeamReport_availability_producesValidPdf() {
        when(teamRepository.countAllForPdfReport(isNull())).thenReturn(1L);

        byte[] pdfBytes = reportService.generateTeamReport("availability", startDate, endDate);

        assertValidPdf(pdfBytes);
    }

    // --- Team report: workload subtype ---

    @Test
    void generateTeamReport_workload_producesValidPdf() {
        when(teamRepository.countAllForPdfReport(isNull())).thenReturn(1L);

        byte[] pdfBytes = reportService.generateTeamReport("workload", startDate, endDate);

        assertValidPdf(pdfBytes);
    }

    // --- Property report: maintenance subtype ---

    @Test
    void generatePropertyReport_maintenance_producesValidPdf() {
        when(propertyRepository.count()).thenReturn(3L);

        byte[] pdfBytes = reportService.generatePropertyReport("maintenance", startDate, endDate);

        assertValidPdf(pdfBytes);
    }

    // --- Property report: costs subtype ---

    @Test
    void generatePropertyReport_costs_producesValidPdf() {
        when(propertyRepository.count()).thenReturn(3L);

        byte[] pdfBytes = reportService.generatePropertyReport("costs", startDate, endDate);

        assertValidPdf(pdfBytes);
    }

    // --- Edge: no interventions in window ---

    @Test
    void generateInterventionReport_emptyList_producesValidPdf() {
        when(interventionRepository.countByStatusInWindowForPdfReport(any(), any(), isNull()))
                .thenReturn(List.of());

        byte[] pdfBytes = reportService.generateInterventionReport("performance", startDate, endDate);

        assertValidPdf(pdfBytes);
    }

    // --- Edge: aucune ligne ne matche la fenetre → COUNT 0 et SUM null ---

    @Test
    void generateFinancialReport_emptyWindow_handledGracefully() {
        when(interventionRepository.financialTotalsForPdfReport(any(), any(), isNull()))
                .thenReturn(List.<Object[]>of(new Object[]{0L, null, null}));

        byte[] pdfBytes = reportService.generateFinancialReport("revenue", startDate, endDate);

        assertValidPdf(pdfBytes);
    }

    // --- Edge: couts partiels (COALESCE cote SQL) ---

    @Test
    void generateFinancialReport_partialCosts_handledGracefully() {
        when(interventionRepository.financialTotalsForPdfReport(any(), any(), isNull()))
                .thenReturn(List.<Object[]>of(
                        new Object[]{2L, new BigDecimal("150"), new BigDecimal("150")}));

        byte[] pdfBytes = reportService.generateFinancialReport("revenue", startDate, endDate);

        assertValidPdf(pdfBytes);
    }

    // --- Helper methods ---

    private void assertValidPdf(byte[] pdfBytes) {
        assertNotNull(pdfBytes);
        assertTrue(pdfBytes.length > 0);
        String pdfHeader = new String(pdfBytes, 0, Math.min(4, pdfBytes.length));
        assertEquals("%PDF", pdfHeader);
    }

    private List<Property> createTestProperties() {
        List<Property> properties = new ArrayList<>();
        Property property = new Property();
        property.setId(1L);
        property.setName("Propriete Test");
        property.setStatus(PropertyStatus.ACTIVE);
        properties.add(property);
        return properties;
    }
}
