package com.clenzy.service;

import com.clenzy.dto.GenerateInvoiceRequest;
import com.clenzy.dto.InvoiceDto;
import com.clenzy.fiscal.*;
import com.clenzy.model.*;
import com.clenzy.repository.FiscalProfileRepository;
import com.clenzy.repository.InvoiceRepository;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.tenant.TenantContext;
import jakarta.persistence.EntityManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

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
    private final InterventionRepository interventionRepository;
    private final FiscalProfileRepository fiscalProfileRepository;
    private final FiscalEngine fiscalEngine;
    private final TouristTaxService touristTaxService;
    private final InvoiceNumberingService numberingService;
    private final TenantContext tenantContext;
    private final EntityManager entityManager;

    public InvoiceGeneratorService(InvoiceRepository invoiceRepository,
                                    ReservationRepository reservationRepository,
                                    InterventionRepository interventionRepository,
                                    FiscalProfileRepository fiscalProfileRepository,
                                    FiscalEngine fiscalEngine,
                                    TouristTaxService touristTaxService,
                                    InvoiceNumberingService numberingService,
                                    TenantContext tenantContext,
                                    EntityManager entityManager) {
        this.invoiceRepository = invoiceRepository;
        this.reservationRepository = reservationRepository;
        this.interventionRepository = interventionRepository;
        this.fiscalProfileRepository = fiscalProfileRepository;
        this.fiscalEngine = fiscalEngine;
        this.touristTaxService = touristTaxService;
        this.numberingService = numberingService;
        this.tenantContext = tenantContext;
        this.entityManager = entityManager;
    }

    /**
     * Genere une facture DRAFT a partir d'une reservation.
     * La facture n'est pas encore numerotee (pas de numero legal).
     */
    @Transactional
    public InvoiceDto generateFromReservation(GenerateInvoiceRequest request) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        String countryCode = tenantContext.getCountryCode();

        // Verifier qu'il n'y a pas deja une facture de sejour ACTIVE pour cette reservation
        findActiveGuestInvoice(request.reservationId())
            .ifPresent(existing -> {
                throw new IllegalStateException(
                    "Une facture existe deja pour la reservation " + request.reservationId()
                    + " (facture " + existing.getInvoiceNumber() + ")");
            });

        Reservation reservation = reservationRepository.findById(request.reservationId())
            .orElseThrow(() -> new IllegalArgumentException(
                "Reservation introuvable: " + request.reservationId()));

        // Utiliser la devise de la reservation (multi-devise),
        // fallback sur la devise par defaut de l'organisation
        String currency = reservation.getCurrency() != null
            ? reservation.getCurrency()
            : tenantContext.getDefaultCurrency();

        // Charger le profil fiscal pour les infos vendeur
        FiscalProfile fiscalProfile = fiscalProfileRepository.findByOrganizationId(orgId)
            .orElseThrow(() -> new IllegalStateException(
                "Profil fiscal non configure pour l'organisation " + orgId));

        // Construction commune (en-tete + lignes hebergement/menage) : chemin fiscal unique
        Invoice invoice = buildReservationDraft(reservation, orgId, fiscalProfile,
            countryCode, currency,
            request.buyerName() != null ? request.buyerName() : reservation.getGuestName(),
            request.buyerAddress(), request.buyerTaxId());

        // Ligne additionnelle du flux manuel : taxe de sejour (pas de TVA)
        addTouristTaxLine(invoice, reservation, countryCode, request.touristTaxRatePerPerson());

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

    // --- Auto-generation methods (sans TenantContext, pour webhooks) ---

    /**
     * Genere une facture DRAFT pour une reservation.
     * Surcharge sans dependance TenantContext (utilisee depuis webhooks Stripe).
     *
     * <p>T-SOLID-8 : la construction (en-tete, dates, vendeur, lignes TTC→HT) passe
     * par le meme chemin {@link #buildReservationDraft} que le flux manuel — seules
     * les resolutions de contexte (pays/devise depuis FiscalProfile au lieu de
     * TenantContext) different.</p>
     */
    @Transactional
    public Invoice generateFromReservation(Reservation reservation, Long orgId) {
        FiscalProfile fiscalProfile = fiscalProfileRepository.findByOrganizationId(orgId)
            .orElseThrow(() -> new IllegalStateException(
                "Profil fiscal non configure pour l'organisation " + orgId));

        String countryCode = fiscalProfile.getCountryCode() != null
            ? fiscalProfile.getCountryCode() : "FR";
        String currency = reservation.getCurrency() != null
            ? reservation.getCurrency()
            : (fiscalProfile.getDefaultCurrency() != null ? fiscalProfile.getDefaultCurrency() : "EUR");

        Invoice invoice = buildReservationDraft(reservation, orgId, fiscalProfile,
            countryCode, currency,
            reservation.getGuestName() != null ? reservation.getGuestName() : "Client",
            null, null);

        computeTotals(invoice);
        invoice = invoiceRepository.save(invoice);

        log.info("Facture DRAFT auto-generee id={} pour reservation {} (totalTTC={})",
            invoice.getId(), reservation.getId(), invoice.getTotalTtc());
        return invoice;
    }

    /**
     * Genere une facture DRAFT de commission de gestion (conciergerie → propriétaire).
     *
     * <p>Vendeur = profil fiscal de l'organisation (la conciergerie) ; acheteur = propriétaire
     * du logement. La base de commission est le montant brut de la réservation, ou le net des
     * frais OTA si {@code commissionBase = NET_OF_OTA_FEE} et que les frais OTA sont connus.
     * La commission est exprimée HT, la TVA standard est ajoutée par le moteur fiscal.</p>
     */
    @Transactional
    public Invoice generateCommissionFromReservation(Reservation reservation,
                                                     ManagementContract contract, Long orgId) {
        FiscalProfile fiscalProfile = fiscalProfileRepository.findByOrganizationId(orgId)
            .orElseThrow(() -> new IllegalStateException(
                "Profil fiscal non configure pour l'organisation " + orgId));

        String countryCode = fiscalProfile.getCountryCode() != null
            ? fiscalProfile.getCountryCode() : "FR";
        String currency = reservation.getCurrency() != null
            ? reservation.getCurrency()
            : (fiscalProfile.getDefaultCurrency() != null ? fiscalProfile.getDefaultCurrency() : "EUR");

        // Base de commission : brut, ou net des frais OTA si connus (sinon repli sur le brut).
        BigDecimal base = reservation.getTotalPrice() != null ? reservation.getTotalPrice() : BigDecimal.ZERO;
        if (contract.getCommissionBase() == ManagementContract.CommissionBase.NET_OF_OTA_FEE
                && reservation.getOtaFeeAmount() != null) {
            base = base.subtract(reservation.getOtaFeeAmount()).max(BigDecimal.ZERO);
        }

        BigDecimal rate = contract.getCommissionRate() != null ? contract.getCommissionRate() : BigDecimal.ZERO;
        BigDecimal commissionHt = base.multiply(rate).setScale(2, RoundingMode.HALF_UP);

        Invoice invoice = new Invoice();
        invoice.setOrganizationId(orgId);
        invoice.setInvoiceNumber("DRAFT");
        invoice.setInvoiceDate(LocalDate.now());
        invoice.setDueDate(LocalDate.now().plusDays(30));
        invoice.setCurrency(currency);
        invoice.setCountryCode(countryCode);
        invoice.setReservationId(reservation.getId());
        invoice.setInvoiceType(InvoiceType.COMMISSION);
        invoice.setStatus(InvoiceStatus.DRAFT);

        // Vendeur = conciergerie (organisation)
        invoice.setSellerName(fiscalProfile.getLegalEntityName());
        invoice.setSellerAddress(fiscalProfile.getLegalAddress());
        invoice.setSellerTaxId(fiscalProfile.getVatNumber() != null
            ? fiscalProfile.getVatNumber() : fiscalProfile.getTaxIdNumber());

        // Acheteur = propriétaire du logement
        User owner = reservation.getProperty() != null ? reservation.getProperty().getOwner() : null;
        invoice.setBuyerName(resolveOwnerName(owner));
        invoice.setBuyerAddress(resolveOwnerAddress(owner));

        invoice.setLegalMentions(fiscalProfile.getLegalMentions());

        // Aucune commission à facturer (base ou taux nul) : retourner sans persister (pas d'orphelin).
        if (commissionHt.compareTo(BigDecimal.ZERO) <= 0) {
            invoice.setTotalHt(BigDecimal.ZERO);
            invoice.setTotalTax(BigDecimal.ZERO);
            invoice.setTotalTtc(BigDecimal.ZERO);
            return invoice;
        }

        // Ligne unique : commission de gestion (prestation de service → TVA standard)
        int ratePct = rate.multiply(BigDecimal.valueOf(100)).setScale(0, RoundingMode.HALF_UP).intValue();
        LocalDate taxDate = reservation.getCheckOut() != null ? reservation.getCheckOut() : LocalDate.now();
        TaxResult commissionTax = fiscalEngine.calculateTax(
            countryCode,
            new TaxableItem(commissionHt, TaxCategory.STANDARD.name(), "Commission de gestion"),
            taxDate
        );
        invoice.addLine(createLine(1,
            String.format("Commission de gestion (%d%%) - reservation #%d, sejour du %s au %s",
                ratePct, reservation.getId(), reservation.getCheckIn(), reservation.getCheckOut()),
            BigDecimal.ONE, commissionHt,
            TaxCategory.STANDARD.name(),
            commissionTax.taxRate(), commissionTax.taxAmount(),
            commissionTax.amountHT(), commissionTax.amountTTC()));

        computeTotals(invoice);
        invoice = invoiceRepository.save(invoice);

        log.info("Facture commission DRAFT id={} pour reservation {} (base={} commissionHT={} totalTTC={})",
            invoice.getId(), reservation.getId(), base, commissionHt, invoice.getTotalTtc());
        return invoice;
    }

    private String resolveOwnerName(User owner) {
        if (owner == null) return "Proprietaire";
        if (owner.getCompanyName() != null && !owner.getCompanyName().isBlank()) {
            return owner.getCompanyName();
        }
        String full = ((owner.getFirstName() != null ? owner.getFirstName() : "") + " "
                     + (owner.getLastName() != null ? owner.getLastName() : "")).trim();
        if (!full.isBlank()) return full;
        return owner.getEmail() != null ? owner.getEmail() : "Proprietaire";
    }

    private String resolveOwnerAddress(User owner) {
        if (owner == null) return null;
        String postal = owner.getPostalCode() != null ? owner.getPostalCode() : "";
        String city = owner.getCity() != null ? owner.getCity() : "";
        String addr = (postal + " " + city).trim();
        return addr.isBlank() ? null : addr;
    }

    /**
     * Genere une facture DRAFT pour une intervention.
     * Sans dependance TenantContext (utilisee depuis webhooks Stripe).
     */
    @Transactional
    public Invoice generateFromIntervention(Intervention intervention, Long orgId) {
        FiscalProfile fiscalProfile = fiscalProfileRepository.findByOrganizationId(orgId)
            .orElseThrow(() -> new IllegalStateException(
                "Profil fiscal non configure pour l'organisation " + orgId));

        String countryCode = fiscalProfile.getCountryCode() != null
            ? fiscalProfile.getCountryCode() : "FR";
        String currency = fiscalProfile.getDefaultCurrency() != null
            ? fiscalProfile.getDefaultCurrency() : "EUR";

        Invoice invoice = new Invoice();
        invoice.setOrganizationId(orgId);
        invoice.setInvoiceNumber("DRAFT");
        invoice.setInvoiceDate(LocalDate.now());
        invoice.setDueDate(LocalDate.now().plusDays(30));
        invoice.setCurrency(currency);
        invoice.setCountryCode(countryCode);
        invoice.setInterventionId(intervention.getId());
        invoice.setStatus(InvoiceStatus.DRAFT);

        // Infos vendeur
        invoice.setSellerName(fiscalProfile.getLegalEntityName());
        invoice.setSellerAddress(fiscalProfile.getLegalAddress());
        invoice.setSellerTaxId(fiscalProfile.getVatNumber() != null
            ? fiscalProfile.getVatNumber() : fiscalProfile.getTaxIdNumber());

        // Infos acheteur (proprietaire du bien)
        String buyerName = "Client";
        if (intervention.getProperty() != null && intervention.getProperty().getOwner() != null) {
            var owner = intervention.getProperty().getOwner();
            buyerName = (owner.getFirstName() != null ? owner.getFirstName() : "")
                + " " + (owner.getLastName() != null ? owner.getLastName() : "");
            buyerName = buyerName.trim();
            if (buyerName.isEmpty()) buyerName = "Client";
        }
        invoice.setBuyerName(buyerName);

        // Mentions legales
        invoice.setLegalMentions(fiscalProfile.getLegalMentions());

        // Ligne unique : intervention
        BigDecimal amount = intervention.getEstimatedCost() != null
            ? intervention.getEstimatedCost() : BigDecimal.ZERO;

        if (amount.compareTo(BigDecimal.ZERO) > 0) {
            TaxResult tax = fiscalEngine.calculateTax(
                countryCode,
                new TaxableItem(amount, TaxCategory.STANDARD.name(),
                    "Intervention: " + intervention.getTitle()),
                LocalDate.now()
            );

            invoice.addLine(createLine(1,
                "Intervention: " + intervention.getTitle(),
                BigDecimal.ONE, amount,
                TaxCategory.STANDARD.name(),
                tax.taxRate(), tax.taxAmount(),
                tax.amountHT(), tax.amountTTC()));
        }

        computeTotals(invoice);
        invoice = invoiceRepository.save(invoice);

        log.info("Facture DRAFT auto-generee id={} pour intervention {} (totalTTC={})",
            invoice.getId(), intervention.getId(), invoice.getTotalTtc());
        return invoice;
    }

    /**
     * Genere un duplicata d'une facture existante.
     * Le duplicata porte un numero propre avec suffixe -DUP et reference l'original.
     */
    @Transactional
    public InvoiceDto generateDuplicate(Long invoiceId) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        Invoice original = invoiceRepository.findById(invoiceId)
            .orElseThrow(() -> new IllegalArgumentException("Facture introuvable: " + invoiceId));

        if (!original.getOrganizationId().equals(orgId)) {
            throw new IllegalArgumentException("Facture introuvable: " + invoiceId);
        }

        Invoice duplicate = new Invoice();
        duplicate.setOrganizationId(orgId);
        duplicate.setInvoiceDate(LocalDate.now());
        duplicate.setDueDate(original.getDueDate());
        duplicate.setCurrency(original.getCurrency());
        duplicate.setCountryCode(original.getCountryCode());
        duplicate.setReservationId(original.getReservationId());
        duplicate.setInterventionId(original.getInterventionId());
        duplicate.setPayoutId(original.getPayoutId());
        duplicate.setDocumentGenerationId(original.getDocumentGenerationId());
        duplicate.setDuplicateOfId(original.getId());
        duplicate.setStatus(InvoiceStatus.ISSUED);

        // Numero = original + "-DUP-{compteur}"
        List<Invoice> existingDups = invoiceRepository.findByDuplicateOfId(original.getId());
        int dupSeq = existingDups.size() + 1;
        duplicate.setInvoiceNumber(original.getInvoiceNumber() + "-DUP-" + dupSeq);

        // Copier infos vendeur/acheteur
        duplicate.setSellerName(original.getSellerName());
        duplicate.setSellerAddress(original.getSellerAddress());
        duplicate.setSellerTaxId(original.getSellerTaxId());
        duplicate.setBuyerName(original.getBuyerName());
        duplicate.setBuyerAddress(original.getBuyerAddress());
        duplicate.setBuyerTaxId(original.getBuyerTaxId());
        duplicate.setLegalMentions("DUPLICATA de la facture " + original.getInvoiceNumber());

        // Copier les lignes
        int lineNum = 1;
        for (InvoiceLine origLine : original.getLines()) {
            InvoiceLine dupLine = createLine(lineNum++,
                origLine.getDescription(),
                origLine.getQuantity(),
                origLine.getUnitPriceHt(),
                origLine.getTaxCategory(),
                origLine.getTaxRate(),
                origLine.getTaxAmount(),
                origLine.getTotalHt(),
                origLine.getTotalTtc());
            duplicate.addLine(dupLine);
        }

        computeTotals(duplicate);

        // Copier le statut de paiement si l'original est paye
        if (original.getStatus() == InvoiceStatus.PAID) {
            duplicate.setPaymentMethod(original.getPaymentMethod());
            duplicate.setPaidAt(original.getPaidAt());
        }

        duplicate = invoiceRepository.save(duplicate);
        log.info("Duplicata {} cree pour facture {} (totalTTC={})",
            duplicate.getInvoiceNumber(), original.getInvoiceNumber(), duplicate.getTotalTtc());

        return InvoiceDto.from(duplicate);
    }

    // --- Bridge DocumentGeneration → Invoice ---

    /**
     * Cree une facture ISSUED a partir d'une DocumentGeneration FACTURE.
     * Idempotent : si une Invoice existe deja pour cette reference, elle est simplement liee.
     *
     * <p>Numerotation : l'entite Invoice est numerotee par l'UNIQUE sequence
     * {@link InvoiceNumberingService} ({@code invoice_number_sequences}), dans la meme
     * transaction que l'insertion. Le numero legal du document PDF
     * ({@code documentLegalNumber}, sequence {@code document_number_sequences}) n'est
     * plus reutilise pour la facture : deux sequences independantes sur
     * {@code invoices.invoice_number} produisaient des doublons et des numeros
     * non sequentiels (non-conformite NF). La course Kafka/webhook est fermee par
     * les index uniques partiels (migration 0226) : le flux perdant rollback
     * entierement, numero compris.</p>
     *
     * @param refType        RESERVATION ou INTERVENTION
     * @param referenceId    ID de la reservation ou intervention
     * @param orgId          ID de l'organisation
     * @param documentLegalNumber  Numero legal du document PDF (conserve pour trace uniquement)
     * @param documentGenerationId  ID de la DocumentGeneration a lier
     * @return l'Invoice creee ou existante
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Invoice createIssuedFromDocumentGeneration(ReferenceType refType, Long referenceId,
                                                       Long orgId, String documentLegalNumber,
                                                       Long documentGenerationId) {
        // Idempotence : verifier si une Invoice existe deja
        Optional<Invoice> existing = findExistingInvoice(refType, referenceId);
        if (existing.isPresent()) {
            return linkDocumentGeneration(existing.get(), documentGenerationId);
        }

        Invoice invoice = createDraftForReference(refType, referenceId, orgId);

        // Numerotation par l'unique sequence Invoice, dans la transaction courante :
        // un rollback annule a la fois la facture et l'increment (pas de trou).
        String invoiceNumber = numberingService.generateNextNumber(orgId);
        invoice.setInvoiceNumber(invoiceNumber);
        invoice.setStatus(InvoiceStatus.ISSUED);
        invoice.setDocumentGenerationId(documentGenerationId);
        invoice = invoiceRepository.save(invoice);

        log.info("Invoice ISSUED {} creee depuis DocumentGeneration #{} ({} {}, numero document {})",
            invoiceNumber, documentGenerationId, refType, referenceId, documentLegalNumber);
        return invoice;
    }

    private Invoice createDraftForReference(ReferenceType refType, Long referenceId, Long orgId) {
        if (refType == ReferenceType.RESERVATION) {
            Reservation reservation = reservationRepository.findById(referenceId)
                .orElseThrow(() -> new IllegalArgumentException(
                    "Reservation introuvable: " + referenceId));
            return generateFromReservation(reservation, orgId);
        }
        if (refType == ReferenceType.INTERVENTION) {
            Intervention intervention = interventionRepository.findById(referenceId)
                .orElseThrow(() -> new IllegalArgumentException(
                    "Intervention introuvable: " + referenceId));
            return generateFromIntervention(intervention, orgId);
        }
        throw new IllegalArgumentException(
            "Type de reference non supporte pour la facturation: " + refType);
    }

    private Optional<Invoice> findExistingInvoice(ReferenceType refType, Long referenceId) {
        if (refType == ReferenceType.RESERVATION) {
            return findActiveGuestInvoice(referenceId);
        } else if (refType == ReferenceType.INTERVENTION) {
            return findActiveInterventionInvoice(referenceId);
        }
        return Optional.empty();
    }

    /**
     * Facture de sejour ACTIVE d'une reservation (reliquat A2 / Z3-BUGS).
     *
     * <p>{@code findByReservationIdAndInvoiceType} retourne un {@code Optional}
     * alors que plusieurs lignes GUEST peuvent coexister (facture annulee +
     * re-emission, avoirs, doublons historiques annules par la migration 0226) :
     * un appel direct leverait {@code IncorrectResultSizeDataAccessException}.
     * On filtre donc cote service sur la meme semantique que l'index unique
     * partiel {@code uq_invoices_reservation_type_active} (migration 0226) :
     * type GUEST, non annulee, pas un avoir, pas un duplicata.</p>
     */
    private Optional<Invoice> findActiveGuestInvoice(Long reservationId) {
        return invoiceRepository.findAllByReservationId(reservationId).stream()
            .filter(invoice -> invoice.getInvoiceType() == InvoiceType.GUEST)
            .filter(invoice -> invoice.getDuplicateOfId() == null)
            .filter(invoice -> invoice.getStatus() != InvoiceStatus.CANCELLED
                && invoice.getStatus() != InvoiceStatus.CREDIT_NOTE)
            .min(Comparator.comparing(Invoice::getId,
                Comparator.nullsLast(Comparator.naturalOrder())));
    }

    /**
     * Facture ACTIVE d'une intervention (reliquat A2 / T-SOLID-8).
     *
     * <p>{@code InvoiceRepository.findByInterventionId} retourne un {@code Optional}
     * alors que plusieurs lignes peuvent coexister pour une meme intervention
     * (facture annulee + re-emission, duplicata « -DUP » qui copie
     * {@code interventionId}) : un appel direct leverait
     * {@code IncorrectResultSizeDataAccessException}. Le repository etant fige
     * (pas de {@code findAllByInterventionId}), la liste est chargee via JPQL
     * puis filtree cote service sur la meme semantique que l'index unique
     * partiel {@code uq_invoices_intervention_active} (migration 0226) :
     * non annulee, pas un avoir, pas un duplicata — symetrique de
     * {@link #findActiveGuestInvoice(Long)}.</p>
     */
    private Optional<Invoice> findActiveInterventionInvoice(Long interventionId) {
        List<Invoice> candidates = entityManager.createQuery(
                "SELECT i FROM Invoice i WHERE i.interventionId = :interventionId",
                Invoice.class)
            .setParameter("interventionId", interventionId)
            .getResultList();
        return candidates.stream()
            .filter(invoice -> invoice.getDuplicateOfId() == null)
            .filter(invoice -> invoice.getStatus() != InvoiceStatus.CANCELLED
                && invoice.getStatus() != InvoiceStatus.CREDIT_NOTE)
            .min(Comparator.comparing(Invoice::getId,
                Comparator.nullsLast(Comparator.naturalOrder())));
    }

    private Invoice linkDocumentGeneration(Invoice invoice, Long documentGenerationId) {
        if (invoice.getDocumentGenerationId() == null) {
            invoice.setDocumentGenerationId(documentGenerationId);
            invoice = invoiceRepository.save(invoice);
            log.info("Invoice {} liee a DocumentGeneration #{}", invoice.getInvoiceNumber(), documentGenerationId);
        }
        return invoice;
    }

    // --- Construction commune des factures de sejour (T-SOLID-8) ---

    /**
     * Construit la facture de sejour DRAFT (en-tete + lignes hebergement/menage).
     *
     * <p>Chemin de construction UNIQUE pour le flux manuel
     * ({@link #generateFromReservation(GenerateInvoiceRequest)}) et le flux webhook
     * ({@link #generateFromReservation(Reservation, Long)}) : les regles a enjeu
     * fiscal (dates, echeance a 30 jours, infos vendeur, decomposition TTC→HT des
     * montants encaisses) ne peuvent plus diverger entre les deux flux. Seules les
     * resolutions de contexte (pays, devise, acheteur) restent a la charge des
     * appelants. La facture n'est NI totalisee NI persistee ici.</p>
     */
    private Invoice buildReservationDraft(Reservation reservation, Long orgId,
                                          FiscalProfile fiscalProfile,
                                          String countryCode, String currency,
                                          String buyerName, String buyerAddress,
                                          String buyerTaxId) {
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

        // Infos acheteur (resolues par l'appelant)
        invoice.setBuyerName(buyerName);
        invoice.setBuyerAddress(buyerAddress);
        invoice.setBuyerTaxId(buyerTaxId);

        // Mentions legales
        invoice.setLegalMentions(fiscalProfile.getLegalMentions());

        addStayLines(invoice, reservation, countryCode);
        return invoice;
    }

    /**
     * Lignes hebergement + menage : decomposition du TTC encaisse en HT + TVA
     * (les montants de la reservation sont ceux payes par le guest).
     */
    private void addStayLines(Invoice invoice, Reservation reservation, String countryCode) {
        int lineNum = 1;

        // Ligne 1: Hebergement (TVA reduite ACCOMMODATION)
        BigDecimal roomRevenue = reservation.getRoomRevenue() != null
            ? reservation.getRoomRevenue()
            : reservation.getTotalPrice();

        if (roomRevenue != null && roomRevenue.compareTo(BigDecimal.ZERO) > 0) {
            long nights = stayNights(reservation);

            // Le montant de la reservation est le montant ENCAISSE aupres du guest (TTC) :
            // on en deduit HT et TVA, et non l'inverse (la facture doit afficher ce qui a ete paye).
            TaxResult accommodationTax = decomposeTtcAmount(
                countryCode, roomRevenue, TaxCategory.ACCOMMODATION,
                "Hebergement " + reservation.getCheckIn() + " - " + reservation.getCheckOut(),
                reservation.getCheckIn());

            invoice.addLine(createLine(lineNum++,
                String.format("Hebergement du %s au %s (%d nuits)",
                    reservation.getCheckIn(), reservation.getCheckOut(), nights),
                BigDecimal.ONE, accommodationTax.amountHT(),
                TaxCategory.ACCOMMODATION.name(),
                accommodationTax.taxRate(), accommodationTax.taxAmount(),
                accommodationTax.amountHT(), accommodationTax.amountTTC()));
        }

        // Ligne 2: Frais de menage (TVA standard CLEANING) — montant encaisse = TTC
        BigDecimal cleaningFee = reservation.getCleaningFee();
        if (cleaningFee != null && cleaningFee.compareTo(BigDecimal.ZERO) > 0) {
            TaxResult cleaningTax = decomposeTtcAmount(
                countryCode, cleaningFee, TaxCategory.CLEANING,
                "Frais de menage", reservation.getCheckIn());

            invoice.addLine(createLine(lineNum,
                "Frais de menage",
                BigDecimal.ONE, cleaningTax.amountHT(),
                TaxCategory.CLEANING.name(),
                cleaningTax.taxRate(), cleaningTax.taxAmount(),
                cleaningTax.amountHT(), cleaningTax.amountTTC()));
        }
    }

    /**
     * Ligne taxe de sejour (pas de TVA) — flux manuel uniquement.
     */
    private void addTouristTaxLine(Invoice invoice, Reservation reservation,
                                   String countryCode, BigDecimal touristTaxRatePerPerson) {
        // Source PRIMAIRE : le barème par bien/org (tourist_tax_configs), qui alimente
        // deja le booking engine — barème fixe/pourcentage plafonné, surtaxes,
        // exoneration des mineurs. Source unique de la taxe de sejour quand elle existe.
        if (addTouristTaxLineFromConfig(invoice, reservation)) {
            return;
        }

        // Repli : taux manuel par personne (flux de facturation manuel) via le
        // FiscalEngine — couvre notamment les pays a taux % (Arabie Saoudite) sans
        // barème par bien configure.
        if (touristTaxRatePerPerson == null
                || touristTaxRatePerPerson.compareTo(BigDecimal.ZERO) <= 0) {
            return;
        }

        int guests = reservation.getGuestCount() != null ? reservation.getGuestCount() : 1;
        long nights = stayNights(reservation);

        TouristTaxResult touristTax = fiscalEngine.calculateTouristTax(
            countryCode,
            TouristTaxInput.perPerson(BigDecimal.ZERO, guests, (int) nights, 0,
                touristTaxRatePerPerson)
        );

        if (touristTax.amount().compareTo(BigDecimal.ZERO) <= 0) {
            return;
        }

        invoice.addLine(createLine(invoice.getLines().size() + 1,
            touristTax.description(),
            BigDecimal.ONE, touristTax.amount(),
            TaxCategory.TOURIST_TAX.name(),
            BigDecimal.ZERO, BigDecimal.ZERO,
            touristTax.amount(), touristTax.amount()));
    }

    /**
     * Ajoute la ligne de taxe de sejour depuis le barème par bien si un barème
     * s'applique et produit un montant &gt; 0. Retourne true si une ligne a ete
     * ajoutee (la source par bien fait autorite et court-circuite le repli).
     */
    private boolean addTouristTaxLineFromConfig(Invoice invoice, Reservation reservation) {
        var lineOpt = touristTaxService.computeForReservation(reservation);
        if (lineOpt.isEmpty()) {
            return false;
        }
        BigDecimal amount = lineOpt.get().taxAmount();
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            return false;
        }
        invoice.addLine(createLine(invoice.getLines().size() + 1,
            "Taxe de sejour",
            BigDecimal.ONE, amount,
            TaxCategory.TOURIST_TAX.name(),
            BigDecimal.ZERO, BigDecimal.ZERO,
            amount, amount));
        return true;
    }

    private long stayNights(Reservation reservation) {
        long nights = ChronoUnit.DAYS.between(reservation.getCheckIn(), reservation.getCheckOut());
        return nights <= 0 ? 1 : nights;
    }

    // --- Helpers ---

    /**
     * Decompose un montant TTC encaisse en HT + TVA.
     *
     * <p>Les montants des reservations (roomRevenue, cleaningFee, totalPrice) sont les
     * montants effectivement payes par le guest (Stripe encaisse totalPrice). La facture
     * doit donc afficher totalTtc == montant encaisse : HT = TTC / (1 + taux) puis
     * TVA = TTC - HT — et non une TVA ajoutee par-dessus le montant deja paye.
     * Le moteur fiscal ne sert ici qu'a resoudre le taux et le nom de la taxe.</p>
     */
    private TaxResult decomposeTtcAmount(String countryCode, BigDecimal amountTtc,
                                         TaxCategory category, String description,
                                         LocalDate taxDate) {
        TaxResult rateLookup = fiscalEngine.calculateTax(
            countryCode,
            new TaxableItem(amountTtc, category.name(), description),
            taxDate);
        BigDecimal taxRate = rateLookup.taxRate() != null ? rateLookup.taxRate() : BigDecimal.ZERO;

        BigDecimal roundedTtc = MoneyUtils.round(amountTtc);
        BigDecimal amountHt = MoneyUtils.calculateHT(roundedTtc, taxRate);
        BigDecimal taxAmount = roundedTtc.subtract(amountHt);
        return new TaxResult(amountHt, taxAmount, roundedTtc, taxRate,
            rateLookup.taxName(), category.name());
    }

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
