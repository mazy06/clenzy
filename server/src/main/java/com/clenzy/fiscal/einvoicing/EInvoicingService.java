package com.clenzy.fiscal.einvoicing;

import com.clenzy.model.Country;
import com.clenzy.model.EInvoiceSubmission;
import com.clenzy.model.Invoice;
import com.clenzy.repository.EInvoiceSubmissionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * Orchestrateur d'e-invoicing (CLZ-P0-04) : resout le provider du pays, declenche
 * clearance/reporting selon le mode, et persiste le suivi {@link EInvoiceSubmission}.
 *
 * <p><b>Idempotent</b> par couple {@code (organizationId, invoiceNumber)} — la contrainte
 * unique DB est le garde-fou (audit #8). <b>A invoquer APRES COMMIT</b> de la facture
 * (les providers reels appellent des autorites fiscales : hors transaction, audit #2).</p>
 *
 * <p>Tant que seuls les providers reels (Factur-X/DGI/ZATCA) ne sont pas livres, le pays
 * retombe sur NoOp (mode NONE) → suivi {@code NOT_REQUIRED}, aucun appel externe.</p>
 */
@Service
public class EInvoicingService {

    private static final Logger log = LoggerFactory.getLogger(EInvoicingService.class);

    private final EInvoicingProviderRegistry registry;
    private final EInvoiceSubmissionRepository submissionRepository;

    public EInvoicingService(EInvoicingProviderRegistry registry,
                             EInvoiceSubmissionRepository submissionRepository) {
        this.registry = registry;
        this.submissionRepository = submissionRepository;
    }

    @Transactional
    public EInvoiceSubmission process(Invoice invoice, Country country) {
        Long orgId = invoice.getOrganizationId();
        String invoiceNumber = invoice.getInvoiceNumber();

        Optional<EInvoiceSubmission> existing =
                submissionRepository.findByOrganizationIdAndInvoiceNumber(orgId, invoiceNumber);
        if (existing.isPresent()) {
            return existing.get();
        }

        EInvoicingProvider provider = registry.resolve(country);
        EInvoicingMode mode = provider.mode();
        EInvoiceResult result = switch (mode) {
            case NONE -> EInvoiceResult.notRequired();
            case DGI_CLEARANCE, ZATCA_CLEARANCE -> provider.clear(invoice);
            case FACTURX_PDP, ZATCA_REPORTING -> provider.report(invoice);
        };

        EInvoiceSubmission submission = new EInvoiceSubmission();
        submission.setOrganizationId(orgId);
        submission.setInvoiceNumber(invoiceNumber);
        submission.setCountryCode(country != null ? country.getCountryCode() : null);
        submission.setProviderCode(provider.providerCode());
        submission.setMode(mode);
        submission.setStatus(result.status());
        submission.setExternalRef(result.externalRef());
        submission.setMessage(result.message());

        EInvoiceSubmission saved = submissionRepository.save(submission);
        log.info("E-invoicing: facture {} (org {}) -> provider={} mode={} statut={}",
                invoiceNumber, orgId, provider.providerCode(), mode, result.status());
        return saved;
    }
}
