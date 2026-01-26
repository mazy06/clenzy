package com.clenzy.service;

import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.PaymentStatus;
import com.clenzy.model.Property;
import com.clenzy.model.PropertyStatus;
import com.clenzy.model.Team;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.repository.TeamRepository;
import com.itextpdf.kernel.geom.PageSize;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.element.Table;
import com.itextpdf.layout.properties.TextAlignment;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@Transactional
public class ReportService {
    
    @Autowired
    private PropertyRepository propertyRepository;
    
    @Autowired
    private InterventionRepository interventionRepository;
    
    @Autowired
    private TeamRepository teamRepository;
    
    
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
    
    // Méthodes pour récupérer les données
    private Map<String, Object> getFinancialData(String reportType, LocalDate startDate, LocalDate endDate) {
        Map<String, Object> data = new HashMap<>();
        
        List<Intervention> interventions = interventionRepository.findAll().stream()
            .filter(i -> {
                if (i.getScheduledDate() == null) return false;
                LocalDate scheduledDate = i.getScheduledDate().toLocalDate();
                return !scheduledDate.isBefore(startDate) && !scheduledDate.isAfter(endDate);
            })
            .collect(Collectors.toList());
        
        switch (reportType) {
            case "revenue":
                BigDecimal totalRevenue = interventions.stream()
                    .filter(i -> i.getPaymentStatus() == PaymentStatus.PAID && i.getEstimatedCost() != null)
                    .map(Intervention::getEstimatedCost)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
                data.put("totalRevenue", totalRevenue);
                data.put("interventionsCount", interventions.size());
                break;
                
            case "costs":
                BigDecimal totalCosts = interventions.stream()
                    .filter(i -> i.getEstimatedCost() != null)
                    .map(Intervention::getEstimatedCost)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
                data.put("totalCosts", totalCosts);
                data.put("interventionsCount", interventions.size());
                break;
                
            case "profit":
                BigDecimal revenue = interventions.stream()
                    .filter(i -> i.getPaymentStatus() == PaymentStatus.PAID && i.getEstimatedCost() != null)
                    .map(Intervention::getEstimatedCost)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
                BigDecimal costs = interventions.stream()
                    .filter(i -> i.getEstimatedCost() != null)
                    .map(Intervention::getEstimatedCost)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
                data.put("revenue", revenue);
                data.put("costs", costs);
                data.put("profit", revenue.subtract(costs));
                break;
        }
        
        return data;
    }
    
    private Map<String, Object> getInterventionData(String reportType, LocalDate startDate, LocalDate endDate) {
        Map<String, Object> data = new HashMap<>();
        
        List<Intervention> interventions = interventionRepository.findAll().stream()
            .filter(i -> {
                if (i.getScheduledDate() == null) return false;
                LocalDate scheduledDate = i.getScheduledDate().toLocalDate();
                return !scheduledDate.isBefore(startDate) && !scheduledDate.isAfter(endDate);
            })
            .collect(Collectors.toList());
        
        switch (reportType) {
            case "performance":
                long completed = interventions.stream()
                    .filter(i -> i.getStatus() == InterventionStatus.COMPLETED)
                    .count();
                long total = interventions.size();
                data.put("completed", completed);
                data.put("total", total);
                data.put("completionRate", total > 0 ? (completed * 100.0 / total) : 0);
                break;
                
            case "planning":
                data.put("scheduled", interventions.stream()
                    .filter(i -> i.getStatus() == InterventionStatus.PENDING || i.getStatus() == InterventionStatus.IN_PROGRESS)
                    .count());
                data.put("total", interventions.size());
                break;
                
            case "completion":
                long completedCount = interventions.stream()
                    .filter(i -> i.getStatus() == InterventionStatus.COMPLETED)
                    .count();
                data.put("completed", completedCount);
                data.put("total", interventions.size());
                break;
        }
        
        return data;
    }
    
    private Map<String, Object> getTeamData(String reportType, LocalDate startDate, LocalDate endDate) {
        Map<String, Object> data = new HashMap<>();
        List<Team> teams = teamRepository.findAll();
        
        switch (reportType) {
            case "performance":
                data.put("teamsCount", teams.size());
                data.put("totalMembers", teams.stream()
                    .mapToInt(t -> t.getMembers() != null ? t.getMembers().size() : 0)
                    .sum());
                break;
                
            case "availability":
                data.put("teamsCount", teams.size());
                break;
                
            case "workload":
                data.put("teamsCount", teams.size());
                break;
        }
        
        return data;
    }
    
    private Map<String, Object> getPropertyData(String reportType, LocalDate startDate, LocalDate endDate) {
        Map<String, Object> data = new HashMap<>();
        List<Property> properties = propertyRepository.findAll();
        
        switch (reportType) {
            case "status":
                long active = properties.stream()
                    .filter(p -> p.getStatus() == PropertyStatus.ACTIVE)
                    .count();
                data.put("active", active);
                data.put("total", properties.size());
                break;
                
            case "maintenance":
                data.put("propertiesCount", properties.size());
                break;
                
            case "costs":
                data.put("propertiesCount", properties.size());
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
