package com.clenzy.service;

import com.clenzy.model.OwnerPayout;
import com.clenzy.model.Reservation;
import com.clenzy.repository.OwnerPayoutRepository;
import com.clenzy.repository.ReservationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

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

    public AccountingExportService(ReservationRepository reservationRepository,
                                   OwnerPayoutRepository payoutRepository) {
        this.reservationRepository = reservationRepository;
        this.payoutRepository = payoutRepository;
    }

    /**
     * Export FEC (Fichier des Ecritures Comptables) conforme norme France.
     * Format: tab-separated values with mandatory columns.
     */
    public String exportFec(Long orgId, LocalDate from, LocalDate to) {
        List<Reservation> reservations = reservationRepository.findAllByDateRange(from, to, orgId);

        StringBuilder sb = new StringBuilder();
        // FEC Header (norme DGFiP)
        sb.append(String.join(FEC_SEPARATOR,
            "JournalCode", "JournalLib", "EcritureNum", "EcritureDate",
            "CompteNum", "CompteLib", "CompAuxNum", "CompAuxLib",
            "PieceRef", "PieceDate", "EcritureLib",
            "Debit", "Credit", "EcritureLet", "DateLet",
            "ValidDate", "Montantdevise", "Idevise")).append("\n");

        int lineNum = 1;
        for (Reservation r : reservations) {
            BigDecimal amount = r.getTotalPrice() != null ? r.getTotalPrice() : BigDecimal.ZERO;
            String date = r.getCheckIn().format(FEC_DATE_FORMAT);
            String ecritureNum = String.format("RES%06d", lineNum);
            String guestName = r.getGuestName() != null ? r.getGuestName() : "Guest";
            String propertyName = r.getProperty() != null ? r.getProperty().getName() : "Property";

            // Debit: Client account (411)
            sb.append(String.join(FEC_SEPARATOR,
                "VE", "Ventes", ecritureNum, date,
                "411000", "Clients", "", guestName,
                ecritureNum, date,
                "Reservation " + propertyName + " " + guestName,
                formatAmount(amount), formatAmount(BigDecimal.ZERO), "", "",
                date, formatAmount(amount), "EUR")).append("\n");

            // Credit: Revenue account (706)
            sb.append(String.join(FEC_SEPARATOR,
                "VE", "Ventes", ecritureNum, date,
                "706000", "Prestations de services", "", "",
                ecritureNum, date,
                "Reservation " + propertyName + " " + guestName,
                formatAmount(BigDecimal.ZERO), formatAmount(amount), "", "",
                date, formatAmount(amount), "EUR")).append("\n");

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

        StringBuilder sb = new StringBuilder();
        sb.append(String.join(CSV_SEPARATOR,
            "ID", "OwnerId", "PeriodStart", "PeriodEnd",
            "GrossRevenue", "CommissionRate", "CommissionAmount",
            "Expenses", "NetAmount", "Status", "PaymentReference", "PaidAt")).append("\n");

        for (OwnerPayout p : filtered) {
            sb.append(String.join(CSV_SEPARATOR,
                String.valueOf(p.getId()),
                String.valueOf(p.getOwnerId()),
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
