package com.clenzy.service;

import com.clenzy.model.InvoiceNumberSequence;
import com.clenzy.repository.InvoiceNumberSequenceRepository;
import com.clenzy.tenant.TenantContext;
import jakarta.persistence.EntityManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

/**
 * Service de numerotation sequentielle des factures.
 *
 * <p>Le compteur est transactionnel :
 * le numero est attribue DANS la transaction de creation/emission de la facture
 * (propagation REQUIRED, jamais REQUIRES_NEW). Si la transaction appelante
 * rollback, la facture ET l'increment du compteur sont annules ensemble —
 * aucun numero n'est consomme a vide.</p>
 *
 * <p>Utilise un verrou pessimiste (SELECT ... FOR UPDATE) sur le compteur de
 * l'organisation : consequence assumee, les emissions de factures d'une meme
 * organisation (et meme annee) sont serialisees jusqu'au commit de la
 * transaction appelante.</p>
 *
 * <p>Les nouvelles émissions utilisent {@code baitly_invoice_issuer_sequences},
 * avec une série par organisation, identité fiscale et année. La séquence
 * historique reste disponible pour les anciens appelants ; aucune pièce passée
 * n'est renumérotée. Ces garanties techniques ne valent pas homologation fiscale.</p>
 */
@Service
public class InvoiceNumberingService {

    private static final Logger log = LoggerFactory.getLogger(InvoiceNumberingService.class);

    private static final String DEFAULT_PREFIX = "FA";

    private final InvoiceNumberSequenceRepository sequenceRepository;
    private final TenantContext tenantContext;
    private final EntityManager entityManager;

    public InvoiceNumberingService(InvoiceNumberSequenceRepository sequenceRepository,
                                    TenantContext tenantContext,
                                    EntityManager entityManager) {
        this.sequenceRepository = sequenceRepository;
        this.tenantContext = tenantContext;
        this.entityManager = entityManager;
    }

    /**
     * Genere le prochain numero de facture pour l'organisation courante.
     * Thread-safe via verrouillage pessimiste en base. Doit etre appele dans
     * la transaction qui persiste la facture (rollback = numero restitue).
     *
     * @return Numero de facture formate (ex: FA2026-00001)
     */
    @Transactional
    public String generateNextNumber() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return generateNextNumber(orgId);
    }

    /**
     * Surcharge sans dependance TenantContext.
     * Utilisee depuis les webhooks Stripe et les consumers Kafka (pas de contexte tenant).
     */
    @Transactional
    public String generateNextNumber(Long orgId) {
        int currentYear = LocalDate.now().getYear();

        InvoiceNumberSequence sequence = sequenceRepository
            .findAndLock(orgId, currentYear)
            .orElseGet(() -> initializeAndLockSequence(orgId, currentYear));

        String number = sequence.nextNumber();
        sequenceRepository.save(sequence);

        log.info("Invoice number generated: {} (org={})", number, orgId);
        return number;
    }

    /** Série distincte par identité légale figée ; les anciennes pièces gardent leur numéro. */
    @Transactional
    public String generateNextNumberFor(com.clenzy.model.Invoice invoice) {
        if(invoice==null || invoice.getOrganizationId()==null)throw new IllegalArgumentException("Organisation de facturation requise");
        BaitlyInvoiceChecks.requireReady(invoice);
        String issuer=invoice.getIssuerKey();
        if(issuer==null) {
            if(invoice.getCountryCode()==null || !invoice.getCountryCode().matches("[A-Z]{2}")
                || invoice.getSellerName()==null || invoice.getSellerName().isBlank()
                || invoice.getSellerAddress()==null || invoice.getSellerAddress().isBlank()
                || invoice.getSellerTaxId()==null || invoice.getSellerTaxId().isBlank())
                throw new IllegalStateException("Identité légale de l'émetteur incomplète : compléter le profil fiscal avant émission");
            String identity=invoice.getCountryCode()+":"+invoice.getSellerTaxId().replaceAll("[\\s.-]", "").toUpperCase(java.util.Locale.ROOT);
            try {issuer=java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(identity.getBytes(java.nio.charset.StandardCharsets.UTF_8)));}
            catch(java.security.NoSuchAlgorithmException e){throw new IllegalStateException(e);}
            invoice.setIssuerKey(issuer);
        }
        int year=LocalDate.now().getYear();
        entityManager.flush();
        entityManager.createNativeQuery("INSERT INTO baitly_invoice_issuer_sequences(organization_id,issuer_key,current_year,last_number) VALUES (:org,:issuer,:year,0) ON CONFLICT DO NOTHING")
            .setParameter("org",invoice.getOrganizationId()).setParameter("issuer",issuer).setParameter("year",year).executeUpdate();
        var row=entityManager.createQuery("from BaitlyInvoiceIssuerSequence where organizationId=:org and issuerKey=:issuer and currentYear=:year",com.clenzy.model.BaitlyInvoiceIssuerSequence.class)
            .setParameter("org",invoice.getOrganizationId()).setParameter("issuer",issuer).setParameter("year",year)
            .setLockMode(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE).getSingleResult();
        entityManager.refresh(row);
        return "FA"+year+"-"+Long.toString(row.getId(),36).toUpperCase(java.util.Locale.ROOT)+"-"+String.format(java.util.Locale.ROOT,"%05d",row.next());
    }

    /** Les flux automatiques conservent un brouillon contrôlé au lieu de perdre le dossier. */
    @Transactional
    public boolean checkAndRecord(com.clenzy.model.Invoice invoice, String actor) {
        var issues=BaitlyInvoiceChecks.issues(invoice);
        if(invoice.getId()!=null) {
            try {
                entityManager.persist(new com.clenzy.model.BaitlyInvoiceReview(invoice.getOrganizationId(),invoice.getId(),
                    BaitlyInvoiceChecks.fingerprint(invoice),BaitlyInvoiceChecks.VERSION,issues.isEmpty()?"CHECKED":"BLOCKED",
                    new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(issues),actor));
            } catch(com.fasterxml.jackson.core.JsonProcessingException e){throw new IllegalStateException(e);}
        }
        return issues.isEmpty();
    }

    /**
     * Initialise le compteur de l'organisation pour l'annee via un upsert
     * {@code ON CONFLICT DO NOTHING} (ferme la course de creation entre deux
     * transactions concurrentes en propagation REQUIRED), puis le verrouille.
     */
    private InvoiceNumberSequence initializeAndLockSequence(Long orgId, int year) {
        entityManager.createNativeQuery(
                "INSERT INTO invoice_number_sequences (organization_id, prefix, current_year, last_number) "
                + "VALUES (:orgId, :prefix, :year, 0) "
                + "ON CONFLICT (organization_id, current_year) DO NOTHING")
            .setParameter("orgId", orgId)
            .setParameter("prefix", DEFAULT_PREFIX)
            .setParameter("year", year)
            .executeUpdate();

        return sequenceRepository.findAndLock(orgId, year)
            .orElseThrow(() -> new IllegalStateException(
                "Sequence de numerotation introuvable apres initialisation (org=" + orgId + ")"));
    }
}
