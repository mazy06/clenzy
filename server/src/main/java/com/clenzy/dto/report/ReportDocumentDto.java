package com.clenzy.dto.report;

import com.clenzy.model.ReportDocument;
import com.clenzy.model.ReportDocumentStatus;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** Un rapport tel que l'ecran le liste. Le snapshot n'y voyage pas : il est volumineux. */
public record ReportDocumentDto(
        Long id,
        String documentNumber,
        int version,
        ReportProfile profile,
        ReportDocumentStatus status,
        String title,
        String recipientName,
        String recipientEmail,
        LocalDate periodStart,
        LocalDate periodEnd,
        Instant dataAsOf,
        boolean hasNarrative,
        LocalDateTime reviewedAt,
        LocalDateTime sentAt,
        LocalDateTime createdAt
) {
    public static ReportDocumentDto of(ReportDocument d) {
        return new ReportDocumentDto(d.getId(), d.getDocumentNumber(), d.getVersion(), d.getProfile(),
                d.getStatus(), d.getTitle(), d.getRecipientName(), d.getRecipientEmail(),
                d.getPeriodStart(), d.getPeriodEnd(), d.getDataAsOf(),
                d.getNarrativeJson() != null, d.getReviewedAt(), d.getSentAt(), d.getCreatedAt());
    }
}
