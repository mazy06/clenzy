package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.InvoiceRepository;
import com.clenzy.repository.OwnerPayoutRepository;
import com.clenzy.repository.ProviderExpenseRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Service d'export comptable.
 * Supporte les formats FEC (Fichier des Ecritures Comptables - norme France)
 * et CSV generique.
 */
@Service
@Transactional(readOnly = true)
public class AccountingExportService {

    private static final DateTimeFormatter FEC_DATE_FORMAT = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final String FEC_SEPARATOR = "\t";
    private static final String CSV_SEPARATOR = ";";

    private final ReservationRepository reservationRepository;
    private final OwnerPayoutRepository payoutRepository;
    private final ProviderExpenseRepository expenseRepository;
    private final InvoiceRepository invoiceRepository;
    private final UserRepository userRepository;

    public AccountingExportService(ReservationRepository reservationRepository,
                                   OwnerPayoutRepository payoutRepository,
                                   ProviderExpenseRepository expenseRepository,
                                   InvoiceRepository invoiceRepository,
                                   UserRepository userRepository) {
        this.reservationRepository = reservationRepository;
        this.payoutRepository = payoutRepository;
        this.expenseRepository = expenseRepository;
        this.invoiceRepository = invoiceRepository;
        this.userRepository = userRepository;
    }

    /**
     * Statuts de factures fiscalement emises (inclus dans le FEC).
     */
    private static final List<InvoiceStatus> FEC_INVOICE_STATUSES =
        List.of(InvoiceStatus.ISSUED, InvoiceStatus.PAID, InvoiceStatus.OVERDUE, InvoiceStatus.SENT);

    /**
     * Export FEC (Fichier des Ecritures Comptables) conforme norme France.
     * Utilise les entites Invoice (pas les reservations) pour garantir la tracabilite
     * avec les numeros de facture officiels et les montants fiscaux.
     * Format: tab-separated values with mandatory columns.
     */
    public String exportFec(Long orgId, LocalDate from, LocalDate to) {
        List<Invoice> invoices = invoiceRepository.findByOrganizationIdAndDateRange(orgId, from, to)
            .stream()
            .filter(inv -> FEC_INVOICE_STATUSES.contains(inv.getStatus()))
            .toList();

        StringBuilder sb = new StringBuilder();
        // FEC Header (norme DGFiP)
        sb.append(String.join(FEC_SEPARATOR,
            "JournalCode", "JournalLib", "EcritureNum", "EcritureDate",
            "CompteNum", "CompteLib", "CompAuxNum", "CompAuxLib",
            "PieceRef", "PieceDate", "EcritureLib",
            "Debit", "Credit", "EcritureLet", "DateLet",
            "ValidDate", "Montantdevise", "Idevise")).append("\n");

        int lineNum = 1;
        for (Invoice inv : invoices) {
            BigDecimal totalTtc = inv.getTotalTtc() != null ? inv.getTotalTtc() : BigDecimal.ZERO;
            BigDecimal totalHt = inv.getTotalHt() != null ? inv.getTotalHt() : BigDecimal.ZERO;
            BigDecimal totalTax = inv.getTotalTax() != null ? inv.getTotalTax() : BigDecimal.ZERO;
            String invoiceNumber = inv.getInvoiceNumber() != null ? inv.getInvoiceNumber() : String.format("INV%06d", lineNum);
            String date = inv.getInvoiceDate() != null ? inv.getInvoiceDate().format(FEC_DATE_FORMAT) : "";
            String buyerName = inv.getBuyerName() != null ? inv.getBuyerName() : "Client";
            String currency = inv.getCurrency() != null ? inv.getCurrency() : "EUR";
            String ecritureLib = "Facture " + invoiceNumber + " " + buyerName;

            // Debit: Client account (411) — montant TTC
            sb.append(String.join(FEC_SEPARATOR,
                "VE", "Ventes", invoiceNumber, date,
                "411000", "Clients", "", buyerName,
                invoiceNumber, date, ecritureLib,
                formatAmount(totalTtc), formatAmount(BigDecimal.ZERO), "", "",
                date, formatAmount(totalTtc), currency)).append("\n");

            // Credit: Revenue account (706) — montant HT
            sb.append(String.join(FEC_SEPARATOR,
                "VE", "Ventes", invoiceNumber, date,
                "706000", "Prestations de services", "", "",
                invoiceNumber, date, ecritureLib,
                formatAmount(BigDecimal.ZERO), formatAmount(totalHt), "", "",
                date, formatAmount(totalHt), currency)).append("\n");

            // Credit: TVA collectee (44571) — montant TVA (si > 0)
            if (totalTax.compareTo(BigDecimal.ZERO) > 0) {
                sb.append(String.join(FEC_SEPARATOR,
                    "VE", "Ventes", invoiceNumber, date,
                    "44571", "TVA collectee", "", "",
                    invoiceNumber, date, ecritureLib,
                    formatAmount(BigDecimal.ZERO), formatAmount(totalTax), "", "",
                    date, formatAmount(totalTax), currency)).append("\n");
            }

            lineNum++;
        }

        return sb.toString();
    }

