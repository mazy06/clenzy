package com.clenzy.service;

import com.clenzy.model.InterventionStatus;
import com.clenzy.model.Property;
import com.clenzy.model.PropertyStatus;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.TeamRepository;
import com.clenzy.tenant.TenantContext;
import com.itextpdf.kernel.geom.PageSize;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.element.Table;
import com.itextpdf.layout.properties.TextAlignment;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@Transactional
public class ReportService {

    private final PropertyRepository propertyRepository;
    private final InterventionRepository interventionRepository;
    private final TeamRepository teamRepository;
    private final TenantContext tenantContext;

    public ReportService(PropertyRepository propertyRepository,
                         InterventionRepository interventionRepository,
                         TeamRepository teamRepository,
                         TenantContext tenantContext) {
        this.propertyRepository = propertyRepository;
        this.interventionRepository = interventionRepository;
        this.teamRepository = teamRepository;
        this.tenantContext = tenantContext;
    }
    
    
    /**
     * Génère un rapport financier
     */
    public byte[] generateFinancialReport(String reportType, LocalDate startDate, LocalDate endDate) {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        
        try (PdfWriter writer = new PdfWriter(baos);
             PdfDocument pdf = new PdfDocument(writer);
             Document document = new Document(pdf, PageSize.A4)) {
            
            // En-tête professionnel avec logo Clenzy
            PdfTemplateHelper.addProfessionalHeader(
                document, 
                "Rapport Financier - " + getFinancialReportTitle(reportType),
                "Période: " + PdfTemplateHelper.formatDate(startDate) + " - " + PdfTemplateHelper.formatDate(endDate)
            );
            
            // Données selon le type de rapport
            Map<String, Object> data = getFinancialData(reportType, startDate, endDate);
            
            // Contenu du rapport avec style professionnel
            addFinancialContent(document, reportType, data, startDate, endDate);
            
            // Pied de page professionnel
            PdfTemplateHelper.addProfessionalFooter(document);
            
        } catch (Exception e) {
            throw new RuntimeException("Erreur lors de la génération du rapport financier", e);
        }
        
        return baos.toByteArray();
    }
    
    /**
     * Génère un rapport d'interventions
     */
    public byte[] generateInterventionReport(String reportType, LocalDate startDate, LocalDate endDate) {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        
        try (PdfWriter writer = new PdfWriter(baos);
             PdfDocument pdf = new PdfDocument(writer);
             Document document = new Document(pdf, PageSize.A4)) {
            
            // En-tête professionnel avec logo Clenzy
            PdfTemplateHelper.addProfessionalHeader(
                document, 
                "Rapport d'Interventions - " + getInterventionReportTitle(reportType),
                "Période: " + PdfTemplateHelper.formatDate(startDate) + " - " + PdfTemplateHelper.formatDate(endDate)
            );
            
            // Données
            Map<String, Object> data = getInterventionData(reportType, startDate, endDate);
            
            // Contenu avec style professionnel
            addInterventionContent(document, reportType, data, startDate, endDate);
            
            // Pied de page professionnel
            PdfTemplateHelper.addProfessionalFooter(document);
            
        } catch (Exception e) {
            throw new RuntimeException("Erreur lors de la génération du rapport d'interventions", e);
        }
        
        return baos.toByteArray();
    }
    
    /**
     * Génère un rapport d'équipes
     */
    public byte[] generateTeamReport(String reportType, LocalDate startDate, LocalDate endDate) {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        
        try (PdfWriter writer = new PdfWriter(baos);
             PdfDocument pdf = new PdfDocument(writer);
             Document document = new Document(pdf, PageSize.A4)) {
            
            // En-tête professionnel avec logo Clenzy
            PdfTemplateHelper.addProfessionalHeader(
                document, 
                "Rapport d'Équipes - " + getTeamReportTitle(reportType),
                "Période: " + PdfTemplateHelper.formatDate(startDate) + " - " + PdfTemplateHelper.formatDate(endDate)
            );
            
            // Données
            Map<String, Object> data = getTeamData(reportType, startDate, endDate);
            
            // Contenu avec style professionnel
            addTeamContent(document, reportType, data, startDate, endDate);
            
            // Pied de page professionnel
            PdfTemplateHelper.addProfessionalFooter(document);
            
        } catch (Exception e) {
            throw new RuntimeException("Erreur lors de la génération du rapport d'équipes", e);
        }
        
        return baos.toByteArray();
    }
    
