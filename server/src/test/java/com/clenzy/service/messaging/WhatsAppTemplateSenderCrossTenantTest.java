package com.clenzy.service.messaging;

import com.clenzy.model.Conversation;
import com.clenzy.model.Reservation;
import com.clenzy.repository.ConversationRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.access.OrganizationAccessGuard;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.access.AccessDeniedException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Isolation multi-tenant des envois WhatsApp — audit sécurité 2026-07-26, constat P1-11.
 *
 * <p>L'organisation utilisée pour l'envoi était celle portée par l'entité chargée
 * ({@code conv.getOrganizationId()}), jamais confrontée au {@code TenantContext} — alors
 * que tous les autres endpoints de {@code ConversationController} passent explicitement
 * {@code tenantContext.getRequiredOrganizationId()}.
 *
 * <p>La conséquence dépasse la lecture : l'appel déclenchait un <b>envoi réel</b> au
 * voyageur d'un autre tenant, y compris le template {@code checkin_instructions} qui
 * contient les codes d'accès au logement.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("WhatsAppTemplateSender — isolation multi-tenant (P1-11)")
class WhatsAppTemplateSenderCrossTenantTest {

    private static final Long ORG_COURANTE = 1L;
    private static final Long ORG_VICTIME = 2L;

    @Mock private ConversationRepository conversationRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private com.clenzy.repository.CheckInInstructionsRepository instructionsRepository;
    @Mock private com.clenzy.service.messaging.ConversationService conversationService;
    @Mock private com.clenzy.service.messaging.whatsapp.WhatsAppTemplateService templateService;
    @Mock private com.clenzy.service.messaging.TemplateInterpolationService interpolation;
    @Mock private com.clenzy.service.messaging.whatsapp.WhatsAppVariableConverter variableConverter;
    @Mock private com.clenzy.service.messaging.WhatsAppChannel whatsAppChannel;

    private WhatsAppTemplateSender sender;

    @BeforeEach
    void setUp() {
        TenantContext contexte = new TenantContext();
        contexte.setOrganizationId(ORG_COURANTE);
        sender = new WhatsAppTemplateSender(conversationRepository, reservationRepository,
                instructionsRepository, conversationService, templateService, interpolation,
                variableConverter, whatsAppChannel, new OrganizationAccessGuard(contexte));
    }

    @Test
    @DisplayName("envoyer sur la conversation d'une autre organisation est refusé")
    void sendTemplate_conversationHorsOrganisation_refuse() {
        Conversation conv = new Conversation();
        conv.setId(10L);
        conv.setOrganizationId(ORG_VICTIME);
        when(conversationRepository.findById(10L)).thenReturn(Optional.of(conv));

        assertThatThrownBy(() -> sender.sendTemplate(10L, "checkin_instructions", "Attaquant", "kc-1"))
                .isInstanceOf(AccessDeniedException.class);

        // Le refus doit précéder l'effet externe : aucun message ne part chez l'opérateur.
        verify(whatsAppChannel, never()).sendTemplate(any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("envoyer depuis la réservation d'une autre organisation est refusé")
    void sendTemplateForReservation_reservationHorsOrganisation_refuse() {
        Reservation res = new Reservation();
        res.setId(20L);
        res.setOrganizationId(ORG_VICTIME);
        when(reservationRepository.findById(20L)).thenReturn(Optional.of(res));

        assertThatThrownBy(() -> sender.sendTemplateForReservation(
                20L, "checkin_instructions", "Attaquant", "kc-1"))
                .isInstanceOf(AccessDeniedException.class);

        verify(conversationService, never()).getOrCreateForReservation(any(), any(), any(), any(), any(), any());
        verify(whatsAppChannel, never()).sendTemplate(any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("une conversation sans organisation est refusée — fail-closed")
    void sendTemplate_conversationSansOrganisation_refuse() {
        Conversation conv = new Conversation();
        conv.setId(10L);
        when(conversationRepository.findById(10L)).thenReturn(Optional.of(conv));

        assertThatThrownBy(() -> sender.sendTemplate(10L, "checkin_instructions", "X", "kc-1"))
                .isInstanceOf(AccessDeniedException.class);
    }
}
