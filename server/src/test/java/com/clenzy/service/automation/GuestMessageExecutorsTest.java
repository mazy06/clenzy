package com.clenzy.service.automation;

import com.clenzy.model.AutomationAction;
import com.clenzy.model.AutomationRule;
import com.clenzy.model.AutomationTrigger;
import com.clenzy.model.MessageChannelType;
import com.clenzy.model.MessageTemplate;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.repository.GuestReviewRepository;
import com.clenzy.service.WelcomeGuideService;
import com.clenzy.service.automation.AutomationActionExecutor.ExecutionResult;
import com.clenzy.service.messaging.GuestMessagingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Executeurs messaging du moteur d'automatisation : SEND_MESSAGE, SEND_CHECKIN_LINK (F3c),
 * SEND_GUIDE (F3a), SEND_REVIEW_REQUEST + relance conditionnee aux avis (F4a).
 */
@ExtendWith(MockitoExtension.class)
class GuestMessageExecutorsTest {

    private static final Long ORG_ID = 1L;

    @Mock private GuestMessagingService messagingService;
    @Mock private WelcomeGuideService welcomeGuideService;
    @Mock private GuestReviewRepository guestReviewRepository;

    private SendMessageExecutor sendMessage;
    private SendCheckinLinkExecutor sendCheckinLink;
    private SendGuideExecutor sendGuide;
    private SendReviewRequestExecutor sendReviewRequest;

    private MessageTemplate template;
    private Reservation reservation;
    private AutomationActionContext context;

    @BeforeEach
    void setUp() {
        sendMessage = new SendMessageExecutor(messagingService);
        sendCheckinLink = new SendCheckinLinkExecutor(messagingService);
        sendGuide = new SendGuideExecutor(messagingService, welcomeGuideService);
        sendReviewRequest = new SendReviewRequestExecutor(
            messagingService, welcomeGuideService, guestReviewRepository);

        template = new MessageTemplate();
        template.setId(5L);
        template.setName("Template test");

        Property property = new Property();
        property.setId(42L);

        reservation = new Reservation();
        reservation.setId(100L);
        reservation.setProperty(property);
        reservation.setCheckOut(LocalDate.of(2026, 7, 1));

        context = AutomationActionContext.forReservation(ORG_ID, reservation);
    }

    private AutomationRule rule(AutomationAction action, AutomationTrigger trigger) {
        AutomationRule rule = new AutomationRule();
        rule.setId(10L);
        rule.setName("Regle test");
        rule.setActionType(action);
        rule.setTriggerType(trigger);
        rule.setTemplate(template);
        return rule;
    }

    @Test
    void whenSendMessage_thenSendsTemplateViaRuleChannel() {
        AutomationRule rule = rule(AutomationAction.SEND_MESSAGE, AutomationTrigger.CHECK_IN_DAY);
        rule.setDeliveryChannel(MessageChannelType.WHATSAPP);

        ExecutionResult result = sendMessage.execute(rule, context);

        assertThat(result.skipped()).isFalse();
        verify(messagingService).sendForReservationViaChannel(
            reservation, template, ORG_ID, MessageChannelType.WHATSAPP, Map.of());
    }

    @Test
    void whenSendCheckinLink_thenDelegatesToMessagingPipelineWithoutExtraVars() {
        // F3c : le code d'acces et son gating anti-acces anticipe sont resolus par
        // GuestMessagingService (AccessCodeResolverService + StayTimes) — l'executeur
        // ne doit rien injecter qui contourne ce gating.
        AutomationRule rule = rule(AutomationAction.SEND_CHECKIN_LINK, AutomationTrigger.CHECK_IN_APPROACHING);

        ExecutionResult result = sendCheckinLink.execute(rule, context);

        assertThat(result.skipped()).isFalse();
        verify(messagingService).sendForReservationViaChannel(
            reservation, template, ORG_ID, MessageChannelType.EMAIL, Map.of());
    }

    @Test
    void whenSendGuide_thenInjectsGuideLink() {
        AutomationRule rule = rule(AutomationAction.SEND_GUIDE, AutomationTrigger.CHECK_IN_APPROACHING);
        when(welcomeGuideService.linkForReservation(reservation))
            .thenReturn(Optional.of("https://app.clenzy.fr/guide/abc"));

        sendGuide.execute(rule, context);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, String>> vars = ArgumentCaptor.forClass(Map.class);
        verify(messagingService).sendForReservationViaChannel(
            eq(reservation), eq(template), eq(ORG_ID), eq(MessageChannelType.EMAIL), vars.capture());
        assertThat(vars.getValue()).containsEntry("guideLink", "https://app.clenzy.fr/guide/abc");
    }

