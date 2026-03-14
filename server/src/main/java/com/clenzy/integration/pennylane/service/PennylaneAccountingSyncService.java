package com.clenzy.integration.pennylane.service;

import com.clenzy.integration.pennylane.model.PennylaneConnection;
import com.clenzy.integration.pennylane.repository.PennylaneConnectionRepository;
import com.clenzy.model.*;
import com.clenzy.repository.InvoiceRepository;
import com.clenzy.repository.ProviderExpenseRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

/**
 * Service de synchronisation Clenzy → Pennylane.
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

    public PennylaneAccountingSyncService(PennylaneAccountingClient client,
                                           PennylaneOAuthService oauthService,
                                           PennylaneConnectionRepository connectionRepository,
                                           InvoiceRepository invoiceRepository,
                                           ProviderExpenseRepository expenseRepository) {
        this.client = client;
        this.oauthService = oauthService;
        this.connectionRepository = connectionRepository;
        this.invoiceRepository = invoiceRepository;
        this.expenseRepository = expenseRepository;
    }

    // ─── Sync individuel ─────────────────────────────────────────────────────

    /**
     * Synchronise une facture client Clenzy vers Pennylane.
     */
    public void syncInvoice(Invoice invoice) {
        Long orgId = invoice.getOrganizationId();
        ensureConnected(orgId);

        // Chercher ou creer le client Pennylane
        String customerRef = "clenzy_customer_" + safeString(invoice.getBuyerName());
        Number customerId = getOrCreateCustomer(orgId, customerRef, invoice.getBuyerName());

        // Construire le body de la facture Pennylane
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("customer_id", customerId);
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

        Map<String, Object> response = client.createCustomerInvoice(orgId, body);

        // Stocker l'ID Pennylane et la date de sync
        if (response == null || response.get("id") == null) {
            throw new IllegalStateException("Reponse Pennylane invalide — id absent pour facture " + invoice.getInvoiceNumber());
        }
        String pennylaneId = String.valueOf(response.get("id"));
        invoice.setPennylaneInvoiceId(pennylaneId);
        invoice.setPennylaneSyncedAt(Instant.now());
        invoiceRepository.save(invoice);

        log.info("Pennylane sync — facture {} synchronisee (pennylane_id={})",
            invoice.getInvoiceNumber(), pennylaneId);
    }

    /**
     * Synchronise une depense fournisseur Clenzy vers Pennylane.
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
        Number supplierId = getOrCreateSupplier(orgId, supplierRef, providerName);

        // Construire le body (supplier invoice)
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("supplier_id", supplierId);
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

        Map<String, Object> response = client.createSupplierInvoice(orgId, body);

        if (response == null || response.get("id") == null) {
            throw new IllegalStateException("Reponse Pennylane invalide — id absent pour depense #" + expense.getId());
        }
        String pennylaneId = String.valueOf(response.get("id"));
        expense.setPennylaneInvoiceId(pennylaneId);
        expense.setPennylaneSyncedAt(Instant.now());
        expenseRepository.save(expense);

        log.info("Pennylane sync — depense #{} synchronisee (pennylane_id={})",
            expense.getId(), pennylaneId);
    }

    // ─── Sync en batch ───────────────────────────────────────────────────────

    /**
     * Synchronise toutes les factures non encore envoyees a Pennylane.
     */
    public SyncResult syncAllPendingInvoices(Long orgId) {
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
                errors.add("Facture " + invoice.getInvoiceNumber() + ": " + e.getMessage());
                log.warn("Pennylane sync — echec facture {}: {}", invoice.getInvoiceNumber(), e.getMessage());
            }
        }

        updateLastSync(orgId);
        return new SyncResult("invoices", synced, failed, pending.size(), errors);
    }

    /**
     * Synchronise toutes les depenses non encore envoyees a Pennylane.
     */
    public SyncResult syncAllPendingExpenses(Long orgId) {
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
                errors.add("Depense #" + expense.getId() + ": " + e.getMessage());
                log.warn("Pennylane sync — echec depense #{}: {}", expense.getId(), e.getMessage());
            }
        }

        updateLastSync(orgId);
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
        status.put("lastSyncAt", conn.map(PennylaneConnection::getLastSyncAt).orElse(null));
        return status;
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private void ensureConnected(Long orgId) {
        if (!oauthService.isConnected(orgId)) {
            throw new IllegalStateException("Organisation " + orgId + " non connectee a Pennylane");
        }
    }

    private Number getOrCreateCustomer(Long orgId, String externalRef, String name) {
        Optional<Map<String, Object>> existing = client.findCustomerByExternalRef(orgId, externalRef);
        if (existing.isPresent()) {
            Object id = existing.get().get("id");
            if (id instanceof Number) return (Number) id;
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("customer_type", "company");
        body.put("name", name != null ? name : "Client Clenzy");
        body.put("external_reference", externalRef);

        Map<String, Object> created = client.createCustomer(orgId, body);
        Object id = created != null ? created.get("id") : null;
        if (!(id instanceof Number)) {
            throw new IllegalStateException("Pennylane — id invalide dans la reponse creation client");
        }
        return (Number) id;
    }

    private Number getOrCreateSupplier(Long orgId, String externalRef, String name) {
        Optional<Map<String, Object>> existing = client.findSupplierByExternalRef(orgId, externalRef);
        if (existing.isPresent()) {
            Object id = existing.get().get("id");
            if (id instanceof Number) return (Number) id;
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", name);
        body.put("external_reference", externalRef);

        Map<String, Object> created = client.createSupplier(orgId, body);
        Object id = created != null ? created.get("id") : null;
        if (!(id instanceof Number)) {
            throw new IllegalStateException("Pennylane — id invalide dans la reponse creation fournisseur");
        }
        return (Number) id;
    }

    /**
     * Mappe un taux de TVA Clenzy vers un code TVA Pennylane.
     */
    private String mapVatRate(BigDecimal taxRate) {
        if (taxRate == null || taxRate.compareTo(BigDecimal.ZERO) == 0) {
            return "exempt";
        }
        // Pennylane attend le taux en pourcentage (20, 10, 5.5)
        // Clenzy stocke en decimal (0.20, 0.10, 0.055)
        BigDecimal percent = taxRate.multiply(BigDecimal.valueOf(100));
        if (percent.compareTo(BigDecimal.valueOf(20)) == 0) return "FR_200";
        if (percent.compareTo(BigDecimal.valueOf(10)) == 0) return "FR_100";
        if (percent.compareTo(new BigDecimal("5.5")) == 0) return "FR_055";
        // Default : taux standard
        return "FR_200";
    }

    private void updateLastSync(Long orgId) {
        connectionRepository.findByOrganizationId(orgId).ifPresent(conn -> {
            conn.setLastSyncAt(Instant.now());
            connectionRepository.save(conn);
        });
    }

    private String safeString(String s) {
        return s != null ? s.replaceAll("[^a-zA-Z0-9_]", "_").toLowerCase() : "unknown";
    }

    // ─── Record resultat ─────────────────────────────────────────────────────

    public record SyncResult(String type, int synced, int failed, int total, List<String> errors) {}
}
