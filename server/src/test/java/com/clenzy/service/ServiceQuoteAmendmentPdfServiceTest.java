package com.clenzy.service;

import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HashMap;
import java.util.zip.ZipInputStream;
import javax.xml.parsers.DocumentBuilderFactory;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class ServiceQuoteAmendmentPdfServiceTest {
    private ServiceQuoteAmendmentService.AcceptedDocument snapshot() {
        return new ServiceQuoteAmendmentService.AcceptedDocument(4L, 7L, 1L, 2L,
                new BigDecimal("120"), new BigDecimal("150"), "EUR", "Travaux", 3L, Instant.EPOCH, 5L, Instant.EPOCH);
    }

    @Test void authorizedDownloadReturnsArchivedBytesWithoutConversion() {
        var amendments = mock(ServiceQuoteAmendmentService.class);
        var conversion = mock(LibreOfficeConversionService.class);
        var archives = mock(ServiceQuoteAmendmentArchives.class);
        byte[] canonical = "%PDF-original".getBytes(StandardCharsets.US_ASCII);
        when(amendments.acceptedDocument(4L, 99L, null)).thenReturn(snapshot());
        when(archives.read(4L, 7L)).thenReturn(canonical);
        var service = new ServiceQuoteAmendmentPdfService(amendments, conversion, archives);
        assertThat(service.download(4L, 99L, null)).isSameAs(canonical);
        var order = inOrder(amendments, archives);
        order.verify(amendments).acceptedDocument(4L, 99L, null);
        order.verify(archives).read(4L, 7L);
        verifyNoInteractions(conversion);
        verify(archives, never()).claimForDownload(any(), any());
    }

    @Test void conversionFailureSchedulesRetryWithoutStoringPdf() {
        var amendments = mock(ServiceQuoteAmendmentService.class);
        var conversion = mock(LibreOfficeConversionService.class);
        var archives = mock(ServiceQuoteAmendmentArchives.class);
        var claim = new ServiceQuoteAmendmentArchives.Claim(4L, 7L, java.util.UUID.randomUUID());
        when(archives.claimNext()).thenReturn(claim);
        when(archives.snapshot(claim)).thenReturn(snapshot());
        when(conversion.convertToPdf(any(), any())).thenThrow(new IllegalStateException("Convertisseur indisponible"));
        var service = new ServiceQuoteAmendmentPdfService(amendments, conversion, archives);
        assertThatThrownBy(service::archiveNext).hasMessage("Convertisseur indisponible");
        verify(archives).retry(claim);
        verify(archives, never()).complete(any(), any());
    }

    @Test void activeWorkerPreventsParallelDownloadConversion() {
        var amendments = mock(ServiceQuoteAmendmentService.class);
        var conversion = mock(LibreOfficeConversionService.class);
        var archives = mock(ServiceQuoteAmendmentArchives.class);
        when(amendments.acceptedDocument(4L, 7L, null)).thenReturn(snapshot());
        var service = new ServiceQuoteAmendmentPdfService(amendments, conversion, archives);
        assertThatThrownBy(() -> service.download(4L, 7L, null))
                .isInstanceOf(ServiceQuoteAmendmentPdfService.ArchivePendingException.class);
        verifyNoInteractions(conversion);
    }

    @Test void expiredWorkerReturnsWinnerInsteadOfItsOwnBytes() {
        var amendments = mock(ServiceQuoteAmendmentService.class);
        var conversion = mock(LibreOfficeConversionService.class);
        var archives = mock(ServiceQuoteAmendmentArchives.class);
        var claim = new ServiceQuoteAmendmentArchives.Claim(4L, 7L, java.util.UUID.randomUUID());
        byte[] stale = "%PDF-stale".getBytes(StandardCharsets.US_ASCII);
        byte[] winner = "%PDF-winner".getBytes(StandardCharsets.US_ASCII);
        when(amendments.acceptedDocument(4L, 7L, null)).thenReturn(snapshot());
        when(archives.read(4L, 7L)).thenReturn(null, winner);
        when(archives.claimForDownload(4L, 7L)).thenReturn(claim);
        when(archives.snapshot(claim)).thenReturn(snapshot());
        when(conversion.convertToPdf(any(), any())).thenReturn(stale);
        var service = new ServiceQuoteAmendmentPdfService(amendments, conversion, archives);
        assertThat(service.download(4L, 7L, null)).isSameAs(winner);
        verify(archives).complete(claim, stale);
        verify(archives, never()).retry(any());
    }

    @Test void conversionDoesNotKeepCallerTransactionOpen() {
        var conversion = mock(LibreOfficeConversionService.class);
        var archives = mock(ServiceQuoteAmendmentArchives.class);
        var claim = new ServiceQuoteAmendmentArchives.Claim(4L, 7L, java.util.UUID.randomUUID());
        when(archives.claimNext()).thenReturn(claim);
        when(archives.snapshot(claim)).thenReturn(snapshot());
        byte[] pdf = "%PDF-result".getBytes(StandardCharsets.US_ASCII);
        when(conversion.convertToPdf(any(), any())).thenAnswer(call -> {
            assertThat(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            return pdf;
        });
        when(archives.complete(claim, pdf)).thenReturn(true);
        var source = new org.springframework.jdbc.datasource.DriverManagerDataSource("jdbc:h2:mem:" + java.util.UUID.randomUUID(), "sa", "");
        var manager = new org.springframework.jdbc.datasource.DataSourceTransactionManager(source);
        var target = new ServiceQuoteAmendmentPdfService(mock(ServiceQuoteAmendmentService.class), conversion, archives);
        var proxy = new org.springframework.aop.framework.ProxyFactory(target);
        proxy.addAdvice(new org.springframework.transaction.interceptor.TransactionInterceptor(manager,
                new org.springframework.transaction.annotation.AnnotationTransactionAttributeSource()));
        var service = (ServiceQuoteAmendmentPdfService) proxy.getProxy();
        new org.springframework.transaction.support.TransactionTemplate(manager).executeWithoutResult(status -> {
            assertThat(service.archiveNext()).isTrue();
            assertThat(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive()).isTrue();
        });
    }

    @Test void odtContainsHistoricalAmountsAndEscapesUserMarkup() throws Exception {
        var snapshot = new ServiceQuoteAmendmentService.AcceptedDocument(4L, 7L, 1L, 2L,
                new BigDecimal("120.00"), new BigDecimal("150.00"), "EUR",
                "Réparation <script> & ${expression}\nمرحبا", 3L, Instant.EPOCH, 5L, Instant.EPOCH.plusSeconds(60));
        var entries = new HashMap<String, byte[]>();
        byte[] odt = ServiceQuoteAmendmentPdfService.toOdt(snapshot);
        try (var zip = new ZipInputStream(new ByteArrayInputStream(odt))) {
            java.util.zip.ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) entries.put(entry.getName(), zip.readAllBytes());
        }
        assertThat(new String(entries.get("mimetype"), StandardCharsets.UTF_8))
                .isEqualTo("application/vnd.oasis.opendocument.text");
        var factory = DocumentBuilderFactory.newInstance();
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        var document = factory.newDocumentBuilder().parse(new ByteArrayInputStream(entries.get("content.xml")));
        String text = document.getDocumentElement().getTextContent();
        assertThat(text).contains("120.00 EUR", "150.00 EUR", "Réparation <script> & ${expression}",
                "مرحبا", "1970-01-01T00:01:00Z", "compte n° 5");
        assertThat(document.getElementsByTagName("script").getLength()).isZero();
        factory.newDocumentBuilder().parse(new ByteArrayInputStream(entries.get("META-INF/manifest.xml")));
        // Fixture facultative pour vérifier le rendu avec le convertisseur existant.
        String output = System.getProperty("baitly.test.amendment.odt");
        if (output != null) java.nio.file.Files.write(java.nio.file.Path.of(output), odt);
    }

    @Test void deniesBeforeCallingConverter() {
        var amendments = mock(ServiceQuoteAmendmentService.class);
        var conversion = mock(LibreOfficeConversionService.class);
        when(amendments.acceptedDocument(4L, 7L, null)).thenThrow(new AccessDeniedException("Refusé"));
        var archives = mock(ServiceQuoteAmendmentArchives.class);
        var service = new ServiceQuoteAmendmentPdfService(amendments, conversion, archives);
        assertThatThrownBy(() -> service.download(4L, 7L, null)).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(conversion, archives);
    }
}
