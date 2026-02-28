package com.clenzy.service;

import com.clenzy.dto.GenerateInvoiceRequest;
import com.clenzy.dto.InvoiceDto;
import com.clenzy.fiscal.*;
import com.clenzy.model.*;
import com.clenzy.repository.FiscalProfileRepository;
import com.clenzy.repository.InvoiceRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Service de generation de factures a partir des reservations.
 *
 * Responsabilites :
 * - Creer une facture (DRAFT) avec lignes detaillees
 * - Calculer les taxes via le FiscalEngine (TVA par categorie)
 * - Ajouter la taxe de sejour si applicable
 * - Emettre la facture (DRAFT → ISSUED, attribue un numero sequentiel)
 * - Annuler via CREDIT_NOTE (les factures emises sont immutables)
 */
@Service
@Transactional(readOnly = true)
public class InvoiceGeneratorService {

    private static final Logger log = LoggerFactory.getLogger(InvoiceGeneratorService.class);

    private final InvoiceRepository invoiceRepository;
    private final ReservationRepository reservationRepository;
    private final FiscalProfileRepository fiscalProfileRepository;
    private final FiscalEngine fiscalEngine;
    private final InvoiceNumberingService numberingService;
    private final TenantContext tenantContext;

    public InvoiceGeneratorService(InvoiceRepository invoiceRepository,
                                    ReservationRepository reservationRepository,
                                    FiscalProfileRepository fiscalProfileRepository,
                                    FiscalEngine fiscalEngine,
                                    InvoiceNumberingService numberingService,
                                    TenantContext tenantContext) {
        this.invoiceRepository = invoiceRepository;
        this.reservationRepository = reservationRepository;
        this.fiscalProfileRepository = fiscalProfileRepository;
        this.fiscalEngine = fiscalEngine;
        this.numberingService = numberingService;
        this.tenantContext = tenantContext;
    }

    /**
     * Genere une facture DRAFT a partir d'une reservation.
     * La facture n'est pas encore numerotee (pas de numero legal).
     */
    @Transactional
    public InvoiceDto generateFromReservation(GenerateInvoiceRequest request) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        String countryCode = tenantContext.getCountryCode();
        String currency = tenantContext.getDefaultCurrency();

        // Verifier qu'il n'y a pas deja une facture pour cette reservation
        invoiceRepository.findByReservationId(request.reservationId())
            .ifPresent(existing -> {
                throw new IllegalStateException(
                    "Une facture existe deja pour la reservation " + request.reservationId()
                    + " (facture " + existing.getInvoiceNumber() + ")");
            });

        Reservation reservation = reservationRepository.findById(request.reservationId())
            .orElseThrow(() -> new IllegalArgumentException(
                "Reservation introuvable: " + request.reservationId()));

        // Charger le profil fiscal pour les infos vendeur
        FiscalProfile fiscalProfile = fiscalProfileRepository.findByOrganizationId(orgId)
            .orElseThrow(() -> new IllegalStateException(
                "Profil fiscal non configure pour l'organisation " + orgId));

        // Creer la facture
        Invoice invoice = new Invoice();
        invoice.setOrganizationId(orgId);
        invoice.setInvoiceNumber("DRAFT"); // sera remplace a l'emission
        invoice.setInvoiceDate(LocalDate.now());
        invoice.setDueDate(LocalDate.now().plusDays(30));
        invoice.setCurrency(currency);
        invoice.setCountryCode(countryCode);
        invoice.setReservationId(reservation.getId());
        invoice.setStatus(InvoiceStatus.DRAFT);

        // Infos vendeur depuis FiscalProfile
        invoice.setSellerName(fiscalProfile.getLegalEntityName());
        invoice.setSellerAddress(fiscalProfile.getLegalAddress());
        invoice.setSellerTaxId(fiscalProfile.getVatNumber() != null
            ? fiscalProfile.getVatNumber() : fiscalProfile.getTaxIdNumber());

        // Infos acheteur
        invoice.setBuyerName(request.buyerName() != null
            ? request.buyerName() : reservation.getGuestName());
        invoice.setBuyerAddress(request.buyerAddress());
        invoice.setBuyerTaxId(request.buyerTaxId());

        // Mentions legales
        invoice.setLegalMentions(fiscalProfile.getLegalMentions());

        // --- Generer les lignes ---
        int lineNum = 1;

        // Ligne 1: Hebergement (TVA reduite ACCOMMODATION)
        BigDecimal roomRevenue = reservation.getRoomRevenue() != null
            ? reservation.getRoomRevenue()
            : reservation.getTotalPrice();

