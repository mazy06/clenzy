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
class ReportServiceTest {

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

    @Test
    void testGenerateFinancialReport_Revenue() {
        // Arrange
        List<Intervention> interventions = createTestInterventions();
        when(interventionRepository.findAll()).thenReturn(interventions);

        // Act
        byte[] pdfBytes = reportService.generateFinancialReport("revenue", startDate, endDate);

        // Assert
        assertNotNull(pdfBytes);
        assertTrue(pdfBytes.length > 0);
        // Vérifier que c'est bien un PDF (commence par %PDF)
        String pdfHeader = new String(pdfBytes, 0, Math.min(4, pdfBytes.length));
        assertEquals("%PDF", pdfHeader);
    }

    @Test
    void testGenerateFinancialReport_Costs() {
        // Arrange
        List<Intervention> interventions = createTestInterventions();
        when(interventionRepository.findAll()).thenReturn(interventions);

        // Act
        byte[] pdfBytes = reportService.generateFinancialReport("costs", startDate, endDate);

        // Assert
        assertNotNull(pdfBytes);
        assertTrue(pdfBytes.length > 0);
        String pdfHeader = new String(pdfBytes, 0, Math.min(4, pdfBytes.length));
        assertEquals("%PDF", pdfHeader);
    }

    @Test
    void testGenerateFinancialReport_Profit() {
        // Arrange
        List<Intervention> interventions = createTestInterventions();
        when(interventionRepository.findAll()).thenReturn(interventions);

        // Act
        byte[] pdfBytes = reportService.generateFinancialReport("profit", startDate, endDate);

        // Assert
        assertNotNull(pdfBytes);
        assertTrue(pdfBytes.length > 0);
        String pdfHeader = new String(pdfBytes, 0, Math.min(4, pdfBytes.length));
        assertEquals("%PDF", pdfHeader);
    }

    @Test
    void testGenerateInterventionReport_Performance() {
        // Arrange
        List<Intervention> interventions = createTestInterventions();
        when(interventionRepository.findAll()).thenReturn(interventions);

        // Act
        byte[] pdfBytes = reportService.generateInterventionReport("performance", startDate, endDate);

        // Assert
        assertNotNull(pdfBytes);
        assertTrue(pdfBytes.length > 0);
        String pdfHeader = new String(pdfBytes, 0, Math.min(4, pdfBytes.length));
        assertEquals("%PDF", pdfHeader);
    }

    @Test
    void testGenerateInterventionReport_Planning() {
        // Arrange
        List<Intervention> interventions = createTestInterventions();
        when(interventionRepository.findAll()).thenReturn(interventions);

        // Act
        byte[] pdfBytes = reportService.generateInterventionReport("planning", startDate, endDate);

        // Assert
        assertNotNull(pdfBytes);
        assertTrue(pdfBytes.length > 0);
        String pdfHeader = new String(pdfBytes, 0, Math.min(4, pdfBytes.length));
        assertEquals("%PDF", pdfHeader);
    }

    @Test
    void testGenerateTeamReport_Performance() {
        // Arrange
        List<Team> teams = createTestTeams();
        when(teamRepository.findAll()).thenReturn(teams);

        // Act
        byte[] pdfBytes = reportService.generateTeamReport("performance", startDate, endDate);

        // Assert
        assertNotNull(pdfBytes);
        assertTrue(pdfBytes.length > 0);
        String pdfHeader = new String(pdfBytes, 0, Math.min(4, pdfBytes.length));
        assertEquals("%PDF", pdfHeader);
    }

    @Test
    void testGeneratePropertyReport_Status() {
        // Arrange
        List<Property> properties = createTestProperties();
        when(propertyRepository.findAll()).thenReturn(properties);

        // Act
        byte[] pdfBytes = reportService.generatePropertyReport("status", startDate, endDate);

        // Assert
        assertNotNull(pdfBytes);
        assertTrue(pdfBytes.length > 0);
        String pdfHeader = new String(pdfBytes, 0, Math.min(4, pdfBytes.length));
        assertEquals("%PDF", pdfHeader);
    }

    // Helper methods
    private List<Intervention> createTestInterventions() {
        List<Intervention> interventions = new ArrayList<>();
        
        // Créer quelques interventions de test
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
        team.setName("Équipe Test");
        // La liste des membres sera vide par défaut (initialisée dans Team)
        // Pas besoin de la définir explicitement pour le test
        teams.add(team);
        
        return teams;
    }

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
