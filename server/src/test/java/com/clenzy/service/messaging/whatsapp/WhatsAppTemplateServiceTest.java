package com.clenzy.service.messaging.whatsapp;

import com.clenzy.exception.NotFoundException;
import com.clenzy.model.WhatsAppTemplateContent;
import com.clenzy.repository.WhatsAppTemplateContentRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WhatsAppTemplateServiceTest {

    @Mock private WhatsAppTemplateContentRepository repository;

    @InjectMocks
    private WhatsAppTemplateService service;

    private static final Long ORG_ID = 42L;

    private WhatsAppTemplateContent systemTemplate() {
        WhatsAppTemplateContent t = new WhatsAppTemplateContent();
        t.setId(1L);
        t.setOrganizationId(null);
        t.setTemplateKey("checkin_instructions");
        t.setLanguage("fr_FR");
        t.setCategory("UTILITY");
        t.setBodyNamed("Bienvenue {guestFirstName}");
        t.setSystem(true);
        return t;
    }

    private WhatsAppTemplateContent override() {
        WhatsAppTemplateContent t = new WhatsAppTemplateContent(
            ORG_ID, "checkin_instructions", "fr_FR", "UTILITY", "Custom {guestFirstName}", 1L);
        t.setId(10L);
        return t;
    }

    // ----- resolve -----

    @Test
    void resolve_orgOverride_winsOverSystem() {
        WhatsAppTemplateContent ovr = override();
        when(repository.findResolutionCandidates("checkin_instructions", "fr_FR", ORG_ID))
            .thenReturn(List.of(ovr, systemTemplate()));

        Optional<WhatsAppTemplateContent> result = service.resolve(ORG_ID, "checkin_instructions", "fr_FR");

        assertThat(result).contains(ovr);
    }

    @Test
    void resolve_systemFallback_whenNoOverride() {
        WhatsAppTemplateContent sys = systemTemplate();
        when(repository.findResolutionCandidates("checkin_instructions", "fr_FR", ORG_ID))
            .thenReturn(List.of(sys));

        assertThat(service.resolve(ORG_ID, "checkin_instructions", "fr_FR")).contains(sys);
    }

    @Test
    void resolve_noResult_returnsEmpty() {
        when(repository.findResolutionCandidates(any(), any(), any())).thenReturn(List.of());

        assertThat(service.resolve(ORG_ID, "missing", "fr_FR")).isEmpty();
    }

    @Test
    void resolve_nullOrgId_throws() {
        assertThatThrownBy(() -> service.resolve(null, "k", "fr_FR"))
            .isInstanceOf(IllegalArgumentException.class);
    }

    // ----- listGroupedForOrg -----

    @Test
    void listGroupedForOrg_dedupsByKeyAndLang() {
        WhatsAppTemplateContent ovr = override();
        WhatsAppTemplateContent sys = systemTemplate();
        WhatsAppTemplateContent other = new WhatsAppTemplateContent();
        other.setTemplateKey("arrival_code");
        other.setLanguage("en_US");
        other.setSystem(true);

        when(repository.findAllVisibleForOrg(ORG_ID)).thenReturn(List.of(ovr, sys, other));

        Map<String, Map<String, WhatsAppTemplateContent>> result = service.listGroupedForOrg(ORG_ID);

        assertThat(result).containsOnlyKeys("checkin_instructions", "arrival_code");
        assertThat(result.get("checkin_instructions").get("fr_FR")).isEqualTo(ovr);
        assertThat(result.get("arrival_code").get("en_US")).isEqualTo(other);
    }

    @Test
    void listGroupedForOrg_nullOrgId_throws() {
        assertThatThrownBy(() -> service.listGroupedForOrg(null))
            .isInstanceOf(IllegalArgumentException.class);
    }

    // ----- upsertOverride -----

    @Test
    void upsertOverride_existing_updatesBody() {
        WhatsAppTemplateContent existing = override();
        when(repository.findByOrganizationIdAndTemplateKeyAndLanguage(ORG_ID, "checkin_instructions", "fr_FR"))
            .thenReturn(Optional.of(existing));
        when(repository.save(any(WhatsAppTemplateContent.class))).thenAnswer(inv -> inv.getArgument(0));

        WhatsAppTemplateContent result = service.upsertOverride(ORG_ID, "checkin_instructions", "fr_FR",
            "Updated body");

        assertThat(result.getBodyNamed()).isEqualTo("Updated body");
        verify(repository, never()).findSystemTemplate(any(), any());
    }

    @Test
    void upsertOverride_new_forksFromSystemParent() {
        when(repository.findByOrganizationIdAndTemplateKeyAndLanguage(ORG_ID, "checkin_instructions", "fr_FR"))
            .thenReturn(Optional.empty());
        when(repository.findSystemTemplate("checkin_instructions", "fr_FR"))
            .thenReturn(Optional.of(systemTemplate()));
        when(repository.save(any(WhatsAppTemplateContent.class))).thenAnswer(inv -> {
            WhatsAppTemplateContent t = inv.getArgument(0);
            t.setId(99L);
            return t;
        });

        WhatsAppTemplateContent result = service.upsertOverride(ORG_ID, "checkin_instructions", "fr_FR",
            "New body");

        assertThat(result.getOrganizationId()).isEqualTo(ORG_ID);
        assertThat(result.getCategory()).isEqualTo("UTILITY");
        assertThat(result.getBodyNamed()).isEqualTo("New body");
        assertThat(result.getParentTemplateId()).isEqualTo(1L);
        assertThat(result.isSystem()).isFalse();
    }

    @Test
    void upsertOverride_new_noSystemParent_throws() {
        when(repository.findByOrganizationIdAndTemplateKeyAndLanguage(ORG_ID, "missing", "fr_FR"))
            .thenReturn(Optional.empty());
        when(repository.findSystemTemplate("missing", "fr_FR")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.upsertOverride(ORG_ID, "missing", "fr_FR", "body"))
            .isInstanceOf(NotFoundException.class);
    }

    @Test
    void upsertOverride_nullOrgId_throws() {
        assertThatThrownBy(() -> service.upsertOverride(null, "k", "fr_FR", "b"))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void upsertOverride_nullBody_throws() {
        assertThatThrownBy(() -> service.upsertOverride(ORG_ID, "k", "fr_FR", null))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void upsertOverride_blankBody_throws() {
        assertThatThrownBy(() -> service.upsertOverride(ORG_ID, "k", "fr_FR", "   "))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void upsertOverride_bodyTooLong_throws() {
        String tooLong = "x".repeat(1025);
        assertThatThrownBy(() -> service.upsertOverride(ORG_ID, "k", "fr_FR", tooLong))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("1024");
    }

    // ----- removeOverride -----

    @Test
    void removeOverride_existing_deletes() {
        WhatsAppTemplateContent ovr = override();
        when(repository.findByOrganizationIdAndTemplateKeyAndLanguage(ORG_ID, "checkin_instructions", "fr_FR"))
            .thenReturn(Optional.of(ovr));

        service.removeOverride(ORG_ID, "checkin_instructions", "fr_FR");

        verify(repository).delete(ovr);
    }

    @Test
    void removeOverride_notFound_throws() {
        when(repository.findByOrganizationIdAndTemplateKeyAndLanguage(ORG_ID, "missing", "fr_FR"))
            .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.removeOverride(ORG_ID, "missing", "fr_FR"))
            .isInstanceOf(NotFoundException.class);
    }

    @Test
    void removeOverride_isSystem_throws() {
        WhatsAppTemplateContent inconsistent = override();
        inconsistent.setSystem(true);
        when(repository.findByOrganizationIdAndTemplateKeyAndLanguage(ORG_ID, "checkin_instructions", "fr_FR"))
            .thenReturn(Optional.of(inconsistent));

        assertThatThrownBy(() -> service.removeOverride(ORG_ID, "checkin_instructions", "fr_FR"))
            .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void removeOverride_nullOrgId_throws() {
        assertThatThrownBy(() -> service.removeOverride(null, "k", "fr_FR"))
            .isInstanceOf(IllegalArgumentException.class);
    }

    // ----- assertEditable -----

    @Test
    void assertEditable_orgOwnedTemplate_passes() {
        WhatsAppTemplateContent ovr = override();
        service.assertEditable(ovr, ORG_ID);
    }

    @Test
    void assertEditable_systemTemplate_throws() {
        WhatsAppTemplateContent sys = systemTemplate();
        assertThatThrownBy(() -> service.assertEditable(sys, ORG_ID))
            .isInstanceOf(AccessDeniedException.class)
            .hasMessageContaining("systeme");
    }

    @Test
    void assertEditable_otherOrgTemplate_throws() {
        WhatsAppTemplateContent foreign = override();
        foreign.setOrganizationId(999L);

        assertThatThrownBy(() -> service.assertEditable(foreign, ORG_ID))
            .isInstanceOf(AccessDeniedException.class)
            .hasMessageContaining("appartient pas");
    }

    @Test
    void assertEditable_nullOrgId_throws() {
        WhatsAppTemplateContent c = override();
        c.setOrganizationId(null);
        c.setSystem(false);

        assertThatThrownBy(() -> service.assertEditable(c, ORG_ID))
            .isInstanceOf(AccessDeniedException.class);
    }
}