        if (roomRevenue != null && roomRevenue.compareTo(BigDecimal.ZERO) > 0) {
            long nights = ChronoUnit.DAYS.between(reservation.getCheckIn(), reservation.getCheckOut());
            if (nights <= 0) nights = 1;

            TaxResult accommodationTax = fiscalEngine.calculateTax(
                countryCode,
                new TaxableItem(roomRevenue, TaxCategory.ACCOMMODATION.name(),
                    "Hebergement " + reservation.getCheckIn() + " - " + reservation.getCheckOut()),
                reservation.getCheckIn()
            );

            InvoiceLine accommodationLine = createLine(lineNum++,
                String.format("Hebergement du %s au %s (%d nuits)",
                    reservation.getCheckIn(), reservation.getCheckOut(), nights),
                BigDecimal.ONE, roomRevenue,
                TaxCategory.ACCOMMODATION.name(),
                accommodationTax.taxRate(), accommodationTax.taxAmount(),
                accommodationTax.amountHT(), accommodationTax.amountTTC());
            invoice.addLine(accommodationLine);
        }

        // Ligne 2: Frais de menage (TVA standard CLEANING)
        BigDecimal cleaningFee = reservation.getCleaningFee();
        if (cleaningFee != null && cleaningFee.compareTo(BigDecimal.ZERO) > 0) {
            TaxResult cleaningTax = fiscalEngine.calculateTax(
                countryCode,
                new TaxableItem(cleaningFee, TaxCategory.CLEANING.name(), "Frais de menage"),
                reservation.getCheckIn()
            );

            InvoiceLine cleaningLine = createLine(lineNum++,
                "Frais de menage",
                BigDecimal.ONE, cleaningFee,
                TaxCategory.CLEANING.name(),
                cleaningTax.taxRate(), cleaningTax.taxAmount(),
                cleaningTax.amountHT(), cleaningTax.amountTTC());
            invoice.addLine(cleaningLine);
        }

        // Ligne 3: Taxe de sejour (pas de TVA)
        BigDecimal touristTaxRate = request.touristTaxRatePerPerson();
        if (touristTaxRate != null && touristTaxRate.compareTo(BigDecimal.ZERO) > 0) {
            int guests = reservation.getGuestCount() != null ? reservation.getGuestCount() : 1;
            long nights = ChronoUnit.DAYS.between(reservation.getCheckIn(), reservation.getCheckOut());
            if (nights <= 0) nights = 1;

            TouristTaxResult touristTax = fiscalEngine.calculateTouristTax(
                countryCode,
                TouristTaxInput.perPerson(BigDecimal.ZERO, guests, (int) nights, 0, touristTaxRate)
            );

            if (touristTax.amount().compareTo(BigDecimal.ZERO) > 0) {
                InvoiceLine touristTaxLine = createLine(lineNum++,
                    touristTax.description(),
                    BigDecimal.ONE, touristTax.amount(),
                    TaxCategory.TOURIST_TAX.name(),
                    BigDecimal.ZERO, BigDecimal.ZERO,
                    touristTax.amount(), touristTax.amount());
                invoice.addLine(touristTaxLine);
            }
        }

        // Calculer les totaux
        computeTotals(invoice);

        invoice = invoiceRepository.save(invoice);
        log.info("Facture DRAFT generee id={} pour reservation {} (totalTTC={})",
            invoice.getId(), reservation.getId(), invoice.getTotalTtc());