    /**
     * Génère un rapport de propriétés
     */
    public byte[] generatePropertyReport(String reportType, LocalDate startDate, LocalDate endDate) {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        
        try (PdfWriter writer = new PdfWriter(baos);
             PdfDocument pdf = new PdfDocument(writer);
             Document document = new Document(pdf, PageSize.A4)) {
            
            // En-tête professionnel avec logo Clenzy
            PdfTemplateHelper.addProfessionalHeader(
                document, 
                "Rapport de Propriétés - " + getPropertyReportTitle(reportType),
                "Période: " + PdfTemplateHelper.formatDate(startDate) + " - " + PdfTemplateHelper.formatDate(endDate)
            );
            
            // Données
            Map<String, Object> data = getPropertyData(reportType, startDate, endDate);
            
            // Contenu avec style professionnel
            addPropertyContent(document, reportType, data, startDate, endDate);
            
            // Pied de page professionnel
            PdfTemplateHelper.addProfessionalFooter(document);
            
        } catch (Exception e) {
            throw new RuntimeException("Erreur lors de la génération du rapport de propriétés", e);
        }
        
        return baos.toByteArray();
    }
    
    // Méthodes pour récupérer les données.
    // Agrégats SQL bornés à la fenêtre [startDate, endDate] et org-scopés via le
    // TenantContext (orgId null = platform staff cross-org) — remplacent les
    // findAll() + filtres en mémoire (audit perf 2026-07-21).

    private Map<String, Object> getFinancialData(String reportType, LocalDate startDate, LocalDate endDate) {
        Map<String, Object> data = new HashMap<>();

        // Une seule ligne agrégée : [count, somme devis PAID, somme devis].
        // Fenêtre équivalente à l'ancien filtre scheduledDate.toLocalDate() ∈ [start, end].
        Object[] totals = interventionRepository.financialTotalsForPdfReport(
                startDate.atStartOfDay(), endDate.plusDays(1).atStartOfDay(),
                tenantContext.getOrganizationId()).get(0);
        long interventionsCount = ((Number) totals[0]).longValue();
        BigDecimal revenue = totals[1] != null ? (BigDecimal) totals[1] : BigDecimal.ZERO;
        BigDecimal costs = totals[2] != null ? (BigDecimal) totals[2] : BigDecimal.ZERO;

        switch (reportType) {
            case "revenue":
                data.put("totalRevenue", revenue);
                data.put("interventionsCount", interventionsCount);
                break;

            case "costs":
                data.put("totalCosts", costs);
                data.put("interventionsCount", interventionsCount);
                break;

            case "profit":
                data.put("revenue", revenue);
                data.put("costs", costs);
                data.put("profit", revenue.subtract(costs));
                break;
        }

        return data;
    }

