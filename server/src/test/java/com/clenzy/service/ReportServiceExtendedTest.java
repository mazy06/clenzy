package com.clenzy.service;

import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.PaymentStatus;
import com.clenzy.model.Property;
import com.clenzy.model.PropertyStatus;
import com.clenzy.model.Team;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.TeamRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReportServiceExtendedTest {

    @Mock
    private PropertyRepository propertyRepository;

    @Mock
    private InterventionRepository interventionRepository;

    @Mock
    private TeamRepository teamRepository;

    @InjectMocks
    private ReportService reportService;

    private LocalDate startDate;
    private LocalDate endDate;

    @BeforeEach
    void setUp() {
        startDate = LocalDate.now().minusMonths(1);
        endDate = LocalDate.now();
    }

    // --- Intervention report: completion subtype ---

    @Test
    void generateInterventionReport_completion_producesValidPdf() {
        List<Intervention> interventions = createTestInterventions();
        when(interventionRepository.findAll()).thenReturn(interventions);

        byte[] pdfBytes = reportService.generateInterventionReport("completion", startDate, endDate);

        assertValidPdf(pdfBytes);
    }

    // --- Team report: availability subtype ---

    @Test
    void generateTeamReport_availability_producesValidPdf() {
        List<Team> teams = createTestTeams();
        when(teamRepository.findAll()).thenReturn(teams);

        byte[] pdfBytes = reportService.generateTeamReport("availability", startDate, endDate);

        assertValidPdf(pdfBytes);
    }

    // --- Team report: workload subtype ---

    @Test
    void generateTeamReport_workload_producesValidPdf() {
        List<Team> teams = createTestTeams();
        when(teamRepository.findAll()).thenReturn(teams);

        byte[] pdfBytes = reportService.generateTeamReport("workload", startDate, endDate);

        assertValidPdf(pdfBytes);
    }

    // --- Property report: maintenance subtype ---

    @Test
    void generatePropertyReport_maintenance_producesValidPdf() {
        List<Property> properties = createTestProperties();
        when(propertyRepository.findAll()).thenReturn(properties);

        byte[] pdfBytes = reportService.generatePropertyReport("maintenance", startDate, endDate);

        assertValidPdf(pdfBytes);
    }

    // --- Property report: costs subtype ---

    @Test
    void generatePropertyReport_costs_producesValidPdf() {
        List<Property> properties = createTestProperties();
        when(propertyRepository.findAll()).thenReturn(properties);

        byte[] pdfBytes = reportService.generatePropertyReport("costs", startDate, endDate);

        assertValidPdf(pdfBytes);
    }

    // --- Edge: empty interventions list ---

    @Test
    void generateInterventionReport_emptyList_producesValidPdf() {
        when(interventionRepository.findAll()).thenReturn(List.of());

        byte[] pdfBytes = reportService.generateInterventionReport("performance", startDate, endDate);

        assertValidPdf(pdfBytes);
    }

    // --- Edge: interventions with null scheduledDate are filtered out ---

    @Test
    void generateFinancialReport_nullScheduledDate_filteredCorrectly() {
        List<Intervention> interventions = new ArrayList<>();

        // Intervention with null scheduledDate -- should be filtered out
        Intervention noDate = new Intervention();
        noDate.setId(1L);
        noDate.setStatus(InterventionStatus.COMPLETED);
        noDate.setPaymentStatus(PaymentStatus.PAID);
        noDate.setEstimatedCost(BigDecimal.valueOf(200));
        noDate.setScheduledDate(null);
        interventions.add(noDate);

        // Intervention with valid scheduledDate within range
        Intervention withDate = new Intervention();
        withDate.setId(2L);
        withDate.setStatus(InterventionStatus.COMPLETED);
        withDate.setPaymentStatus(PaymentStatus.PAID);
        withDate.setEstimatedCost(BigDecimal.valueOf(100));
        withDate.setScheduledDate(LocalDateTime.now().minusDays(5));
        interventions.add(withDate);

        when(interventionRepository.findAll()).thenReturn(interventions);

        byte[] pdfBytes = reportService.generateFinancialReport("revenue", startDate, endDate);

        assertValidPdf(pdfBytes);
    }

    // --- Edge: interventions with null estimatedCost handled gracefully ---

    @Test
    void generateFinancialReport_nullEstimatedCost_handledGracefully() {
        List<Intervention> interventions = new ArrayList<>();

        Intervention nullCost = new Intervention();
        nullCost.setId(1L);
        nullCost.setStatus(InterventionStatus.COMPLETED);
        nullCost.setPaymentStatus(PaymentStatus.PAID);
        nullCost.setEstimatedCost(null);
        nullCost.setScheduledDate(LocalDateTime.now().minusDays(3));
        interventions.add(nullCost);

        Intervention withCost = new Intervention();
        withCost.setId(2L);
        withCost.setStatus(InterventionStatus.COMPLETED);
        withCost.setPaymentStatus(PaymentStatus.PAID);
        withCost.setEstimatedCost(BigDecimal.valueOf(150));
        withCost.setScheduledDate(LocalDateTime.now().minusDays(2));
        interventions.add(withCost);

        when(interventionRepository.findAll()).thenReturn(interventions);

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

    private List<Intervention> createTestInterventions() {
        List<Intervention> interventions = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            Intervention intervention = new Intervention();
            intervention.setId((long) i);
            intervention.setStatus(i % 2 == 0 ? InterventionStatus.COMPLETED : InterventionStatus.PENDING);
            intervention.setPaymentStatus(i % 2 == 0 ? PaymentStatus.PAID : PaymentStatus.PENDING);
            intervention.setEstimatedCost(BigDecimal.valueOf(100.0 + i * 10));
            intervention.setScheduledDate(LocalDateTime.now().minusDays(i));
            interventions.add(intervention);
        }
        return interventions;
    }

    private List<Team> createTestTeams() {
        List<Team> teams = new ArrayList<>();
        Team team = new Team();
        team.setId(1L);
        team.setName("Equipe Test");
        teams.add(team);
        return teams;
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
