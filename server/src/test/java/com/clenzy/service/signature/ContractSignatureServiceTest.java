package com.clenzy.service.signature;

import com.clenzy.dto.ContractSignaturePublicDto;
import com.clenzy.model.ContractSignatureRequest;
import com.clenzy.model.DocumentGeneration;
import com.clenzy.model.DocumentGenerationStatus;
import com.clenzy.model.DocumentType;
import com.clenzy.model.ManagementContract;
import com.clenzy.model.ManagementContract.ContractStatus;
import com.clenzy.model.ManagementContract.ContractType;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.ReferenceType;
import com.clenzy.repository.ContractSignatureRequestRepository;
import com.clenzy.repository.DocumentGenerationRepository;
import com.clenzy.repository.ManagementContractRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.UserRepository;
import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.clenzy.service.DocumentGeneratorService;
import com.clenzy.service.DocumentStorageService;
import com.clenzy.service.EmailService;
import com.clenzy.service.NotificationService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ContractSignatureServiceTest {

    @Mock private ContractSignatureRequestRepository signatureRequestRepository;
    @Mock private ManagementContractRepository contractRepository;
    @Mock private DocumentGenerationRepository generationRepository;
    @Mock private DocumentGeneratorService documentGeneratorService;
    @Mock private DocumentStorageService documentStorageService;
    @Mock private PropertyRepository propertyRepository;
    @Mock private UserRepository userRepository;
    @Mock private EmailService emailService;
    @Mock private SignatureProviderRegistry providerRegistry;
    @Mock private SignatureCertificateStamper certificateStamper;
    @Mock private NotificationService notificationService;
    @InjectMocks private ContractSignatureService service;

    private static final Long ORG_ID = 1L;
    private static final UUID TOKEN = UUID.fromString("11111111-2222-3333-4444-555555555555");

    private ManagementContract contract(ContractStatus status) {
        ManagementContract c = new ManagementContract();
        c.setId(1L);
        c.setOrganizationId(ORG_ID);
        c.setPropertyId(100L);
        c.setOwnerId(10L);
        c.setContractNumber("MC-001");
        c.setContractType(ContractType.FULL_MANAGEMENT);
        c.setStatus(status);
        c.setStartDate(LocalDate.of(2026, 1, 1));
        c.setCommissionRate(new BigDecimal("0.2000"));
        return c;
    }

    private ContractSignatureRequest pendingRequest() {
        ContractSignatureRequest r = new ContractSignatureRequest();
        r.setId(5L);
        r.setOrganizationId(ORG_ID);
        r.setContractId(1L);
        r.setDocumentGenerationId(7L);
        r.setToken(TOKEN);
        r.setSignerEmail("owner@example.com");
        r.setStatus(ContractSignatureRequest.Status.PENDING);
        r.setExpiresAt(LocalDateTime.now().plusDays(10));
        return r;
    }

    private DocumentGeneration mandateGeneration() {
        DocumentGeneration g = DocumentGeneration.builder()
                .documentType(DocumentType.MANDAT_GESTION)
                .referenceId(1L)
                .referenceType(ReferenceType.MANAGEMENT_CONTRACT)
                .status(DocumentGenerationStatus.COMPLETED)
                .build();
        g.setFilePath("MANDAT_GESTION/2026-06/mandat.pdf");
        return g;
    }

    // ─── sign() ───────────────────────────────────────────────────────────────

    @Test
    void whenSigningPendingRequest_thenProofRecordedAndContractActivated() throws Exception {
        ContractSignatureRequest request = pendingRequest();
        ManagementContract contract = contract(ContractStatus.DRAFT);
        when(signatureRequestRepository.findByToken(TOKEN)).thenReturn(Optional.of(request));
        when(contractRepository.findById(1L)).thenReturn(Optional.of(contract));
        when(generationRepository.findById(7L)).thenReturn(Optional.of(mandateGeneration()));
        when(documentStorageService.loadAsBytes(anyString())).thenReturn("PDF".getBytes());
        when(signatureRequestRepository.markSigned(5L)).thenReturn(1);
        when(signatureRequestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(contractRepository.findActiveByPropertyId(100L, ORG_ID)).thenReturn(Optional.empty());
        when(contractRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(certificateStamper.appendCertificate(any(), any())).thenReturn("PDF-SIGNED".getBytes());
        when(documentStorageService.store(anyString(), anyString(), any()))
                .thenReturn("MANDAT_GESTION_SIGNE/2026-06/mandat_signe.pdf");

        ContractSignaturePublicDto result = service.sign(TOKEN, "Jean Dupont", true, "1.2.3.4", "Mozilla/5.0");

        // Preuve
        assertEquals(ContractSignatureRequest.Status.SIGNED, request.getStatus());
        assertEquals("Jean Dupont", request.getSignedByName());
        assertEquals("1.2.3.4", request.getSignerIp());
        assertNotNull(request.getSignedAt());
        assertNotNull(request.getDocumentSha256());
        assertNotNull(request.getConsentText());
        assertEquals("MANDAT_GESTION_SIGNE/2026-06/mandat_signe.pdf", request.getSignedDocumentPath());
        // Activation
        assertEquals(ContractStatus.ACTIVE, contract.getStatus());
        assertNotNull(contract.getSignedAt());
        assertEquals("SIGNED", result.status());
        verify(notificationService).notifyAdminsAndManagersByOrgId(
                eq(ORG_ID), eq(NotificationKey.CONTRACT_SIGNED), anyString(), contains("actif"), anyString());
    }

    @Test
    void whenSigning_thenNotificationBodyContainsOnlyInitialsNotFullName() throws Exception {
        // RGPD : le corps PERSISTÉ de la notification in-app ne doit contenir que
        // les initiales du signataire (J.D.), jamais son nom complet — le nom
        // complet reste dans le dossier de preuve (légitime), pas dans la notif.
        ContractSignatureRequest request = pendingRequest();
        ManagementContract contract = contract(ContractStatus.DRAFT);
        when(signatureRequestRepository.findByToken(TOKEN)).thenReturn(Optional.of(request));
        when(contractRepository.findById(1L)).thenReturn(Optional.of(contract));
        when(generationRepository.findById(7L)).thenReturn(Optional.of(mandateGeneration()));
        when(documentStorageService.loadAsBytes(anyString())).thenReturn("PDF".getBytes());
        when(signatureRequestRepository.markSigned(5L)).thenReturn(1);
        when(signatureRequestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(contractRepository.findActiveByPropertyId(100L, ORG_ID)).thenReturn(Optional.empty());
        when(contractRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(certificateStamper.appendCertificate(any(), any())).thenReturn("PDF-SIGNED".getBytes());
        when(documentStorageService.store(anyString(), anyString(), any())).thenReturn("path.pdf");

        service.sign(TOKEN, "Jean Dupont", true, "1.2.3.4", "UA");

        ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
        verify(notificationService).notifyAdminsAndManagersByOrgId(
                eq(ORG_ID), eq(NotificationKey.CONTRACT_SIGNED), anyString(), body.capture(), eq("/contracts"));
        assertTrue(body.getValue().contains("J.D."), "le corps doit contenir les initiales");
        assertFalse(body.getValue().contains("Jean Dupont"), "le corps ne doit pas contenir le nom complet");
        // Le nom complet reste bien dans le dossier de preuve (donnée légale).
        assertEquals("Jean Dupont", request.getSignedByName());
    }

    @Test
    void whenAnotherContractActive_thenSignedButNotActivated() throws Exception {
        ContractSignatureRequest request = pendingRequest();
        ManagementContract contract = contract(ContractStatus.DRAFT);
        ManagementContract other = contract(ContractStatus.ACTIVE);
        other.setId(99L);
        when(signatureRequestRepository.findByToken(TOKEN)).thenReturn(Optional.of(request));
        when(contractRepository.findById(1L)).thenReturn(Optional.of(contract));
        when(generationRepository.findById(7L)).thenReturn(Optional.of(mandateGeneration()));
        when(documentStorageService.loadAsBytes(anyString())).thenReturn("PDF".getBytes());
        when(signatureRequestRepository.markSigned(5L)).thenReturn(1);
        when(signatureRequestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(contractRepository.findActiveByPropertyId(100L, ORG_ID)).thenReturn(Optional.of(other));
        when(contractRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(certificateStamper.appendCertificate(any(), any())).thenReturn("PDF-SIGNED".getBytes());
        when(documentStorageService.store(anyString(), anyString(), any())).thenReturn("path.pdf");

        service.sign(TOKEN, "Jean Dupont", true, "1.2.3.4", "UA");

        // La preuve est enregistrée mais le contrat reste DRAFT (conflit) — l'admin est prévenu.
        assertEquals(ContractSignatureRequest.Status.SIGNED, request.getStatus());
        assertEquals(ContractStatus.DRAFT, contract.getStatus());
        assertNotNull(contract.getSignedAt());
        verify(notificationService).notifyAdminsAndManagersByOrgId(
                eq(ORG_ID), eq(NotificationKey.CONTRACT_SIGNED), anyString(),
                contains("activation manuelle"), anyString());
    }

    @Test
    void whenSignerHeadersOversized_thenProofValuesTruncatedToColumnLimits() throws Exception {
        // Arrange — un en-tete client surdimensionne ne doit pas faire echouer la
        // persistance du dossier de preuve (signer_ip 64, signer_user_agent 512).
        ContractSignatureRequest request = pendingRequest();
        ManagementContract contract = contract(ContractStatus.DRAFT);
        when(signatureRequestRepository.findByToken(TOKEN)).thenReturn(Optional.of(request));
        when(contractRepository.findById(1L)).thenReturn(Optional.of(contract));
        when(generationRepository.findById(7L)).thenReturn(Optional.of(mandateGeneration()));
        when(documentStorageService.loadAsBytes(anyString())).thenReturn("PDF".getBytes());
        when(signatureRequestRepository.markSigned(5L)).thenReturn(1);
        when(signatureRequestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(contractRepository.findActiveByPropertyId(100L, ORG_ID)).thenReturn(Optional.empty());
        when(contractRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(certificateStamper.appendCertificate(any(), any())).thenReturn("PDF-SIGNED".getBytes());
        when(documentStorageService.store(anyString(), anyString(), any())).thenReturn("path.pdf");
        String oversizedIp = "9".repeat(100);
        String oversizedUserAgent = "U".repeat(2000);

        // Act
        service.sign(TOKEN, "Jean Dupont", true, oversizedIp, oversizedUserAgent);

        // Assert — valeurs bornees aux colonnes de preuve
        assertEquals(64, request.getSignerIp().length());
        assertEquals(512, request.getSignerUserAgent().length());
    }

    @Test
    void whenTokenExpired_thenGone() {
        ContractSignatureRequest request = pendingRequest();
        request.setExpiresAt(LocalDateTime.now().minusDays(1));
        when(signatureRequestRepository.findByToken(TOKEN)).thenReturn(Optional.of(request));

        ResponseStatusException e = assertThrows(ResponseStatusException.class,
                () -> service.sign(TOKEN, "Jean", true, "ip", "ua"));
        assertEquals(HttpStatus.GONE, e.getStatusCode());
    }

    @Test
    void whenAlreadySigned_thenConflict() {
        ContractSignatureRequest request = pendingRequest();
        request.setStatus(ContractSignatureRequest.Status.SIGNED);
        when(signatureRequestRepository.findByToken(TOKEN)).thenReturn(Optional.of(request));

        ResponseStatusException e = assertThrows(ResponseStatusException.class,
                () -> service.sign(TOKEN, "Jean", true, "ip", "ua"));
        assertEquals(HttpStatus.CONFLICT, e.getStatusCode());
    }

    @Test
    void whenConcurrentSign_thenSecondGetsConflict() {
        ContractSignatureRequest request = pendingRequest();
        when(signatureRequestRepository.findByToken(TOKEN)).thenReturn(Optional.of(request));
        when(contractRepository.findById(1L)).thenReturn(Optional.of(contract(ContractStatus.DRAFT)));
        when(signatureRequestRepository.markSigned(5L)).thenReturn(0); // un autre thread a gagné

        ResponseStatusException e = assertThrows(ResponseStatusException.class,
                () -> service.sign(TOKEN, "Jean", true, "ip", "ua"));
        assertEquals(HttpStatus.CONFLICT, e.getStatusCode());
    }

    @Test
    void whenContractNoLongerDraft_thenGoneAndRequestCancelled() {
        ContractSignatureRequest request = pendingRequest();
        when(signatureRequestRepository.findByToken(TOKEN)).thenReturn(Optional.of(request));
        when(contractRepository.findById(1L)).thenReturn(Optional.of(contract(ContractStatus.TERMINATED)));
        when(signatureRequestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ResponseStatusException e = assertThrows(ResponseStatusException.class,
                () -> service.sign(TOKEN, "Jean", true, "ip", "ua"));
        assertEquals(HttpStatus.GONE, e.getStatusCode());
        assertEquals(ContractSignatureRequest.Status.CANCELLED, request.getStatus());
    }

    @Test
    void whenConsentMissing_thenBadRequest() {
        ResponseStatusException e = assertThrows(ResponseStatusException.class,
                () -> service.sign(TOKEN, "Jean", false, "ip", "ua"));
        assertEquals(HttpStatus.BAD_REQUEST, e.getStatusCode());
    }

    // ─── requestSignature() ──────────────────────────────────────────────────

    @Test
    void whenOwnerHasEmail_thenLinkCreatedAndEmailed() {
        ManagementContract contract = contract(ContractStatus.DRAFT);
        DocumentGeneration generation = mandateGeneration();
        generation.setId(7L);
        when(generationRepository.findByReferenceTypeAndReferenceIdOrderByCreatedAtDesc(
                ReferenceType.MANAGEMENT_CONTRACT, 1L)).thenReturn(List.of(generation));
        SignatureProvider provider = mock(SignatureProvider.class);
        when(providerRegistry.getActiveProvider()).thenReturn(provider);
        when(provider.createSignatureRequest(any())).thenReturn(
                SignatureResult.success(TOKEN.toString(), "https://app.clenzy.fr/sign/" + TOKEN));
        when(signatureRequestRepository.findFirstByContractIdAndStatus(1L, ContractSignatureRequest.Status.PENDING))
                .thenReturn(Optional.of(pendingRequest()));

        Optional<String> url = service.requestSignature(contract, "owner@example.com");

        assertTrue(url.isPresent());
        verify(emailService).sendContractSignatureEmail(
                eq("owner@example.com"), anyString(), anyString(), eq("MC-001"),
                eq("20 %"), anyString(), eq("https://app.clenzy.fr/sign/" + TOKEN), any());
    }

    @Test
    void whenOwnerHasNoEmail_thenNoLink() {
        Optional<String> url = service.requestSignature(contract(ContractStatus.DRAFT), null);

        assertTrue(url.isEmpty());
        verifyNoInteractions(providerRegistry, emailService);
    }

    // ─── getMandateForContract() ─────────────────────────────────────────────

    @Test
    void whenContractSigned_thenMandateServesStampedPdf() {
        ManagementContract contract = contract(ContractStatus.ACTIVE);
        ContractSignatureRequest signed = pendingRequest();
        signed.setStatus(ContractSignatureRequest.Status.SIGNED);
        signed.setSignedDocumentPath("MANDAT_GESTION_SIGNE/2026-06/mandat_signe.pdf");
        when(contractRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(contract));
        when(signatureRequestRepository.findFirstByContractIdAndStatus(1L, ContractSignatureRequest.Status.SIGNED))
                .thenReturn(Optional.of(signed));
        when(documentStorageService.loadAsBytes("MANDAT_GESTION_SIGNE/2026-06/mandat_signe.pdf"))
                .thenReturn("PDF-SIGNED".getBytes());

        var payload = service.getMandateForContract(1L, ORG_ID);

        assertEquals("Mandat_signe_MC-001.pdf", payload.fileName());
        assertArrayEquals("PDF-SIGNED".getBytes(), payload.bytes());
    }

    @Test
    void whenContractNotSigned_thenMandateServesOriginal() {
        ManagementContract contract = contract(ContractStatus.DRAFT);
        when(contractRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(contract));
        when(signatureRequestRepository.findFirstByContractIdAndStatus(1L, ContractSignatureRequest.Status.SIGNED))
                .thenReturn(Optional.empty());
        when(generationRepository.findByReferenceTypeAndReferenceIdOrderByCreatedAtDesc(
                ReferenceType.MANAGEMENT_CONTRACT, 1L)).thenReturn(List.of(mandateGeneration()));
        when(documentStorageService.loadAsBytes("MANDAT_GESTION/2026-06/mandat.pdf"))
                .thenReturn("PDF".getBytes());

        var payload = service.getMandateForContract(1L, ORG_ID);

        assertEquals("Mandat_MC-001.pdf", payload.fileName());
        assertArrayEquals("PDF".getBytes(), payload.bytes());
    }

    @Test
    void whenNoMandateAtAll_thenNotFound() {
        when(contractRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(contract(ContractStatus.DRAFT)));
        when(signatureRequestRepository.findFirstByContractIdAndStatus(1L, ContractSignatureRequest.Status.SIGNED))
                .thenReturn(Optional.empty());
        when(generationRepository.findByReferenceTypeAndReferenceIdOrderByCreatedAtDesc(
                ReferenceType.MANAGEMENT_CONTRACT, 1L)).thenReturn(List.of());

        ResponseStatusException e = assertThrows(ResponseStatusException.class,
                () -> service.getMandateForContract(1L, ORG_ID));
        assertEquals(HttpStatus.NOT_FOUND, e.getStatusCode());
    }

    // ─── Masquage PII dans les logs (T-BP-01) ────────────────────────────────

    private ListAppender<ILoggingEvent> attachLogCapture() {
        Logger logger = (Logger) LoggerFactory.getLogger(ContractSignatureService.class);
        logger.setLevel(Level.INFO);
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
        return appender;
    }

    private String detachAndJoinLogs(ListAppender<ILoggingEvent> appender) {
        Logger logger = (Logger) LoggerFactory.getLogger(ContractSignatureService.class);
        logger.detachAppender(appender);
        return appender.list.stream()
                .map(ILoggingEvent::getFormattedMessage)
                .collect(Collectors.joining("\n"));
    }

    @Test
    void whenSignatureLinkSent_thenOwnerEmailMaskedInLogs() {
        // Arrange
        ManagementContract contract = contract(ContractStatus.DRAFT);
        DocumentGeneration generation = mandateGeneration();
        generation.setId(7L);
        when(generationRepository.findByReferenceTypeAndReferenceIdOrderByCreatedAtDesc(
                ReferenceType.MANAGEMENT_CONTRACT, 1L)).thenReturn(List.of(generation));
        SignatureProvider provider = mock(SignatureProvider.class);
        when(providerRegistry.getActiveProvider()).thenReturn(provider);
        when(provider.createSignatureRequest(any())).thenReturn(
                SignatureResult.success(TOKEN.toString(), "https://app.clenzy.fr/sign/" + TOKEN));
        when(signatureRequestRepository.findFirstByContractIdAndStatus(1L, ContractSignatureRequest.Status.PENDING))
                .thenReturn(Optional.of(pendingRequest()));
        ListAppender<ILoggingEvent> appender = attachLogCapture();

        // Act
        service.requestSignature(contract, "owner@example.com");

        // Assert — jamais l'email en clair, version masquee seulement
        String logs = detachAndJoinLogs(appender);
        assertFalse(logs.contains("owner@example.com"), "email du proprietaire en clair dans les logs");
        assertTrue(logs.contains("o***@example.com"), "email masque attendu dans les logs");
    }

    @Test
    void whenContractSigned_thenSignerNameMaskedInLogs() throws Exception {
        // Arrange
        ContractSignatureRequest request = pendingRequest();
        ManagementContract contract = contract(ContractStatus.DRAFT);
        when(signatureRequestRepository.findByToken(TOKEN)).thenReturn(Optional.of(request));
        when(contractRepository.findById(1L)).thenReturn(Optional.of(contract));
        when(generationRepository.findById(7L)).thenReturn(Optional.of(mandateGeneration()));
        when(documentStorageService.loadAsBytes(anyString())).thenReturn("PDF".getBytes());
        when(signatureRequestRepository.markSigned(5L)).thenReturn(1);
        when(signatureRequestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(contractRepository.findActiveByPropertyId(100L, ORG_ID)).thenReturn(Optional.empty());
        when(contractRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(certificateStamper.appendCertificate(any(), any())).thenReturn("PDF-SIGNED".getBytes());
        when(documentStorageService.store(anyString(), anyString(), any())).thenReturn("path.pdf");
        ListAppender<ILoggingEvent> appender = attachLogCapture();

        // Act
        service.sign(TOKEN, "Jean Dupont", true, "1.2.3.4", "Mozilla/5.0");

        // Assert — initiales seulement, jamais le nom complet du signataire
        String logs = detachAndJoinLogs(appender);
        assertFalse(logs.contains("Jean Dupont"), "nom complet du signataire en clair dans les logs");
        assertTrue(logs.contains("J.D."), "initiales masquees attendues dans les logs");
    }

    // ─── cancelPending() ─────────────────────────────────────────────────────

    @Test
    void whenCancellingPending_thenStatusCancelled() {
        ContractSignatureRequest request = pendingRequest();
        when(signatureRequestRepository.findFirstByContractIdAndStatus(1L, ContractSignatureRequest.Status.PENDING))
                .thenReturn(Optional.of(request));
        when(signatureRequestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.cancelPending(1L);

        assertEquals(ContractSignatureRequest.Status.CANCELLED, request.getStatus());
    }
}
