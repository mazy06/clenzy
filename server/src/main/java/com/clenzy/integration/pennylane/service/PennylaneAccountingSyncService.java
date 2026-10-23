package com.clenzy.integration.pennylane.service;

import com.clenzy.integration.pennylane.model.PennylaneConnection;
import com.clenzy.integration.pennylane.repository.PennylaneConnectionRepository;
import com.clenzy.model.*;
import com.clenzy.repository.InvoiceRepository;
import com.clenzy.repository.ProviderExpenseRepository;
import com.clenzy.util.BaitlyExternalIds;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

/**
 * Service de synchronisation Baitly → Pennylane.
 *
 * Synchronise les factures clients et les depenses fournisseurs
 * vers l'API Pennylane Entreprise v2.
 */
@Service
@ConditionalOnProperty(name = "clenzy.pennylane.client-id")
public class PennylaneAccountingSyncService {

    private static final Logger log = LoggerFactory.getLogger(PennylaneAccountingSyncService.class);

    /** Statuts de factures syncables vers Pennylane (pas DRAFT ni CANCELLED). */
    private static final List<InvoiceStatus> SYNCABLE_INVOICE_STATUSES =
        List.of(InvoiceStatus.ISSUED, InvoiceStatus.SENT, InvoiceStatus.PAID);

    /** Statuts de depenses syncables vers Pennylane (pas DRAFT ni CANCELLED). */
    private static final List<ExpenseStatus> SYNCABLE_EXPENSE_STATUSES =
        List.of(ExpenseStatus.APPROVED, ExpenseStatus.INCLUDED, ExpenseStatus.PAID);

    private final PennylaneAccountingClient client;
    private final PennylaneOAuthService oauthService;
    private final PennylaneConnectionRepository connectionRepository;
    private final InvoiceRepository invoiceRepository;
    private final ProviderExpenseRepository expenseRepository;
    private final BaitlyAccountingExportJournal journal;

    public PennylaneAccountingSyncService(PennylaneAccountingClient client,
                                           PennylaneOAuthService oauthService,
                                           PennylaneConnectionRepository connectionRepository,
                                           InvoiceRepository invoiceRepository,
                                           ProviderExpenseRepository expenseRepository, BaitlyAccountingExportJournal journal) {
        this.client = client;
        this.oauthService = oauthService;
        this.connectionRepository = connectionRepository;
        this.invoiceRepository = invoiceRepository;
        this.expenseRepository = expenseRepository;
        this.journal = journal;
    }

    // ─── Sync individuel ─────────────────────────────────────────────────────

    /**
     * Synchronise une facture client Baitly vers Pennylane.
     */
    public void syncInvoice(Invoice invoice) {
        Long orgId = invoice.getOrganizationId();
        ensureConnected(orgId);

        // Chercher ou creer le client Pennylane
        String customerRef = "clenzy_customer_" + safeString(invoice.getBuyerName());

        // Construire le body de la facture Pennylane
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("currency", invoice.getCurrency());
        body.put("date", invoice.getInvoiceDate().toString());
        body.put("deadline", invoice.getDueDate() != null
            ? invoice.getDueDate().toString()
            : invoice.getInvoiceDate().plusDays(30).toString());
        body.put("external_reference", "clenzy_inv_" + invoice.getInvoiceNumber());

        // Lignes de facture
        List<Map<String, Object>> lines = new ArrayList<>();
        for (InvoiceLine line : invoice.getLines()) {
            Map<String, Object> lineMap = new LinkedHashMap<>();
            lineMap.put("label", line.getDescription());
            lineMap.put("quantity", line.getQuantity().toPlainString());
            lineMap.put("unit", "piece");
            lineMap.put("raw_currency_unit_price", line.getUnitPriceHt().toPlainString());
            lineMap.put("vat_rate", mapVatRate(line.getTaxRate()));
            lines.add(lineMap);
        }
        body.put("invoice_lines", lines);

        if (alreadyRecorded(invoice.getPennylaneInvoiceId(), invoice.getPennylaneSyncedAt())) return;
        var key = new BaitlyAccountingExportJournal.Key(orgId, BaitlyAccountingExportJournal.Kind.INVOICE, invoice.getId());
        var totals = new BaitlyPennylaneRemoteProof.Totals(invoice.getTotalHt(), invoice.getTotalTax(), invoice.getTotalTtc());
        var exported = export(key, fingerprint(body, customerRef, invoice.getBuyerName(), invoice.getCurrency(), invoice.getUpdatedAt(), totals), version(invoice.getUpdatedAt()), body, totals, () -> {
            body.put("customer_id", getOrCreateCustomer(orgId, customerRef, invoice.getBuyerName()));
            return client.createCustomerInvoice(orgId, body);
        }, () -> client.findCustomerByExternalRef(orgId, customerRef).map(item -> partyId(item.get("id"))).orElseThrow(BaitlyAccountingExportJournal::unconfirmed));
        invoice.setPennylaneInvoiceId(exported.remoteId());
        invoice.setPennylaneSyncedAt(exported.confirmedAt());

        log.info("Pennylane : export de facture confirmé");
    }