    /**
     * Export CSV generique des reservations.
     */
    public String exportReservationsCsv(Long orgId, LocalDate from, LocalDate to) {
        List<Reservation> reservations = reservationRepository.findAllByDateRange(from, to, orgId);

        StringBuilder sb = new StringBuilder();
        sb.append(String.join(CSV_SEPARATOR,
            "ID", "Property", "Guest", "CheckIn", "CheckOut", "Nights",
            "TotalPrice", "Channel", "Status", "CreatedAt")).append("\n");

        for (Reservation r : reservations) {
            long nights = java.time.temporal.ChronoUnit.DAYS.between(r.getCheckIn(), r.getCheckOut());
            sb.append(String.join(CSV_SEPARATOR,
                String.valueOf(r.getId()),
                r.getProperty() != null ? escapeCsv(r.getProperty().getName()) : "",
                escapeCsv(r.getGuestName() != null ? r.getGuestName() : ""),
                r.getCheckIn().toString(),
                r.getCheckOut().toString(),
                String.valueOf(nights),
                r.getTotalPrice() != null ? r.getTotalPrice().toPlainString() : "0",
                r.getSource() != null ? r.getSource() : "",
                r.getStatus() != null ? r.getStatus() : "",
                r.getCreatedAt() != null ? r.getCreatedAt().toString() : ""
            )).append("\n");
        }

        return sb.toString();
    }

    /**
     * Export CSV des reversements proprietaires.
     */
    public String exportPayoutsCsv(Long orgId, LocalDate from, LocalDate to) {
        List<OwnerPayout> payouts = payoutRepository.findAllByOrgId(orgId);

        // Filter by period
        List<OwnerPayout> filtered = payouts.stream()
            .filter(p -> !p.getPeriodStart().isAfter(to) && !p.getPeriodEnd().isBefore(from))
            .toList();

        // Resolve owner names in batch
        Set<Long> ownerIds = filtered.stream().map(OwnerPayout::getOwnerId).collect(Collectors.toSet());
        Map<Long, String> ownerNames = userRepository.findAllById(ownerIds).stream()
            .collect(Collectors.toMap(User::getId, User::getFullName, (a, b) -> a));

        StringBuilder sb = new StringBuilder();
        sb.append(String.join(CSV_SEPARATOR,
            "ID", "OwnerId", "OwnerName", "PeriodStart", "PeriodEnd",
            "GrossRevenue", "CommissionRate", "CommissionAmount",
            "Expenses", "NetAmount", "Status", "PaymentReference", "PaidAt")).append("\n");

        for (OwnerPayout p : filtered) {
            sb.append(String.join(CSV_SEPARATOR,
                String.valueOf(p.getId()),
                String.valueOf(p.getOwnerId()),
                escapeCsv(ownerNames.getOrDefault(p.getOwnerId(), "")),
                p.getPeriodStart().toString(),
                p.getPeriodEnd().toString(),
                p.getGrossRevenue().toPlainString(),
                p.getCommissionRate().toPlainString(),
                p.getCommissionAmount().toPlainString(),
                p.getExpenses() != null ? p.getExpenses().toPlainString() : "0",
                p.getNetAmount().toPlainString(),
                p.getStatus().name(),
                p.getPaymentReference() != null ? p.getPaymentReference() : "",
                p.getPaidAt() != null ? p.getPaidAt().toString() : ""
            )).append("\n");
        }

        return sb.toString();
    }

