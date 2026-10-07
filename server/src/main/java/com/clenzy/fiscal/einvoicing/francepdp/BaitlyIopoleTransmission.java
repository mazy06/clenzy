package com.clenzy.fiscal.einvoicing.francepdp;

import com.clenzy.fiscal.einvoicing.EInvoiceResult;
import com.clenzy.fiscal.einvoicing.EInvoiceStatus;
import com.clenzy.model.Invoice;
import com.clenzy.model.InvoiceStatus;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/** Un dépôt est PENDING. Seule une lecture canonique prouve la transmission. */
@Component
@Primary
public class BaitlyIopoleTransmission implements PdpTransmissionClient {
    private static final Set<String> DELIVERED = Set.of("RECEIVED", "MADE_AVAILABLE", "IN_HAND", "APPROVED", "COMPLETED");
    private static final Set<String> REJECTED = Set.of("REJECTED", "UNACCEPTABLE", "REFUSED");
    private final BaitlyIopoleProperties config;
    private final BaitlyIopoleApi api;
    private final BaitlyIopoleInbox inbox;

    public BaitlyIopoleTransmission(BaitlyIopoleProperties config, BaitlyIopoleApi api, BaitlyIopoleInbox inbox) { this.config = config; this.api = api; this.inbox = inbox; }
    @Override public boolean configured() {
        return config.ready() && config.getCustomers().values().stream().anyMatch(c -> c != null
            && c.getCustomerId() != null && c.isPullModeConfirmed() && BaitlyIopoleProperties.present(c.getSellerTaxId()));
    }
    @Override public boolean supportsReconciliation() { return true; }

    @Override public String readinessIssue(Invoice invoice, byte[] cii) {
        String issue = scopeIssue(invoice);
        if (issue != null) return issue;
        // Une référence XML libre ne prouve pas le lien avec la facture locale d'origine.
        if (invoice.getOriginalInvoiceId() != null || invoice.getStatus() == InvoiceStatus.CREDIT_NOTE) {
            return "Transmission de l'avoir en attente de vérification du lien avec la facture d'origine";
        }
        return BaitlyCiiPreflight.issue(invoice, cii);
    }

    private String scopeIssue(Invoice invoice) {
        if (!configured()) return "Iopole non configuré : accès PDP à compléter";
        var customer = config.getCustomers().get(invoice.getOrganizationId());
        if (!invoice.isImmutable() || !"FR".equals(invoice.getCountryCode()) || customer == null || customer.getCustomerId() == null || !customer.isPullModeConfirmed()
                || !BaitlyIopoleProperties.present(customer.getSellerTaxId()) || !customer.getSellerTaxId().equals(invoice.getSellerTaxId())) {
            return "Société émettrice et mandat Iopole à vérifier pour cette organisation";
        }
        return null;
    }

    @Override public EInvoiceResult transmit(Invoice invoice, byte[] cii) {
        String issue = readinessIssue(invoice, cii);
        if (issue != null) return EInvoiceResult.pending(issue);
        var customer = config.getCustomers().get(invoice.getOrganizationId()).getCustomerId();
        try {
            var remote = api.send(customer, cii);
            return pending(reference(customer, remote), "Facture déposée chez Iopole ; transmission au destinataire à confirmer");
        } catch (RuntimeException e) {
            return EInvoiceResult.pending("Dépôt Iopole non confirmé ; rapprocher auprès du partenaire avant tout nouvel envoi");
        }
    }

    @Override public EInvoiceResult reconcile(Invoice invoice, String reference) {
        String issue = scopeIssue(invoice);
        if (issue != null) return pending(reference, issue);
        var customer = config.getCustomers().get(invoice.getOrganizationId()).getCustomerId();
        try {
            String prefix = reference(customer, null);
            if (reference == null || !reference.startsWith(prefix)) return pending(reference, "Compte ou environnement Iopole différent ; rapprochement requis");
            UUID remote = UUID.fromString(reference.substring(prefix.length()));
            if (!matches(api.metadata(customer, remote), invoice, remote)) {
                return new EInvoiceResult(EInvoiceStatus.FAILED, reference, "La facture Iopole ne correspond pas au document émis ; rapprochement requis");
            }
            return status(inbox.refresh(invoice.getOrganizationId(), config.getEnvironment().name(), customer, remote), remote, reference);
        } catch (RuntimeException e) {
            return pending(reference, "Vérification Iopole indisponible ; aucun nouvel envoi effectué");
        }
    }

    private String reference(UUID customer, UUID remote) {
        return "iopole:" + config.getEnvironment().name() + ":" + customer + ":" + (remote == null ? "" : remote);
    }

    private boolean matches(JsonNode metadata, Invoice invoice, UUID remote) {
        if (!remote.toString().equals(metadata.path("invoiceId").asText()) || !"EMITTED".equals(metadata.path("way").asText())) return false;
        var data = metadata.path("businessData");
        return Objects.equals(invoice.getInvoiceNumber(), data.path("invoiceId").asText())
            && Objects.equals(invoice.getInvoiceDate().toString(), data.path("invoiceDate").asText())
            && Objects.equals(invoice.getOriginalInvoiceId() == null ? "380" : "381", data.path("type").asText())
            && Objects.equals(invoice.getSellerTaxId(), data.path("seller").path("vatNumber").asText())
            && Objects.equals(invoice.getBuyerTaxId(), data.path("buyer").path("vatNumber").asText())
            && money(data.path("monetary").path("invoiceAmount"), invoice.getCurrency(), invoice.getTotalTtc())
            && money(data.path("monetary").path("taxBasisTotalAmount"), invoice.getCurrency(), invoice.getTotalHt())
            && money(data.path("monetary").path("taxTotalAmount"), invoice.getCurrency(), invoice.getTotalTax());
    }

    private boolean money(JsonNode value, String currency, BigDecimal amount) {
        return amount != null && currency.equals(value.path("currency").asText()) && value.path("amount").isNumber()
            && value.path("amount").decimalValue().compareTo(amount.abs()) == 0;
    }

    private EInvoiceResult status(JsonNode history, UUID remote, String reference) {
        if (!history.isArray()) return pending(reference, "Historique Iopole incomplet");
        JsonNode latest = null;
        Instant date = Instant.MIN;
        boolean conflict = false;
        for (var item : history) {
            if (!remote.toString().equals(item.path("invoiceId").asText()) || !"OPERATOR".equals(item.path("destType").asText())) continue;
            Instant time = Instant.parse(item.path("date").asText());
            if (time.isAfter(date)) { latest = item; date = time; conflict = false; }
            else if (time.equals(date) && latest != null && !item.path("status").equals(latest.path("status"))) conflict = true;
        }
        if (conflict) return pending(reference, "Statuts Iopole contradictoires ; rapprochement requis");
        String code = latest == null ? "" : latest.path("status").path("code").asText();
        if (DELIVERED.contains(code)) return new EInvoiceResult(EInvoiceStatus.REPORTED, reference, "Transmission Iopole confirmée ; ce statut ne prouve pas un paiement");
        if (REJECTED.contains(code)) return new EInvoiceResult(EInvoiceStatus.FAILED, reference, "Document refusé par le circuit Iopole ; correction fiscale requise");
        return pending(reference, "Traitement Iopole en cours ou à vérifier ; réception non confirmée");
    }

    private static EInvoiceResult pending(String reference, String message) { return new EInvoiceResult(EInvoiceStatus.PENDING, reference, message); }
}