    /**
     * Synchronise une depense fournisseur Baitly vers Pennylane.
     */
    public void syncExpense(ProviderExpense expense) {
        Long orgId = expense.getOrganizationId();
        ensureConnected(orgId);

        // Chercher ou creer le fournisseur Pennylane
        String providerName = expense.getProvider() != null
            ? expense.getProvider().getFullName()
            : "Fournisseur inconnu";
        String supplierRef = "clenzy_supplier_"
            + (expense.getProvider() != null ? expense.getProvider().getId() : "unknown");

        // Construire le body (supplier invoice)
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("currency", expense.getCurrency());
        body.put("date", expense.getExpenseDate().toString());
        body.put("deadline", expense.getExpenseDate().plusDays(30).toString());
        body.put("external_reference", "clenzy_exp_" + expense.getId());

        // Une seule ligne pour la depense
        Map<String, Object> lineMap = new LinkedHashMap<>();
        lineMap.put("label", expense.getDescription());
        lineMap.put("quantity", "1");
        lineMap.put("unit", "piece");
        lineMap.put("raw_currency_unit_price", expense.getAmountHt().toPlainString());
        lineMap.put("vat_rate", mapVatRate(expense.getTaxRate()));

        body.put("invoice_lines", List.of(lineMap));

        if (alreadyRecorded(expense.getPennylaneInvoiceId(), expense.getPennylaneSyncedAt())) return;
        var key = new BaitlyAccountingExportJournal.Key(orgId, BaitlyAccountingExportJournal.Kind.EXPENSE, expense.getId());
        var totals = new BaitlyPennylaneRemoteProof.Totals(expense.getAmountHt(), expense.getTaxAmount(), expense.getAmountTtc());
        var exported = export(key, fingerprint(body, supplierRef, providerName, expense.getCurrency(), expense.getUpdatedAt(), totals), version(expense.getUpdatedAt()), body, totals, () -> {
            body.put("supplier_id", getOrCreateSupplier(orgId, supplierRef, providerName));
            return client.createSupplierInvoice(orgId, body);
        }, () -> client.findSupplierByExternalRef(orgId, supplierRef).map(item -> partyId(item.get("id"))).orElseThrow(BaitlyAccountingExportJournal::unconfirmed));
        expense.setPennylaneInvoiceId(exported.remoteId());
        expense.setPennylaneSyncedAt(exported.confirmedAt());

        log.info("Pennylane : export de dépense confirmé");
    }

    // ─── Sync en batch ───────────────────────────────────────────────────────

    /**
     * Synchronise toutes les factures non encore envoyees a Pennylane.
     */
    public SyncResult syncAllPendingInvoices(Long orgId) {
        Instant startedAt = Instant.now();
        ensureConnected(orgId);

        List<Invoice> pending = invoiceRepository.findPendingPennylaneSync(orgId, SYNCABLE_INVOICE_STATUSES);

        int synced = 0;
        int failed = 0;
        List<String> errors = new ArrayList<>();

        for (Invoice invoice : pending) {
            try {
                syncInvoice(invoice);
                synced++;
            } catch (Exception e) {
                failed++;
                var reason = BaitlyPennylaneDiagnostics.reason(e);
                errors.add(itemReference("Facture", invoice.getId(), synced + failed) + ": " + reason.message());
                log.warn("Pennylane : export de facture non confirmé ({})", reason.name());
            }
        }

        updateLastSync(orgId, startedAt);
        return new SyncResult("invoices", synced, failed, pending.size(), errors);
    }