    /**
     * Export CSV des depenses prestataires.
     */
    public String exportExpensesCsv(Long orgId, LocalDate from, LocalDate to) {
        List<ProviderExpense> expenses = expenseRepository.findByDateRangeAndOrgId(from, to, orgId);

        StringBuilder sb = new StringBuilder();
        sb.append(String.join(CSV_SEPARATOR,
            "ID", "Prestataire", "Logement", "Description", "Categorie",
            "MontantHT", "TauxTVA", "MontantTVA", "MontantTTC",
            "Date", "Statut", "RefFacture", "RefPaiement")).append("\n");

        for (ProviderExpense e : expenses) {
            String providerName = e.getProvider() != null
                ? escapeCsv(e.getProvider().getFirstName() + " " + e.getProvider().getLastName()) : "";
            String propertyName = e.getProperty() != null ? escapeCsv(e.getProperty().getName()) : "";

            sb.append(String.join(CSV_SEPARATOR,
                String.valueOf(e.getId()),
                providerName,
                propertyName,
                escapeCsv(e.getDescription() != null ? e.getDescription() : ""),
                e.getCategory() != null ? e.getCategory().name() : "",
                e.getAmountHt() != null ? e.getAmountHt().toPlainString() : "0",
                e.getTaxRate() != null ? e.getTaxRate().toPlainString() : "0",
                e.getTaxAmount() != null ? e.getTaxAmount().toPlainString() : "0",
                e.getAmountTtc() != null ? e.getAmountTtc().toPlainString() : "0",
                e.getExpenseDate() != null ? e.getExpenseDate().toString() : "",
                e.getStatus() != null ? e.getStatus().name() : "",
                e.getInvoiceReference() != null ? escapeCsv(e.getInvoiceReference()) : "",
                e.getPaymentReference() != null ? escapeCsv(e.getPaymentReference()) : ""
            )).append("\n");
        }

        return sb.toString();
    }

    /**
     * Export CSV des factures.
     */
    public String exportInvoicesCsv(Long orgId, LocalDate from, LocalDate to) {
        List<Invoice> invoices = invoiceRepository.findByOrganizationIdAndDateRange(orgId, from, to);

        StringBuilder sb = new StringBuilder();
        sb.append(String.join(CSV_SEPARATOR,
            "NumeroFacture", "Date", "Echeance", "Client",
            "TotalHT", "TotalTVA", "TotalTTC", "Devise",
            "Statut", "ModePaiement", "PayeeLe")).append("\n");

        for (Invoice inv : invoices) {
            sb.append(String.join(CSV_SEPARATOR,
                inv.getInvoiceNumber() != null ? inv.getInvoiceNumber() : "",
                inv.getInvoiceDate() != null ? inv.getInvoiceDate().toString() : "",
                inv.getDueDate() != null ? inv.getDueDate().toString() : "",
                escapeCsv(inv.getBuyerName() != null ? inv.getBuyerName() : ""),
                inv.getTotalHt() != null ? inv.getTotalHt().toPlainString() : "0",
                inv.getTotalTax() != null ? inv.getTotalTax().toPlainString() : "0",
                inv.getTotalTtc() != null ? inv.getTotalTtc().toPlainString() : "0",
                inv.getCurrency() != null ? inv.getCurrency() : "EUR",
                inv.getStatus() != null ? inv.getStatus().name() : "",
                inv.getPaymentMethod() != null ? inv.getPaymentMethod() : "",
                inv.getPaidAt() != null ? inv.getPaidAt().toString() : ""
            )).append("\n");
        }

        return sb.toString();
    }

    private String formatAmount(BigDecimal amount) {
        return amount.setScale(2).toPlainString();
    }

    private String escapeCsv(String value) {
        if (value == null) return "";
        if (value.contains(CSV_SEPARATOR) || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }
}