    @Test
    void whenSendGuideWithoutPublishedGuide_thenThrowsInsteadOfSilentNoop() {
        AutomationRule rule = rule(AutomationAction.SEND_GUIDE, AutomationTrigger.CHECK_IN_APPROACHING);
        when(welcomeGuideService.linkForReservation(reservation)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> sendGuide.execute(rule, context))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("livret");
        verify(messagingService, never()).sendForReservationViaChannel(any(), any(), any(), any(), anyMap());
    }

    @Test
    void whenSendReviewRequest_thenInjectsReviewAndGuideLinks() {
        AutomationRule rule = rule(AutomationAction.SEND_REVIEW_REQUEST, AutomationTrigger.CHECK_OUT_PASSED);
        when(welcomeGuideService.reviewLinkForReservation(reservation))
            .thenReturn(Optional.of("https://app.clenzy.fr/guide/rev"));

        ExecutionResult result = sendReviewRequest.execute(rule, context);

        assertThat(result.skipped()).isFalse();
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, String>> vars = ArgumentCaptor.forClass(Map.class);
        verify(messagingService).sendForReservationViaChannel(
            eq(reservation), eq(template), eq(ORG_ID), eq(MessageChannelType.EMAIL), vars.capture());
        assertThat(vars.getValue())
            .containsEntry("reviewLink", "https://app.clenzy.fr/guide/rev")
            .containsEntry("guideLink", "https://app.clenzy.fr/guide/rev");
    }

    @Test
    void whenReviewReminderAndReviewLinkedToReservation_thenSkipsWithoutSending() {
        AutomationRule rule = rule(AutomationAction.SEND_REVIEW_REQUEST, AutomationTrigger.REVIEW_REMINDER);
        when(guestReviewRepository.existsByReservationIdAndOrganizationId(100L, ORG_ID)).thenReturn(true);

        ExecutionResult result = sendReviewRequest.execute(rule, context);

        assertThat(result.skipped()).isTrue();
        assertThat(result.detail()).contains("Avis deja recu");
        verify(messagingService, never()).sendForReservationViaChannel(any(), any(), any(), any(), anyMap());
    }

    @Test
    void whenReviewReminderAndPropertyReviewAfterCheckout_thenSkips() {
        // Repli OTA : avis sans lien reservation mais poste apres le check-out du sejour.
        AutomationRule rule = rule(AutomationAction.SEND_REVIEW_REQUEST, AutomationTrigger.REVIEW_REMINDER);
        when(guestReviewRepository.existsByReservationIdAndOrganizationId(100L, ORG_ID)).thenReturn(false);
        when(guestReviewRepository.existsByPropertyIdAndOrganizationIdAndReviewDateGreaterThanEqual(
            42L, ORG_ID, LocalDate.of(2026, 7, 1))).thenReturn(true);

        ExecutionResult result = sendReviewRequest.execute(rule, context);

        assertThat(result.skipped()).isTrue();
        verify(messagingService, never()).sendForReservationViaChannel(any(), any(), any(), any(), anyMap());
    }

    @Test
    void whenReviewReminderWithoutAnyReview_thenSendsReviewRequest() {
        AutomationRule rule = rule(AutomationAction.SEND_REVIEW_REQUEST, AutomationTrigger.REVIEW_REMINDER);
        when(guestReviewRepository.existsByReservationIdAndOrganizationId(100L, ORG_ID)).thenReturn(false);
        when(guestReviewRepository.existsByPropertyIdAndOrganizationIdAndReviewDateGreaterThanEqual(
            42L, ORG_ID, LocalDate.of(2026, 7, 1))).thenReturn(false);
        when(welcomeGuideService.reviewLinkForReservation(reservation))
            .thenReturn(Optional.of("https://app.clenzy.fr/guide/rev"));

        ExecutionResult result = sendReviewRequest.execute(rule, context);

        assertThat(result.skipped()).isFalse();
        verify(messagingService).sendForReservationViaChannel(
            eq(reservation), eq(template), eq(ORG_ID), eq(MessageChannelType.EMAIL), anyMap());
    }

    @Test
    void whenTemplateMissing_thenThrowsInsteadOfSilentNoop() {
        AutomationRule rule = rule(AutomationAction.SEND_CHECKIN_LINK, AutomationTrigger.CHECK_IN_DAY);
        rule.setTemplate(null);

        assertThatThrownBy(() -> sendCheckinLink.execute(rule, context))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("template");
        verify(messagingService, never()).sendForReservationViaChannel(any(), any(), any(), any(), anyMap());
    }

    @Test
    void whenSubjectIsNotAReservation_thenThrows() {
        AutomationRule rule = rule(AutomationAction.SEND_MESSAGE, AutomationTrigger.CHECK_IN_DAY);
        AutomationActionContext invoiceContext = new AutomationActionContext(
            ORG_ID, AutomationSubject.TYPE_INVOICE, 55L, Map.of(), null);

        assertThatThrownBy(() -> sendMessage.execute(rule, invoiceContext))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("RESERVATION");
        verify(messagingService, never()).sendForReservationViaChannel(any(), any(), any(), any(), anyMap());
    }
}