    private Map<String, Object> getInterventionData(String reportType, LocalDate startDate, LocalDate endDate) {
        Map<String, Object> data = new HashMap<>();

        // Compteurs par statut en une requête GROUP BY sur la fenêtre planifiée.
        long completed = 0;
        long scheduled = 0;
        long total = 0;
        for (Object[] row : interventionRepository.countByStatusInWindowForPdfReport(
                startDate.atStartOfDay(), endDate.plusDays(1).atStartOfDay(),
                tenantContext.getOrganizationId())) {
            InterventionStatus status = (InterventionStatus) row[0];
            long count = ((Number) row[1]).longValue();
            total += count;
            if (status == InterventionStatus.COMPLETED) {
                completed += count;
            }
            if (status == InterventionStatus.PENDING || status == InterventionStatus.IN_PROGRESS) {
                scheduled += count;
            }
        }

        switch (reportType) {
            case "performance":
                data.put("completed", completed);
                data.put("total", total);
                data.put("completionRate", total > 0 ? (completed * 100.0 / total) : 0);
                break;

            case "planning":
                data.put("scheduled", scheduled);
                data.put("total", total);
                break;

            case "completion":
                data.put("completed", completed);
                data.put("total", total);
                break;
        }

        return data;
    }

    private Map<String, Object> getTeamData(String reportType, LocalDate startDate, LocalDate endDate) {
        Map<String, Object> data = new HashMap<>();
        Long orgId = tenantContext.getOrganizationId();
        long teamsCount = teamRepository.countAllForPdfReport(orgId);

        switch (reportType) {
            case "performance":
                data.put("teamsCount", teamsCount);
                // COUNT SQL des membres — remplace le lazy-load getMembers() par équipe.
                data.put("totalMembers", teamRepository.countMembersForPdfReport(orgId));
                break;

            case "availability":
                data.put("teamsCount", teamsCount);
                break;

            case "workload":
                data.put("teamsCount", teamsCount);
                break;
        }

        return data;
    }

    private Map<String, Object> getPropertyData(String reportType, LocalDate startDate, LocalDate endDate) {
        Map<String, Object> data = new HashMap<>();
        Long orgId = tenantContext.getOrganizationId();

        long total;
        long active;
        if (orgId != null) {
            total = propertyRepository.countForDashboard(orgId, null);
            active = "status".equals(reportType)
                    ? propertyRepository.countForDashboardByStatus(orgId, null, PropertyStatus.ACTIVE)
                    : 0;
        } else {
            // Platform staff cross-org : PropertyRepository (gelé par un chantier
            // concurrent) n'expose pas de count par statut sans org — repli sur le
            // scan legacy pour ce seul cas. À remplacer par un count SQL cross-org
            // après merge du chantier PropertyRepository.
            List<Property> properties = propertyRepository.findAll();
            total = properties.size();
            active = properties.stream()
                    .filter(p -> p.getStatus() == PropertyStatus.ACTIVE)
                    .count();
        }

        switch (reportType) {
            case "status":
                data.put("active", active);
                data.put("total", total);
                break;

            case "maintenance":
                data.put("propertiesCount", total);
                break;

            case "costs":
                data.put("propertiesCount", total);
                break;
        }

        return data;
    }
    
