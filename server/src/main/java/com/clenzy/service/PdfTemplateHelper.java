package com.clenzy.service;

import com.itextpdf.kernel.colors.ColorConstants;
import com.itextpdf.kernel.colors.DeviceRgb;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.borders.Border;
import com.itextpdf.layout.borders.SolidBorder;
import com.itextpdf.layout.element.*;
import com.itextpdf.layout.properties.TextAlignment;
import com.itextpdf.layout.properties.UnitValue;

import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Helper class pour créer des templates PDF professionnels avec le branding Clenzy
 */
public class PdfTemplateHelper {
    
    // Couleurs Clenzy
    private static final DeviceRgb CLENZY_PRIMARY = new DeviceRgb(107, 138, 154); // #6B8A9A
    private static final DeviceRgb CLENZY_SECONDARY = new DeviceRgb(166, 192, 206); // #A6C0CE
    private static final DeviceRgb CLENZY_LIGHT = new DeviceRgb(197, 213, 224); // #C5D5E0
    private static final DeviceRgb CLENZY_DARK = new DeviceRgb(90, 118, 132); // #5A7684
    
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter DATETIME_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
    
    /**
     * Ajoute un en-tête professionnel avec logo Clenzy
     */
    public static void addProfessionalHeader(Document document, String title, String subtitle) throws IOException {
        // Container pour l'en-tête
        Table headerTable = new Table(UnitValue.createPercentArray(new float[]{1}))
            .setWidth(UnitValue.createPercentValue(100))
            .setMarginBottom(20);
        
        // Logo et titre dans une cellule
        Cell headerCell = new Cell()
            .setBorder(Border.NO_BORDER)
            .setPadding(15)
            .setBackgroundColor(CLENZY_SECONDARY, 0.1f);
        
        // Logo Clenzy (texte stylisé si pas d'image)
        Paragraph logoText = new Paragraph("CLENZY")
            .setFontSize(24)
            .setBold()
            .setFontColor(CLENZY_PRIMARY)
            .setTextAlignment(TextAlignment.LEFT)
            .setMarginBottom(5);
        headerCell.add(logoText);
        
        // Tagline
        Paragraph tagline = new Paragraph("Propreté & Multiservices")
            .setFontSize(10)
            .setFontColor(CLENZY_DARK)
            .setTextAlignment(TextAlignment.LEFT)
            .setMarginBottom(10);
        headerCell.add(tagline);
        
        // Ligne de séparation
        Paragraph divider = new Paragraph("")
            .setBorderBottom(new SolidBorder(CLENZY_SECONDARY, 2))
            .setMarginTop(8)
            .setMarginBottom(8);
        headerCell.add(divider);
        
        // Titre du rapport
        Paragraph reportTitle = new Paragraph(title)
            .setFontSize(18)
            .setBold()
            .setFontColor(CLENZY_DARK)
            .setTextAlignment(TextAlignment.LEFT)
            .setMarginTop(10);
        headerCell.add(reportTitle);
        
        // Sous-titre si présent
        if (subtitle != null && !subtitle.isEmpty()) {
            Paragraph reportSubtitle = new Paragraph(subtitle)
                .setFontSize(12)
                .setFontColor(new DeviceRgb(100, 100, 100))
                .setTextAlignment(TextAlignment.LEFT)
                .setMarginTop(5);
            headerCell.add(reportSubtitle);
        }
        
        // Date de génération
        Paragraph generationDate = new Paragraph("Généré le " + LocalDateTime.now().format(DATETIME_FORMATTER))
            .setFontSize(9)
            .setFontColor(new DeviceRgb(120, 120, 120))
            .setTextAlignment(TextAlignment.LEFT)
            .setMarginTop(8);
        headerCell.add(generationDate);
        
        headerTable.addCell(headerCell);
        document.add(headerTable);
    }
    
    /**
     * Crée un tableau professionnel avec en-tête stylisé
     */
    public static Table createStyledTable(float[] columnWidths) {
        Table table = new Table(UnitValue.createPercentArray(columnWidths))
            .setWidth(UnitValue.createPercentValue(100))
            .setMarginTop(15)
            .setMarginBottom(15);
        return table;
    }
    
    /**
     * Crée une cellule d'en-tête de tableau stylisée
     */
    public static Cell createHeaderCell(String text) {
        return new Cell()
            .add(new Paragraph(text)
                .setBold()
                .setFontSize(10)
                .setFontColor(ColorConstants.WHITE))
            .setBackgroundColor(CLENZY_PRIMARY)
            .setPadding(10)
            .setTextAlignment(TextAlignment.CENTER);
    }
    
