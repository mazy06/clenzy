package com.clenzy.service.email;

import com.clenzy.model.Intervention;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.Property;
import com.clenzy.model.User;
import com.clenzy.service.EmailService;
import com.clenzy.service.NotificationPreferenceService;
import com.clenzy.service.messaging.EmailWrapperService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Moteur Ménage 2B (P5) — email « mission assignée » au pro :
 * montant + escape HTML + respect de la préférence de notification.
 */
@ExtendWith(MockitoExtension.class)
class MissionAssignmentEmailComposerTest {

    @Mock private EmailService emailService;
    @Mock private EmailWrapperService emailWrapperService;
    @Mock private NotificationPreferenceService preferenceService;

    private MissionAssignmentEmailComposer composer;

    @BeforeEach
    void setUp() {
        composer = new MissionAssignmentEmailComposer(emailService, emailWrapperService, preferenceService);
    }

    private Intervention intervention(String title) {
        Property property = new Property();
        property.setId(3L);
        property.setName("Duplex <Marrakech>");
        property.setAddress("12 rue Test");
        property.setCity("Marrakech");
        Intervention intervention = new Intervention();
        intervention.setId(42L);
        intervention.setTitle(title);
        intervention.setType("CLEANING");
        intervention.setScheduledDate(LocalDateTime.of(2026, 7, 15, 11, 0));
        intervention.setEstimatedDurationHours(3);
        intervention.setEstimatedCost(BigDecimal.valueOf(88));
        intervention.setRecommendedCost(BigDecimal.valueOf(95));
        intervention.setProperty(property);
        return intervention;
    }

    private User assignee() {
        User user = new User();
        user.setId(9L);
        user.setKeycloakId("kc-pro");
        user.setEmail("pro@example.com");
        return user;
    }

    @Test
    @DisplayName("assigné user → email composé avec rémunération, adresse et HTML échappé")
    void whenAssigned_thenEmailSentWithAmountAndEscapedHtml() {
        when(preferenceService.isEnabled("kc-pro", NotificationKey.INTERVENTION_ASSIGNED_TO_USER)).thenReturn(true);
        when(emailWrapperService.wrap(anyString(), anyString())).thenAnswer(inv -> inv.getArgument(1));

        composer.sendMissionAssignedEmail(intervention("Menage <script>alert(1)</script>"), assignee());

        ArgumentCaptor<String> html = ArgumentCaptor.forClass(String.class);
        verify(emailService).sendSimpleHtmlEmail(eq("pro@example.com"), anyString(), html.capture());
        String body = html.getValue();
        // Montant résolu (rémunération du pro) + mention écart barème (88 vs 95 → -7 %).
        assertThat(body).contains("88 €");
        assertThat(body).contains("-7 % vs barème conseillé de 95 €");
        // Escape HTML : le script du titre et le nom du logement sont neutralisés.
        assertThat(body).doesNotContain("<script>");
        assertThat(body).contains("&lt;script&gt;");
        assertThat(body).contains("Duplex &lt;Marrakech&gt;");
        // Adresse présente, lien vers l'app présent.
        assertThat(body).contains("12 rue Test");
        assertThat(body).contains("/interventions/42");
    }

    @Test
    @DisplayName("préférence INTERVENTION_ASSIGNED_TO_USER désactivée → pas d'email")
    void whenPreferenceDisabled_thenNoEmail() {
        when(preferenceService.isEnabled("kc-pro", NotificationKey.INTERVENTION_ASSIGNED_TO_USER)).thenReturn(false);

        composer.sendMissionAssignedEmail(intervention("Menage"), assignee());

        verify(emailService, never()).sendSimpleHtmlEmail(any(), any(), any());
    }

    @Test
    @DisplayName("assigné sans email → rien (best-effort silencieux)")
    void whenNoEmail_thenSkipped() {
        User user = assignee();
        user.setEmail(null);

        composer.sendMissionAssignedEmail(intervention("Menage"), user);

        verify(emailService, never()).sendSimpleHtmlEmail(any(), any(), any());
    }

    @Test
    @DisplayName("montant conforme au barème → mention « conforme »")
    void whenAmountOnScale_thenConformMention() {
        when(preferenceService.isEnabled(anyString(), any())).thenReturn(true);
        when(emailWrapperService.wrap(anyString(), anyString())).thenAnswer(inv -> inv.getArgument(1));
        Intervention conforme = intervention("Menage");
        conforme.setEstimatedCost(BigDecimal.valueOf(95));

        composer.sendMissionAssignedEmail(conforme, assignee());

        ArgumentCaptor<String> html = ArgumentCaptor.forClass(String.class);
        verify(emailService).sendSimpleHtmlEmail(any(), any(), html.capture());
        assertThat(html.getValue()).contains("conforme au barème conseillé");
    }
}
