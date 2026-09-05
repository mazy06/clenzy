package com.clenzy.service.report;

import com.clenzy.model.ReportDocument;
import com.clenzy.model.ReportDocumentStatus;
import com.clenzy.repository.ReportDocumentRepository;
import com.clenzy.service.EmailService;
import com.clenzy.service.access.OrganizationAccessGuard;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.List;

/**
 * Le cycle de vie d'un rapport : brouillon → relu → envoye.
 *
 * <p>Ces regles existent pour une raison precise : un commentaire redige par un
 * agent peut atteindre un proprietaire, et un texte errone sur des montants
 * engage l'emetteur. La relecture humaine n'est donc pas une politesse de
 * processus mais la seule barriere entre un modele et un destinataire.</p>
 */
class ReportDocumentLifecycleTest {

    private ReportDocumentRepository repository;
    private EmailService emailService;
    private OrganizationAccessGuard guard;
    private ReportDocumentService service;

    @BeforeEach
    void setUp() {
        repository = mock(ReportDocumentRepository.class);
        emailService = mock(EmailService.class);
        guard = mock(OrganizationAccessGuard.class);

        service = new ReportDocumentService(null, null,
                mock(com.clenzy.service.report.render.ReportPdfService.class),
                repository, null, null, null, guard, emailService,
                new com.fasterxml.jackson.databind.ObjectMapper());

        when(repository.save(any(ReportDocument.class))).thenAnswer(i -> i.getArgument(0));
    }

    @Test
    void whenTheReportWasAlreadySent_thenSendingAgainIsRefused() {
        // Un document transmis est fige : toute reprise cree une version, jamais
        // une modification en place. Sans cela l'emetteur et le destinataire
        // discutent de deux documents portant le meme numero.
        final ReportDocument document = draft();
        document.setStatus(ReportDocumentStatus.SENT);
        given(document);

        assertThatThrownBy(() -> service.send(1L, 7L, "kc-42", List.of()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("nouvelle version");

        verifyNoInteractions(emailService);
    }

    @Test
    void whenTheRecipientHasNoAddress_thenSendingIsRefused() {
        final ReportDocument document = draft();
        document.setRecipientEmail(null);
        given(document);

        assertThatThrownBy(() -> service.send(1L, 7L, "kc-42", List.of()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("adresse");

        verifyNoInteractions(emailService);
    }

    @Test
    void whenADraftIsSent_thenTheSenderIsStampedAsTheReader() {
        // L'envoi VAUT relecture : il n'y a plus d'etape intermediaire, et c'est
        // le geste d'envoi qui porte la decision humaine. Encore faut-il savoir
        // qui l'a prise.
        given(draft());

        // L'envoi differe le mail apres le commit : sans synchronisation active,
        // `registerSynchronization` refuse. On en ouvre une, comme le ferait le
        // proxy transactionnel de Spring.
        TransactionSynchronizationManager.initSynchronization();
        final ReportDocument sent;
        try {
            sent = service.send(1L, 7L, "kc-42", List.of());
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }

        assertThat(sent.getStatus()).isEqualTo(ReportDocumentStatus.SENT);
        assertThat(sent.getSentAt()).isNotNull();
        assertThat(sent.getReviewedByKeycloakId()).isEqualTo("kc-42");
        assertThat(sent.getReviewedAt()).isNotNull();
    }

    @Test
    void whenAnAddressIsMalformed_thenNothingIsSent() {
        // Une adresse saisie a la main finit toujours par etre fautive. Mieux
        // vaut refuser l'envoi entier que transmettre a une partie des
        // destinataires en laissant croire que tous l'ont recu.
        given(draft());

        assertThatThrownBy(() -> service.send(1L, 7L, "kc-42", List.of("pas-une-adresse")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("invalide");

        verifyNoInteractions(emailService);
    }

    @Test
    void whenAReportOfAnotherOrganisationIsLoaded_thenTheGuardIsConsulted() {
        final ReportDocument document = draft();
        document.setOrganizationId(99L);
        given(document);

        service.load(1L, 7L);

        // Le garde-fou multi-tenant doit etre interroge a CHAQUE chargement par
        // identifiant : `findById` contourne le filtre Hibernate.
        final ArgumentCaptor<Long> owner = ArgumentCaptor.forClass(Long.class);
        verify(guard).requireSameOrganization(owner.capture(), eq(7L), anyString());
        assertThat(owner.getValue()).isEqualTo(99L);
    }

    private void given(ReportDocument document) {
        when(repository.findById(anyLong())).thenReturn(Optional.of(document));
    }

    private ReportDocument draft() {
        final ReportDocument document = new ReportDocument();
        document.setId(1L);
        document.setOrganizationId(7L);
        document.setDocumentNumber("R-2026-0001");
        document.setStatus(ReportDocumentStatus.DRAFT);
        document.setTitle("Relevé de gestion");
        document.setRecipientEmail("proprietaire@example.test");
        document.setPeriodStart(LocalDate.of(2026, 8, 1));
        document.setPeriodEnd(LocalDate.of(2026, 8, 31));
        document.setDataAsOf(Instant.now());
        // Un snapshot minimal mais REEL : l'envoi le relit pour composer le
        // message d'accompagnement, un « {} » y produit un meta nul. Sans date :
        // l'ObjectMapper nu de ce test n'a pas le module java.time.
        document.setSnapshotJson(
                "{\"meta\":{\"title\":\"Relevé de gestion\",\"issuerName\":\"Conciergerie\","
                + "\"currency\":\"EUR\",\"profile\":\"OWNER\",\"version\":1,\"scopeLabels\":[]},"
                + "\"kpis\":[],\"sections\":[]}");
        document.setSnapshotHash("hash");
        return document;
    }
}
