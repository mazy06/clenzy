package com.clenzy.scheduler;

import com.clenzy.model.Invoice;
import com.clenzy.model.InvoiceStatus;
import com.clenzy.repository.InvoiceRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Daily scheduler to detect and mark overdue invoices.
 */
@Component
public class InvoiceOverdueScheduler {

    private static final Logger log = LoggerFactory.getLogger(InvoiceOverdueScheduler.class);

    private final InvoiceRepository invoiceRepository;

    public InvoiceOverdueScheduler(InvoiceRepository invoiceRepository) {
        this.invoiceRepository = invoiceRepository;
    }

    @Scheduled(cron = "0 0 8 * * *")  // Daily at 8:00 AM
    @Transactional
    public void checkOverdueInvoices() {
        log.debug("Checking for overdue invoices...");
        LocalDate today = LocalDate.now();

        // Find SENT and ISSUED invoices past their due date
        List<Invoice> candidates = invoiceRepository.findAll().stream()
            .filter(inv -> inv.getStatus() == InvoiceStatus.SENT
                        || inv.getStatus() == InvoiceStatus.ISSUED)
            .filter(inv -> inv.getDueDate() != null && inv.getDueDate().isBefore(today))
            .toList();

        int overdueCount = 0;
        for (Invoice invoice : candidates) {
            try {
                invoice.setStatus(InvoiceStatus.OVERDUE);
                invoice.setOverdueNotifiedAt(LocalDateTime.now());
                invoiceRepository.save(invoice);
                overdueCount++;
                log.info("Invoice {} marked as OVERDUE (due date: {})",
                    invoice.getInvoiceNumber(), invoice.getDueDate());
            } catch (Exception e) {
                log.error("Failed to mark invoice {} as overdue: {}",
                    invoice.getId(), e.getMessage());
            }
        }

        if (overdueCount > 0) {
            log.info("Marked {} invoices as OVERDUE", overdueCount);
        }
    }
}