    /**
     * Synchronise toutes les depenses non encore envoyees a Pennylane.
     */
    public SyncResult syncAllPendingExpenses(Long orgId) {
        Instant startedAt = Instant.now();
        ensureConnected(orgId);

        List<ProviderExpense> pending = expenseRepository.findPendingPennylaneSync(orgId, SYNCABLE_EXPENSE_STATUSES);

        int synced = 0;
        int failed = 0;
        List<String> errors = new ArrayList<>();

        for (ProviderExpense expense : pending) {
            try {
                syncExpense(expense);
                synced++;
            } catch (Exception e) {
                failed++;
                var reason = BaitlyPennylaneDiagnostics.reason(e);
                errors.add(itemReference("Dépense", expense.getId(), synced + failed) + ": " + reason.message());
                log.warn("Pennylane : export de dépense non confirmé ({})", reason.name());
            }
        }

        updateLastSync(orgId, startedAt);
        return new SyncResult("expenses", synced, failed, pending.size(), errors);
    }

    /**
     * Retourne le nombre d'elements en attente de synchronisation.
     */
    public Map<String, Object> getSyncStatus(Long orgId) {
        long pendingInvoices = invoiceRepository.countPendingPennylaneSync(orgId, SYNCABLE_INVOICE_STATUSES);
        long pendingExpenses = expenseRepository.countPendingPennylaneSync(orgId, SYNCABLE_EXPENSE_STATUSES);

        Optional<PennylaneConnection> conn = connectionRepository.findByOrganizationId(orgId);

        Map<String, Object> status = new LinkedHashMap<>();
        status.put("connected", oauthService.isConnected(orgId));
        status.put("pendingInvoices", pendingInvoices);
        status.put("pendingExpenses", pendingExpenses);
        status.put("unconfirmedExports", journal.countUnconfirmed(orgId));
        status.put("lastSyncAt", conn.map(PennylaneConnection::getLastSyncAt).orElse(null));
        return status;
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private record Exported(String remoteId, Instant confirmedAt) {}

    private Exported export(BaitlyAccountingExportJournal.Key key, String fingerprint, String sourceVersion,
                          Map<String, Object> body, BaitlyPennylaneRemoteProof.Totals totals, java.util.function.Supplier<Map<String,Object>> create, java.util.function.Supplier<Number> readParty) {
        var connection = connectionRepository.findByOrganizationIdAndStatus(key.organizationId(), PennylaneConnection.Status.ACTIVE)
                .orElseThrow(BaitlyAccountingExportJournal::unconfirmed);
        var ticket = journal.prepareRecoverable(key, connection.getAccountingGeneration(), fingerprint, sourceVersion);
        String reference = "baitly_export_" + ticket.attempt();
        body.put("external_reference", reference);
        String remoteId = ticket.confirmedId();
        if (remoteId == null) {
            try {
                if (ticket.firstAttempt()) {
                    var response = create.get();
                    remoteId = externalInvoiceId(response == null ? null : response.get("id"));
                    journal.confirm(ticket, remoteId);
                } else {
                    var remote = key.kind() == BaitlyAccountingExportJournal.Kind.INVOICE
                            ? client.findCustomerInvoiceByExternalRef(key.organizationId(), reference)
                            : client.findSupplierInvoiceByExternalRef(key.organizationId(), reference);
                    remoteId = BaitlyPennylaneRemoteProof.verify(remote.orElseThrow(BaitlyAccountingExportJournal::unconfirmed), body, key.kind(), readParty.get(), totals);
                    journal.confirmReconciled(ticket, remoteId);
                }
            } catch (RuntimeException failure) {
                // Une lecture concurrente infructueuse ne condamne pas l'envoi encore actif.
                if (ticket.firstAttempt()) {
                    try {journal.uncertain(ticket);} catch (RuntimeException ignored) { /* SENDING reste bloquant si la base est indisponible. */ }
                }
                throw BaitlyPennylaneDiagnostics.failure(BaitlyPennylaneDiagnostics.reason(failure));
            }
        }
        Instant confirmedAt = journal.applyLocal(ticket, remoteId);
        return new Exported(remoteId, confirmedAt);
    }

    private boolean alreadyRecorded(String remoteId, Instant syncedAt) {
        if (remoteId == null) return false;
        externalInvoiceId(remoteId);
        if (syncedAt == null) throw BaitlyAccountingExportJournal.unconfirmed();
        return true;
    }

    private String version(Object value) {return value==null ? null : value.toString();}

    private String fingerprint(Object... values) {
        try {
            var mapper = new com.fasterxml.jackson.databind.ObjectMapper().findAndRegisterModules();
            byte[] encoded = mapper.writeValueAsBytes(Arrays.asList("baitly-pennylane-export-v2", Arrays.asList(values)));
            return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(encoded));
        } catch (Exception ignored) {throw BaitlyAccountingExportJournal.unconfirmed();}
    }

