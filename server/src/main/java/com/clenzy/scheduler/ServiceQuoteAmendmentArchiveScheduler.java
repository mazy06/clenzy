package com.clenzy.scheduler;

import com.clenzy.service.ServiceQuoteAmendmentPdfService;
import com.clenzy.service.ServiceQuoteAmendmentArchives;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Reprise durable des PDF Baitly après panne du convertisseur ou du serveur. */
@Component
@ConditionalOnProperty(name = "baitly.amendment-archives.enabled", havingValue = "true", matchIfMissing = true)
public class ServiceQuoteAmendmentArchiveScheduler {
    private final ServiceQuoteAmendmentPdfService pdf;
    private final ServiceQuoteAmendmentArchives archives;
    public ServiceQuoteAmendmentArchiveScheduler(ServiceQuoteAmendmentPdfService pdf, ServiceQuoteAmendmentArchives archives) {
        this.pdf = pdf; this.archives = archives;
    }

    @Scheduled(fixedDelayString = "${baitly.amendment-archives.delay-ms:60000}")
    public void archiveDue() {
        archives.discoverMissing();
        for (int i = 0; i < 5; i++) {
            try { if (!pdf.archiveNext()) return; }
            catch (RuntimeException failure) {
                // Ne pas journaliser le contenu du document ni le message d'un service externe.
                LoggerFactory.getLogger(getClass()).warn("Archivage d'avenant Baitly différé ({})", failure.getClass().getSimpleName());
            }
        }
    }
}