        return InvoiceDto.from(invoice);
    }

    /**
     * Emet une facture : passe de DRAFT a ISSUED et attribue un numero sequentiel.
     */
    @Transactional
    public InvoiceDto issueInvoice(Long invoiceId) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        Invoice invoice = invoiceRepository.findById(invoiceId)
            .orElseThrow(() -> new IllegalArgumentException("Facture introuvable: " + invoiceId));

        if (!invoice.getOrganizationId().equals(orgId)) {
            throw new IllegalArgumentException("Facture introuvable: " + invoiceId);
        }

        if (invoice.getStatus() != InvoiceStatus.DRAFT) {
            throw new IllegalStateException(
                "Seules les factures DRAFT peuvent etre emises (status actuel: " + invoice.getStatus() + ")");
        }

        // Attribuer un numero sequentiel
        String invoiceNumber = numberingService.generateNextNumber();
        invoice.setInvoiceNumber(invoiceNumber);
        invoice.setInvoiceDate(LocalDate.now());
        invoice.setStatus(InvoiceStatus.ISSUED);

        invoice = invoiceRepository.save(invoice);
        log.info("Facture emise: {} (id={}, totalTTC={})",
            invoiceNumber, invoice.getId(), invoice.getTotalTtc());

        return InvoiceDto.from(invoice);
    }

    /**
     * Annule une facture emise en creant un avoir (CREDIT_NOTE).
     */
    @Transactional
    public InvoiceDto cancelInvoice(Long invoiceId, String reason) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        Invoice original = invoiceRepository.findById(invoiceId)
            .orElseThrow(() -> new IllegalArgumentException("Facture introuvable: " + invoiceId));

        if (!original.getOrganizationId().equals(orgId)) {
            throw new IllegalArgumentException("Facture introuvable: " + invoiceId);
        }

        if (original.getStatus() != InvoiceStatus.ISSUED && original.getStatus() != InvoiceStatus.PAID) {
            throw new IllegalStateException(
                "Seules les factures ISSUED/PAID peuvent etre annulees");
        }

        // Marquer l'originale comme annulee
        original.setStatus(InvoiceStatus.CANCELLED);
        invoiceRepository.save(original);

        // Creer l'avoir (montants negatifs)
        Invoice creditNote = new Invoice();
        creditNote.setOrganizationId(orgId);
        creditNote.setInvoiceNumber(numberingService.generateNextNumber());
        creditNote.setInvoiceDate(LocalDate.now());
        creditNote.setCurrency(original.getCurrency());
        creditNote.setCountryCode(original.getCountryCode());
        creditNote.setReservationId(original.getReservationId());
        creditNote.setStatus(InvoiceStatus.CREDIT_NOTE);
        creditNote.setSellerName(original.getSellerName());
        creditNote.setSellerAddress(original.getSellerAddress());
        creditNote.setSellerTaxId(original.getSellerTaxId());
        creditNote.setBuyerName(original.getBuyerName());
        creditNote.setBuyerAddress(original.getBuyerAddress());
        creditNote.setBuyerTaxId(original.getBuyerTaxId());
        creditNote.setLegalMentions("Avoir sur facture " + original.getInvoiceNumber()
            + (reason != null ? " - Motif: " + reason : ""));

        // Lignes inversees
        int lineNum = 1;
        for (InvoiceLine origLine : original.getLines()) {
            InvoiceLine creditLine = createLine(lineNum++,
                "AVOIR - " + origLine.getDescription(),
                origLine.getQuantity().negate(),
                origLine.getUnitPriceHt(),
                origLine.getTaxCategory(),
                origLine.getTaxRate(),
                origLine.getTaxAmount().negate(),
                origLine.getTotalHt().negate(),
                origLine.getTotalTtc().negate());
            creditNote.addLine(creditLine);
        }

        computeTotals(creditNote);
        creditNote = invoiceRepository.save(creditNote);

        log.info("Avoir {} cree pour facture {} (totalTTC={})",
            creditNote.getInvoiceNumber(), original.getInvoiceNumber(), creditNote.getTotalTtc());

        return InvoiceDto.from(creditNote);
    }

    /**
     * Liste les factures de l'organisation courante.
     */
    public List<InvoiceDto> listInvoices() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return invoiceRepository.findByOrganizationId(orgId).stream()
            .map(InvoiceDto::from)
            .toList();
    }

    /**
     * Retourne une facture par son ID.
     */
    public InvoiceDto getInvoice(Long invoiceId) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        Invoice invoice = invoiceRepository.findById(invoiceId)
            .orElseThrow(() -> new IllegalArgumentException("Facture introuvable: " + invoiceId));
        if (!invoice.getOrganizationId().equals(orgId)) {
            throw new IllegalArgumentException("Facture introuvable: " + invoiceId);
        }
        return InvoiceDto.from(invoice);
    }

    // --- Helpers ---

    private InvoiceLine createLine(int lineNumber, String description,
                                    BigDecimal quantity, BigDecimal unitPriceHt,
                                    String taxCategory, BigDecimal taxRate,
                                    BigDecimal taxAmount, BigDecimal totalHt, BigDecimal totalTtc) {
        InvoiceLine line = new InvoiceLine();
        line.setLineNumber(lineNumber);
        line.setDescription(description);
        line.setQuantity(quantity);
        line.setUnitPriceHt(unitPriceHt);
        line.setTaxCategory(taxCategory);
        line.setTaxRate(taxRate);
        line.setTaxAmount(taxAmount);
        line.setTotalHt(totalHt);
        line.setTotalTtc(totalTtc);
        return line;
    }

    private void computeTotals(Invoice invoice) {
        BigDecimal totalHt = BigDecimal.ZERO;
        BigDecimal totalTax = BigDecimal.ZERO;
        BigDecimal totalTtc = BigDecimal.ZERO;

        for (InvoiceLine line : invoice.getLines()) {
            totalHt = totalHt.add(line.getTotalHt());
            totalTax = totalTax.add(line.getTaxAmount());
            totalTtc = totalTtc.add(line.getTotalTtc());
        }

        invoice.setTotalHt(MoneyUtils.round(totalHt));
        invoice.setTotalTax(MoneyUtils.round(totalTax));
        invoice.setTotalTtc(MoneyUtils.round(totalTtc));
    }
}