    // Méthodes pour ajouter le contenu au PDF avec style professionnel
    private void addFinancialContent(Document document, String reportType, Map<String, Object> data, LocalDate startDate, LocalDate endDate) throws Exception {
        PdfTemplateHelper.addSectionTitle(document, "Résumé Exécutif");
        
        switch (reportType) {
            case "revenue":
                PdfTemplateHelper.addMetric(document, "Revenus Totaux", 
                    PdfTemplateHelper.formatCurrency((BigDecimal) data.get("totalRevenue")), null);
                
                // Tableau détaillé
                Table revenueTable = PdfTemplateHelper.createStyledTable(new float[]{2, 1});
                revenueTable.addHeaderCell(PdfTemplateHelper.createHeaderCell("Indicateur"));
                revenueTable.addHeaderCell(PdfTemplateHelper.createHeaderCell("Valeur"));
                revenueTable.addCell(PdfTemplateHelper.createDataCell("Nombre d'interventions"));
                revenueTable.addCell(PdfTemplateHelper.createDataCell(String.valueOf(data.get("interventionsCount")), TextAlignment.CENTER));
                document.add(revenueTable);
                break;
                
            case "costs":
                PdfTemplateHelper.addMetric(document, "Coûts Totaux", 
                    PdfTemplateHelper.formatCurrency((BigDecimal) data.get("totalCosts")), null);
                
                Table costsTable = PdfTemplateHelper.createStyledTable(new float[]{2, 1});
                costsTable.addHeaderCell(PdfTemplateHelper.createHeaderCell("Indicateur"));
                costsTable.addHeaderCell(PdfTemplateHelper.createHeaderCell("Valeur"));
                costsTable.addCell(PdfTemplateHelper.createDataCell("Nombre d'interventions"));
                costsTable.addCell(PdfTemplateHelper.createDataCell(String.valueOf(data.get("interventionsCount")), TextAlignment.CENTER));
                document.add(costsTable);
                break;
                
            case "profit":
                // Métriques en grille
                Table profitTable = PdfTemplateHelper.createStyledTable(new float[]{1, 1, 1});
                profitTable.addHeaderCell(PdfTemplateHelper.createHeaderCell("Revenus"));
                profitTable.addHeaderCell(PdfTemplateHelper.createHeaderCell("Coûts"));
                profitTable.addHeaderCell(PdfTemplateHelper.createHeaderCell("Profit"));
                
                profitTable.addCell(PdfTemplateHelper.createDataCell(
                    PdfTemplateHelper.formatCurrency((BigDecimal) data.get("revenue")), TextAlignment.CENTER));
                profitTable.addCell(PdfTemplateHelper.createDataCell(
                    PdfTemplateHelper.formatCurrency((BigDecimal) data.get("costs")), TextAlignment.CENTER));
                profitTable.addCell(PdfTemplateHelper.createDataCell(
                    PdfTemplateHelper.formatCurrency((BigDecimal) data.get("profit")), TextAlignment.CENTER));
                document.add(profitTable);
                
                PdfTemplateHelper.addMetric(document, "Profit Net", 
                    PdfTemplateHelper.formatCurrency((BigDecimal) data.get("profit")), null);
                break;
        }
    }
    
    private void addInterventionContent(Document document, String reportType, Map<String, Object> data, LocalDate startDate, LocalDate endDate) throws Exception {
        PdfTemplateHelper.addSectionTitle(document, "Statistiques d'Interventions");
        
        switch (reportType) {
            case "performance":
                PdfTemplateHelper.addMetric(document, "Taux de Complétion", 
                    PdfTemplateHelper.formatPercentage((Double) data.get("completionRate")), null);
                
                Table perfTable = PdfTemplateHelper.createStyledTable(new float[]{2, 1});
                perfTable.addHeaderCell(PdfTemplateHelper.createHeaderCell("Indicateur"));
                perfTable.addHeaderCell(PdfTemplateHelper.createHeaderCell("Valeur"));
                perfTable.addCell(PdfTemplateHelper.createDataCell("Interventions complétées"));
                perfTable.addCell(PdfTemplateHelper.createDataCell(
                    data.get("completed") + " / " + data.get("total"), TextAlignment.CENTER));
                document.add(perfTable);
                break;
                
            case "planning":
                PdfTemplateHelper.addMetric(document, "Interventions Planifiées", 
                    String.valueOf(data.get("scheduled")), null);
                
                Table planningTable = PdfTemplateHelper.createStyledTable(new float[]{2, 1});
                planningTable.addHeaderCell(PdfTemplateHelper.createHeaderCell("Indicateur"));
                planningTable.addHeaderCell(PdfTemplateHelper.createHeaderCell("Valeur"));
                planningTable.addCell(PdfTemplateHelper.createDataCell("Total d'interventions"));
                planningTable.addCell(PdfTemplateHelper.createDataCell(String.valueOf(data.get("total")), TextAlignment.CENTER));
                document.add(planningTable);
                break;
                
            case "completion":
                PdfTemplateHelper.addMetric(document, "Interventions Complétées", 
                    String.valueOf(data.get("completed")) + " / " + String.valueOf(data.get("total")), null);
                break;
        }
    }
    