    private void ensureConnected(Long orgId) {
        if (!oauthService.isConnected(orgId)) {
            throw new IllegalStateException("Organisation " + orgId + " non connectee a Pennylane");
        }
    }

    private Number getOrCreateCustomer(Long orgId, String externalRef, String name) {
        Optional<Map<String, Object>> existing = client.findCustomerByExternalRef(orgId, externalRef);
        if (existing.isPresent()) {
            return partyId(existing.get().get("id"));
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("customer_type", "company");
        body.put("name", name != null ? name : "Client Baitly");
        body.put("external_reference", externalRef);

        Map<String, Object> created = client.createCustomer(orgId, body);
        Object id = created != null ? created.get("id") : null;
        return partyId(id);
    }

    private Number getOrCreateSupplier(Long orgId, String externalRef, String name) {
        Optional<Map<String, Object>> existing = client.findSupplierByExternalRef(orgId, externalRef);
        if (existing.isPresent()) {
            return partyId(existing.get().get("id"));
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", name);
        body.put("external_reference", externalRef);

        Map<String, Object> created = client.createSupplier(orgId, body);
        Object id = created != null ? created.get("id") : null;
        return partyId(id);
    }

    private String externalInvoiceId(Object value) {
        try {return BaitlyExternalIds.require(value, 50);}
        catch (IllegalArgumentException ignored) {
            throw BaitlyPennylaneDiagnostics.failure(BaitlyPennylaneDiagnostics.Reason.INVALID_RESPONSE);
        }
    }

    private Number partyId(Object value) {
        if (!(value instanceof Number number)) throw BaitlyPennylaneDiagnostics.failure(BaitlyPennylaneDiagnostics.Reason.INVALID_RESPONSE);
        externalInvoiceId(number);
        return number;
    }

    /**
     * Mappe un taux de TVA Baitly vers un code TVA Pennylane.
     *
     * <p>Un taux non reconnu lève une {@link IllegalStateException} plutôt que
     * de retomber silencieusement sur un code par défaut : exporter une facture
     * avec un taux de TVA faux serait une erreur comptable invisible. L'exception
     * fait échouer la sync de l'élément concerné — en batch, elle est comptée
     * dans {@code failed}, remontée dans {@code errors}, et l'élément reste non
     * marqué comme synchronisé donc en attente de réconciliation/retry.</p>
     */
    private String mapVatRate(BigDecimal taxRate) {
        if (taxRate == null || taxRate.compareTo(BigDecimal.ZERO) == 0) {
            return "exempt";
        }
        // Pennylane attend le taux en pourcentage (20, 10, 5.5)
        // Baitly stocke en decimal (0.20, 0.10, 0.055)
        BigDecimal percent = taxRate.multiply(BigDecimal.valueOf(100));
        if (percent.compareTo(BigDecimal.valueOf(20)) == 0) return "FR_200";
        if (percent.compareTo(BigDecimal.valueOf(10)) == 0) return "FR_100";
        if (percent.compareTo(new BigDecimal("5.5")) == 0) return "FR_055";

        log.error("Pennylane : export refusé (UNSUPPORTED_VAT)");
        throw BaitlyPennylaneDiagnostics.failure(BaitlyPennylaneDiagnostics.Reason.UNSUPPORTED_VAT);
    }

    private String itemReference(String kind, Long id, int position) {
        // Référence locale numérique pour l'utilisateur autorisé, jamais un numéro libre ou un nom.
        return id != null && id > 0 ? kind + " #" + id : kind + " (ligne " + position + ")";
    }

    private void updateLastSync(Long orgId, Instant startedAt) {
        // Date de tentative de lot, même partiel : ne constitue pas une preuve de succès global.
        // Une reconnexion postérieure au début du lot ne doit pas hériter de ses métadonnées.
        connectionRepository.recordSyncAttempt(orgId, startedAt, Instant.now());
    }

    private String safeString(String s) {
        return s != null ? s.replaceAll("[^a-zA-Z0-9_]", "_").toLowerCase() : "unknown";
    }

    // ─── Record resultat ─────────────────────────────────────────────────────

    public record SyncResult(String type, int synced, int failed, int total, List<String> errors) {}
}
