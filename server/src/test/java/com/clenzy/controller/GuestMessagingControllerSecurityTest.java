package com.clenzy.controller;

import com.clenzy.dto.GuestMessageLogDto;
import com.clenzy.dto.MessagingAutomationConfigDto;
import com.clenzy.model.GuestMessageLog;
import com.clenzy.model.MessageChannelType;
import com.clenzy.model.MessageStatus;
import com.clenzy.model.MessageTemplate;
import com.clenzy.model.MessageTemplateType;
import com.clenzy.model.MessagingAutomationConfig;
import com.clenzy.dto.SendManualMessageRequest;
import com.clenzy.service.messaging.GuestMessagingQueryService;
import com.clenzy.service.messaging.GuestMessagingService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.test.context.support.WithAnonymousUser;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Verifie la regle {@code @PreAuthorize} de
 * {@link GuestMessagingController#resendMessage} : le renvoi d'un message
 * voyageur est reserve aux roles d'administration d'org, les roles
 * operationnels gardent la lecture de l'historique.
 *
 * <p><b>Regression couverte</b> : l'expression portait
 * {@code or @organizationSecurityService.isOrgAdmin()}, un bean qui n'a jamais
 * existe dans le depot. L'expression court-circuitait pour SUPER_ADMIN et
 * SUPER_MANAGER — seuls profils pour lesquels elle etait donc testable a la
 * main — mais tout autre profil declenchait l'evaluation du terme droit, donc
 * une erreur SpEL remontee en 500 : ni un refus, ni l'acces que la regle
 * pretendait ouvrir aux administrateurs d'organisation. D'ou l'insistance des
 * tests ci-dessous sur le <b>type</b> de l'echec ({@link AccessDeniedException})
 * et pas seulement sur le fait qu'il echoue.</p>
 *
 * <p>{@link GuestMessagingControllerTest} couvre le comportement de la methode
 * mais l'appelle sans method security active : aucun test ne pouvait y voir
 * l'expression cassee.</p>
 */
@SpringJUnitConfig(GuestMessagingControllerSecurityTest.Config.class)
class GuestMessagingControllerSecurityTest {

    @Configuration
    @EnableMethodSecurity
    static class Config {
        @Bean
        GuestMessagingQueryService queryService() {
            return Mockito.mock(GuestMessagingQueryService.class);
        }

        @Bean
        GuestMessagingService messagingService() {
            return Mockito.mock(GuestMessagingService.class);
        }

        @Bean
        TenantContext tenantContext() {
            return Mockito.mock(TenantContext.class);
        }

        @Bean
        GuestMessagingController controller(GuestMessagingQueryService queryService,
                                            GuestMessagingService messagingService,
                                            TenantContext tenantContext) {
            return new GuestMessagingController(queryService, messagingService, tenantContext);
        }
    }

    @Autowired private GuestMessagingController controller;
    @Autowired private GuestMessagingQueryService queryService;
    @Autowired private GuestMessagingService messagingService;
    @Autowired private TenantContext tenantContext;

    private static final Long ORG_ID = 1L;
    private static final Long LOG_ID = 1L;

    @BeforeEach
    void resetMocks() {
        Mockito.reset(queryService, messagingService, tenantContext);
    }

    /**
     * Journal minimal : {@code reservationId} et {@code templateId} sont
     * derives des relations JPA (lecture seule), le renvoi part donc avec des
     * identifiants nuls — sans incidence ici, le service etant mocke.
     */
    private GuestMessageLog logEntry() {
        MessageTemplate template = new MessageTemplate();
        template.setId(10L);
        template.setName("Check-In Template");
        template.setType(MessageTemplateType.CHECK_IN);

        GuestMessageLog log = new GuestMessageLog();
        log.setId(LOG_ID);
        log.setOrganizationId(ORG_ID);
        log.setTemplate(template);
        log.setChannel(MessageChannelType.EMAIL);
        log.setRecipient("guest@example.com");
        log.setSubject("Bienvenue");
        log.setStatus(MessageStatus.SENT);
        return log;
    }

    /** Reglage minimal : le contenu importe peu, seul le garde est teste ici. */
    private MessagingAutomationConfigDto configDto() {
        return new MessagingAutomationConfigDto(
            true, false, 24, 2, null, null, false, "22:00", "08:00");
    }

    /** Laisse le renvoi aboutir : n'est atteint que si le garde a cede. */
    private void givenResendSucceeds() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
        when(queryService.findLogForOrganization(LOG_ID, ORG_ID)).thenReturn(Optional.of(logEntry()));
        when(messagingService.sendMessage(any(), any(), anyLong())).thenReturn(logEntry());
    }

    // ── Refus : roles operationnels ──────────────────────────────────────────

    @Test
    @WithMockUser(roles = "HOUSEKEEPER")
    @DisplayName("un profil non autorise recoit un refus d'acces, pas une erreur serveur")
    void whenHousekeeperResends_thenAccessDenied() {
        assertThatThrownBy(() -> controller.resendMessage(LOG_ID))
            .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(messagingService, queryService);
    }

    @Test
    @WithMockUser(roles = "TECHNICIAN")
    void whenTechnicianResends_thenAccessDenied() {
        assertThatThrownBy(() -> controller.resendMessage(LOG_ID))
            .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(messagingService, queryService);
    }

    @Test
    @WithMockUser(roles = "SUPERVISOR")
    void whenSupervisorResends_thenAccessDenied() {
        assertThatThrownBy(() -> controller.resendMessage(LOG_ID))
            .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(messagingService, queryService);
    }

    @Test
    @WithMockUser(roles = "LAUNDRY")
    void whenLaundryResends_thenAccessDenied() {
        assertThatThrownBy(() -> controller.resendMessage(LOG_ID))
            .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(messagingService, queryService);
    }

    @Test
    @WithAnonymousUser
    @DisplayName("sans authentification, le garde de classe refuse avant toute lecture")
    void whenAnonymousResends_thenRejected() {
        assertThatThrownBy(() -> controller.resendMessage(LOG_ID))
            .isInstanceOfAny(AccessDeniedException.class,
                             AuthenticationCredentialsNotFoundException.class);
        verifyNoInteractions(messagingService, queryService);
    }

    // ── Acces : administration d'org ─────────────────────────────────────────

    @Test
    @WithMockUser(roles = "HOST")
    @DisplayName("HOST renvoie — c'est le profil que l'expression cassee excluait")
    void whenHostResends_thenAllowed() {
        givenResendSucceeds();

        ResponseEntity<GuestMessageLogDto> response = controller.resendMessage(LOG_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Mockito.verify(messagingService).sendMessage(any(), any(), eq(ORG_ID));
    }

    @Test
    @WithMockUser(roles = "SUPER_ADMIN")
    void whenSuperAdminResends_thenAllowed() {
        givenResendSucceeds();

        assertThat(controller.resendMessage(LOG_ID).getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    @WithMockUser(roles = "SUPER_MANAGER")
    void whenSuperManagerResends_thenAllowed() {
        givenResendSucceeds();

        assertThat(controller.resendMessage(LOG_ID).getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    // ── Envoi manuel : meme garde, sinon le renvoi se contourne ──────────────

    @Test
    @WithMockUser(roles = "HOUSEKEEPER")
    @DisplayName("un profil non autorise ne peut pas non plus envoyer un message neuf")
    void whenHousekeeperSends_thenAccessDenied() {
        assertThatThrownBy(() -> controller.sendMessage(new SendManualMessageRequest(1L, 10L, "EMAIL")))
            .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(messagingService);
    }

    @Test
    @WithMockUser(roles = "SUPERVISOR")
    @DisplayName("SUPERVISOR atteint le planning mais ne parle pas au voyageur")
    void whenSupervisorSends_thenAccessDenied() {
        assertThatThrownBy(() -> controller.sendMessage(new SendManualMessageRequest(1L, 10L, "EMAIL")))
            .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(messagingService);
    }

    @Test
    @WithMockUser(roles = "HOST")
    void whenHostSends_thenAllowed() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
        when(messagingService.sendMessage(anyLong(), anyLong(), anyLong(), any())).thenReturn(logEntry());

        ResponseEntity<GuestMessageLogDto> response =
            controller.sendMessage(new SendManualMessageRequest(1L, 10L, "EMAIL"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    // ── Reglage de l'automatisation ──────────────────────────────────────────

    @Test
    @WithMockUser(roles = "TECHNICIAN")
    @DisplayName("un profil non autorise ne regle pas l'automatisation")
    void whenTechnicianUpdatesConfig_thenAccessDenied() {
        assertThatThrownBy(() -> controller.updateConfig(configDto()))
            .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(queryService);
    }

    @Test
    @WithMockUser(roles = "HOST")
    void whenHostUpdatesConfig_thenAllowed() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
        when(queryService.updateConfig(eq(ORG_ID), any())).thenReturn(new MessagingAutomationConfig(ORG_ID));

        assertThat(controller.updateConfig(configDto()).getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    @WithMockUser(roles = "TECHNICIAN")
    @DisplayName("lire la configuration reste ouvert : seule l'ecriture est gardee")
    void whenTechnicianReadsConfig_thenAllowed() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
        when(queryService.getConfigOrDefault(ORG_ID)).thenReturn(new MessagingAutomationConfig(ORG_ID));

        assertThat(controller.getConfig().getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    // ── Le garde ne deborde pas sur la lecture ───────────────────────────────

    @Test
    @WithMockUser(roles = "HOUSEKEEPER")
    @DisplayName("l'historique reste lisible par les roles operationnels")
    void whenHousekeeperReadsHistory_thenAllowed() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
        when(queryService.getHistory(ORG_ID)).thenReturn(List.of(logEntry()));

        assertThat(controller.getHistory()).hasSize(1);
    }
}