    private void addTeamContent(Document document, String reportType, Map<String, Object> data, LocalDate startDate, LocalDate endDate) throws Exception {
        PdfTemplateHelper.addSectionTitle(document, "Statistiques d'Équipes");
        
        switch (reportType) {
            case "performance":
                PdfTemplateHelper.addMetric(document, "Nombre d'Équipes", 
                    String.valueOf(data.get("teamsCount")), null);
                
                Table teamTable = PdfTemplateHelper.createStyledTable(new float[]{2, 1});
                teamTable.addHeaderCell(PdfTemplateHelper.createHeaderCell("Indicateur"));
                teamTable.addHeaderCell(PdfTemplateHelper.createHeaderCell("Valeur"));
                teamTable.addCell(PdfTemplateHelper.createDataCell("Total de membres"));
                teamTable.addCell(PdfTemplateHelper.createDataCell(String.valueOf(data.get("totalMembers")), TextAlignment.CENTER));
                document.add(teamTable);
                break;
                
            case "availability":
                PdfTemplateHelper.addMetric(document, "Nombre d'Équipes", 
                    String.valueOf(data.get("teamsCount")), null);
                break;
                
            case "workload":
                PdfTemplateHelper.addMetric(document, "Nombre d'Équipes", 
                    String.valueOf(data.get("teamsCount")), null);
                break;
        }
    }
    
    private void addPropertyContent(Document document, String reportType, Map<String, Object> data, LocalDate startDate, LocalDate endDate) throws Exception {
        PdfTemplateHelper.addSectionTitle(document, "Statistiques de Propriétés");
        
        switch (reportType) {
            case "status":
                PdfTemplateHelper.addMetric(document, "Propriétés Actives", 
                    String.valueOf(data.get("active")) + " / " + String.valueOf(data.get("total")), null);
                
                Table statusTable = PdfTemplateHelper.createStyledTable(new float[]{2, 1});
                statusTable.addHeaderCell(PdfTemplateHelper.createHeaderCell("Statut"));
                statusTable.addHeaderCell(PdfTemplateHelper.createHeaderCell("Nombre"));
                statusTable.addCell(PdfTemplateHelper.createDataCell("Actives"));
                statusTable.addCell(PdfTemplateHelper.createDataCell(String.valueOf(data.get("active")), TextAlignment.CENTER));
                statusTable.addCell(PdfTemplateHelper.createDataCell("Total"));
                statusTable.addCell(PdfTemplateHelper.createDataCell(String.valueOf(data.get("total")), TextAlignment.CENTER));
                document.add(statusTable);
                break;
                
            case "maintenance":
                PdfTemplateHelper.addMetric(document, "Nombre de Propriétés", 
                    String.valueOf(data.get("propertiesCount")), null);
                break;
                
            case "costs":
                PdfTemplateHelper.addMetric(document, "Nombre de Propriétés", 
                    String.valueOf(data.get("propertiesCount")), null);
                break;
        }
    }
    
    // Méthodes utilitaires
    private String getFinancialReportTitle(String reportType) {
        switch (reportType) {
            case "revenue": return "Revenus";
            case "costs": return "Coûts";
            case "profit": return "Profitabilité";
            default: return "Général";
        }
    }
    
    private String getInterventionReportTitle(String reportType) {
        switch (reportType) {
            case "performance": return "Performance";
            case "planning": return "Planification";
            case "completion": return "Complétion";
            default: return "Général";
        }
    }
    
    private String getTeamReportTitle(String reportType) {
        switch (reportType) {
            case "performance": return "Performance";
            case "availability": return "Disponibilité";
            case "workload": return "Charge de Travail";
            default: return "Général";
        }
    }
    
    private String getPropertyReportTitle(String reportType) {
        switch (reportType) {
            case "status": return "État";
            case "maintenance": return "Maintenance";
            case "costs": return "Coûts";
            default: return "Général";
        }
    }
    
}