    /**
     * Crée une cellule de données stylisée
     */
    public static Cell createDataCell(String text) {
        return new Cell()
            .add(new Paragraph(text).setFontSize(9))
            .setPadding(8)
            .setBorder(new SolidBorder(CLENZY_LIGHT, 0.5f));
    }
    
    /**
     * Crée une cellule de données avec alignement spécifique
     */
    public static Cell createDataCell(String text, TextAlignment alignment) {
        return new Cell()
            .add(new Paragraph(text).setFontSize(9))
            .setPadding(8)
            .setTextAlignment(alignment)
            .setBorder(new SolidBorder(CLENZY_LIGHT, 0.5f));
    }
    
    /**
     * Crée une section avec titre stylisé
     */
    public static void addSectionTitle(Document document, String title) {
        Paragraph sectionTitle = new Paragraph(title)
            .setFontSize(14)
            .setBold()
            .setFontColor(CLENZY_PRIMARY)
            .setMarginTop(20)
            .setMarginBottom(10);
        document.add(sectionTitle);
        
        // Ligne de séparation
        Paragraph divider = new Paragraph("")
            .setBorderBottom(new SolidBorder(CLENZY_SECONDARY, 1))
            .setMarginBottom(10);
        document.add(divider);
    }
    
    /**
     * Crée une métrique importante (KPI)
     */
    public static void addMetric(Document document, String label, String value, String unit) {
        Table metricTable = new Table(UnitValue.createPercentArray(new float[]{1}))
            .setWidth(UnitValue.createPercentValue(100))
            .setMarginBottom(10);
        
        Cell metricCell = new Cell()
            .setBackgroundColor(CLENZY_LIGHT, 0.3f)
            .setPadding(15)
            .setBorder(new SolidBorder(CLENZY_SECONDARY, 1));
        
        Paragraph labelPara = new Paragraph(label)
            .setFontSize(10)
            .setFontColor(new DeviceRgb(100, 100, 100))
            .setMarginBottom(5);
        metricCell.add(labelPara);
        
        Paragraph valuePara = new Paragraph(value + (unit != null ? " " + unit : ""))
            .setFontSize(20)
            .setBold()
            .setFontColor(CLENZY_PRIMARY);
        metricCell.add(valuePara);
        
        metricTable.addCell(metricCell);
        document.add(metricTable);
    }
    
    /**
     * Ajoute un pied de page professionnel
     */
    public static void addProfessionalFooter(Document document) {
        Table footerTable = new Table(UnitValue.createPercentArray(new float[]{1}))
            .setWidth(UnitValue.createPercentValue(100))
            .setMarginTop(30);
        
        Cell footerCell = new Cell()
            .setBorder(Border.NO_BORDER)
            .setPadding(10)
            .setBackgroundColor(CLENZY_DARK, 0.1f)
            .setTextAlignment(TextAlignment.CENTER);
        
        Paragraph footerText = new Paragraph("Clenzy Platform - Plateforme de gestion des services Airbnb")
            .setFontSize(8)
            .setFontColor(new DeviceRgb(100, 100, 100));
        footerCell.add(footerText);
        
        Paragraph contactText = new Paragraph("www.clenzy.com | support@clenzy.com")
            .setFontSize(7)
            .setFontColor(new DeviceRgb(120, 120, 120))
            .setMarginTop(3);
        footerCell.add(contactText);
        
        footerTable.addCell(footerCell);
        document.add(footerTable);
    }
    
    /**
     * Crée une info box stylisée
     */
    public static void addInfoBox(Document document, String text, DeviceRgb backgroundColor) {
        Table infoTable = new Table(UnitValue.createPercentArray(new float[]{1}))
            .setWidth(UnitValue.createPercentValue(100))
            .setMarginTop(10)
            .setMarginBottom(10);
        
        Cell infoCell = new Cell()
            .setBackgroundColor(backgroundColor, 0.2f)
            .setPadding(12)
            .setBorder(new SolidBorder(backgroundColor, 1));
        
        Paragraph infoText = new Paragraph(text)
            .setFontSize(9)
            .setFontColor(new DeviceRgb(60, 60, 60));
        infoCell.add(infoText);
        
        infoTable.addCell(infoCell);
        document.add(infoTable);
    }
    
    /**
     * Formate un montant en devise
     */
    public static String formatCurrency(java.math.BigDecimal amount) {
        if (amount == null) return "€0,00";
        return "€" + amount.setScale(2, java.math.RoundingMode.HALF_UP).toString().replace(".", ",");
    }
    
    /**
     * Formate une date
     */
    public static String formatDate(java.time.LocalDate date) {
        if (date == null) return "-";
        return date.format(DATE_FORMATTER);
    }
    
    /**
     * Formate un pourcentage
     */
    public static String formatPercentage(double value) {
        return String.format("%.2f", value).replace(".", ",") + "%";
    }
}
