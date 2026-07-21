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
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Les rapports PDF s'appuient desormais sur des agregats SQL bornes a la
 * fenetre demandee (audit perf 2026-07-21) et non plus sur findAll() +
 * filtres en memoire. Le TenantContext mocke renvoie une org null par defaut
 * (platform staff cross-org).
 */
@ExtendWith(MockitoExtension.class)
class ReportServiceTest {

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

    /** Ligne agregee [count, somme devis PAID, somme devis] de la fenetre. */
    private void stubFinancialTotals() {
        when(interventionRepository.financialTotalsForPdfReport(any(), any(), isNull()))
                .thenReturn(List.<Object[]>of(
                        new Object[]{5L, new BigDecimal("360"), new BigDecimal("600")}));
    }

    /** Compteurs par statut [status, count] de la fenetre. */
    private void stubStatusCounts() {
        when(interventionRepository.countByStatusInWindowForPdfReport(any(), any(), isNull()))
                .thenReturn(List.<Object[]>of(
                        new Object[]{InterventionStatus.COMPLETED, 3L},
                        new Object[]{InterventionStatus.PENDING, 2L}));
    }

    private void assertValidPdf(byte[] pdfBytes) {
        assertNotNull(pdfBytes);
        assertTrue(pdfBytes.length > 0);
        // Vérifier que c'est bien un PDF (commence par %PDF)
        String pdfHeader = new String(pdfBytes, 0, Math.min(4, pdfBytes.length));
        assertEquals("%PDF", pdfHeader);
    }

    @Test
    void testGenerateFinancialReport_Revenue() {
        stubFinancialTotals();

        byte[] pdfBytes = reportService.generateFinancialReport("revenue", startDate, endDate);

        assertValidPdf(pdfBytes);
    }

    @Test
    void testGenerateFinancialReport_Costs() {
        stubFinancialTotals();

        byte[] pdfBytes = reportService.generateFinancialReport("costs", startDate, endDate);

        assertValidPdf(pdfBytes);
    }

    @Test
    void testGenerateFinancialReport_Profit() {
        stubFinancialTotals();

        byte[] pdfBytes = reportService.generateFinancialReport("profit", startDate, endDate);

        assertValidPdf(pdfBytes);
    }

    @Test
    void testGenerateInterventionReport_Performance() {
        stubStatusCounts();

        byte[] pdfBytes = reportService.generateInterventionReport("performance", startDate, endDate);

        assertValidPdf(pdfBytes);
    }

    @Test
    void testGenerateInterventionReport_Planning() {
        stubStatusCounts();

        byte[] pdfBytes = reportService.generateInterventionReport("planning", startDate, endDate);

        assertValidPdf(pdfBytes);
    }

    @Test
    void testGenerateTeamReport_Performance() {
        // Compteurs SQL — plus de findAll() ni de lazy-load des membres
        when(teamRepository.countAllForPdfReport(isNull())).thenReturn(1L);
        when(teamRepository.countMembersForPdfReport(isNull())).thenReturn(2L);

        byte[] pdfBytes = reportService.generateTeamReport("performance", startDate, endDate);

        assertValidPdf(pdfBytes);
    }

    @Test
    void testGeneratePropertyReport_Status() {
        // Org null : repli legacy findAll() (cf. commentaire dans le service —
        // PropertyRepository gele par un chantier concurrent)
        List<Property> properties = createTestProperties();
        when(propertyRepository.findAll()).thenReturn(properties);

        byte[] pdfBytes = reportService.generatePropertyReport("status", startDate, endDate);

        assertValidPdf(pdfBytes);
    }

    @Test
    void testGeneratePropertyReport_Status_orgScoped_usesCountQueries() {
        // Org resolue : counts SQL, aucun findAll()
        when(tenantContext.getOrganizationId()).thenReturn(42L);
        when(propertyRepository.countForDashboard(42L, null)).thenReturn(3L);
        when(propertyRepository.countForDashboardByStatus(42L, null, PropertyStatus.ACTIVE)).thenReturn(2L);

        byte[] pdfBytes = reportService.generatePropertyReport("status", startDate, endDate);

        assertValidPdf(pdfBytes);
        verify(propertyRepository, never()).findAll();
    }

    // Helper methods
    private List<Property> createTestProperties() {
        List<Property> properties = new ArrayList<>();

        Property property = new Property();
        property.setId(1L);
        property.setName("Propriété Test");
        property.setStatus(PropertyStatus.ACTIVE);
        properties.add(property);

        return properties;
    }
}
