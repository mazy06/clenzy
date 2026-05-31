package com.clenzy.service.messaging;

import com.clenzy.exception.NotFoundException;
import com.clenzy.model.SystemEmailTemplate;
import com.clenzy.repository.SystemEmailTemplateRepository;
import org.junit.jupiter.api.BeforeEach;
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
class SystemEmailTemplateServiceTest {

    @Mock private SystemEmailTemplateRepository repository;

    @InjectMocks
    private SystemEmailTemplateService service;

    private static final Long ORG_ID = 42L;

    private SystemEmailTemplate systemTemplate() {
        SystemEmailTemplate t = new SystemEmailTemplate();
        t.setId(1L);
        t.setOrganizationId(null);
        t.setTemplateKey("noise_alert_owner");
        t.setLanguage("fr");
        t.setRecipientType("OWNER");
        t.setSubject("Alerte bruit");
        t.setBody("Body systeme");
        t.setWrapperStyle("NOTIFICATION_OWNER");
        t.setSystem(true);
        return t;
    }

    private SystemEmailTemplate orgOverride() {
        SystemEmailTemplate t = new SystemEmailTemplate(
            ORG_ID, "noise_alert_owner", "fr", "OWNER",
            "Sujet custom", "Body custom", "NOTIFICATION_OWNER", 1L);
        t.setId(10L);
        return t;
    }

    // ----- resolve -----

    @Test
    void resolve_orgOverride_winsOverSystem() {
        SystemEmailTemplate override = orgOverride();
        when(repository.findResolutionCandidates("noise_alert_owner", "fr", ORG_ID))
            .thenReturn(List.of(override, systemTemplate()));

        Optional<SystemEmailTemplate> result = service.resolve(ORG_ID, "noise_alert_owner", "fr");

        assertThat(result).contains(override);
    }

    @Test
    void resolve_noOverride_returnsSystem() {
        SystemEmailTemplate system = systemTemplate();
        when(repository.findResolutionCandidates("noise_alert_owner", "fr", ORG_ID))
            .thenReturn(List.of(system));

        Optional<SystemEmailTemplate> result = service.resolve(ORG_ID, "noise_alert_owner", "fr");

        assertThat(result).contains(system);
    }

    @Test
    void resolve_noResult_returnsEmpty() {
        when(repository.findResolutionCandidates(any(), any(), any())).thenReturn(List.of());

        assertThat(service.resolve(ORG_ID, "unknown_key", "fr")).isEmpty();
    }

    @Test
    void resolve_nullOrgId_passesMinusOne() {
        SystemEmailTemplate system = systemTemplate();
        when(repository.findResolutionCandidates("noise_alert_owner", "fr", -1L))
            .thenReturn(List.of(system));

        Optional<SystemEmailTemplate> result = service.resolve(null, "noise_alert_owner", "fr");

        assertThat(result).contains(system);
        verify(repository).findResolutionCandidates("noise_alert_owner", "fr", -1L);
    }

    // ----- listGroupedForOrg -----

    @Test
    void listGroupedForOrg_returnsMapKeyedByTemplateKeyAndLanguage() {
        SystemEmailTemplate override = orgOverride(); // noise_alert_owner / fr (override)
        SystemEmailTemplate sysEn = systemTemplate(); // noise_alert_owner / fr (system)
        SystemEmailTemplate other = new SystemEmailTemplate();
        other.setTemplateKey("invitation_organization");
        other.setLanguage("en");
        other.setSystem(true);

        when(repository.findAllVisibleForOrg(ORG_ID)).thenReturn(List.of(override, sysEn, other));

        Map<String, Map<String, SystemEmailTemplate>> result = service.listGroupedForOrg(ORG_ID);

        assertThat(result).containsOnlyKeys("noise_alert_owner", "invitation_organization");
        assertThat(result.get("noise_alert_owner")).containsOnlyKeys("fr");
        // First put wins (override over system because of repo ordering)
        assertThat(result.get("noise_alert_owner").get("fr")).isEqualTo(override);
        assertThat(result.get("invitation_organization")).containsOnlyKeys("en");
    }

    @Test
    void listGroupedForOrg_nullOrgId_throws() {
        assertThatThrownBy(() -> service.listGroupedForOrg(null))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("organizationId");
    }

    // ----- upsertOverride -----

    @Test
    void upsertOverride_existing_updatesSubjectAndBody() {
        SystemEmailTemplate existing = orgOverride();
        when(repository.findByOrganizationIdAndTemplateKeyAndLanguage(ORG_ID, "noise_alert_owner", "fr"))
            .thenReturn(Optional.of(existing));
        when(repository.save(any(SystemEmailTemplate.class))).thenAnswer(inv -> inv.getArgument(0));

        SystemEmailTemplate result = service.upsertOverride(ORG_ID, "noise_alert_owner", "fr",
            "Nouveau sujet", "Nouveau body");

        assertThat(result.getSubject()).isEqualTo("Nouveau sujet");
        assertThat(result.getBody()).isEqualTo("Nouveau body");
        verify(repository, never()).findSystemTemplate(any(), any());
    }

    @Test
    void upsertOverride_new_createsForkFromSystemParent() {
        when(repository.findByOrganizationIdAndTemplateKeyAndLanguage(ORG_ID, "noise_alert_owner", "fr"))
            .thenReturn(Optional.empty());
        when(repository.findSystemTemplate("noise_alert_owner", "fr"))
            .thenReturn(Optional.of(systemTemplate()));
        when(repository.save(any(SystemEmailTemplate.class))).thenAnswer(inv -> {
            SystemEmailTemplate t = inv.getArgument(0);
            t.setId(99L);
            return t;
        });

        SystemEmailTemplate result = service.upsertOverride(ORG_ID, "noise_alert_owner", "fr",
            "Subj", "Body");

        assertThat(result.getOrganizationId()).isEqualTo(ORG_ID);
        assertThat(result.getSubject()).isEqualTo("Subj");
        assertThat(result.getBody()).isEqualTo("Body");
        assertThat(result.getRecipientType()).isEqualTo("OWNER");
        assertThat(result.getWrapperStyle()).isEqualTo("NOTIFICATION_OWNER");
        assertThat(result.getParentTemplateId()).isEqualTo(1L);
        assertThat(result.isSystem()).isFalse();
    }

    @Test
    void upsertOverride_new_noSystemParent_throws() {
        when(repository.findByOrganizationIdAndTemplateKeyAndLanguage(ORG_ID, "unknown", "fr"))
            .thenReturn(Optional.empty());
        when(repository.findSystemTemplate("unknown", "fr")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.upsertOverride(ORG_ID, "unknown", "fr", "S", "B"))
            .isInstanceOf(NotFoundException.class)
            .hasMessageContaining("template systeme");
    }

    @Test
    void upsertOverride_nullOrgId_throws() {
        assertThatThrownBy(() -> service.upsertOverride(null, "k", "fr", "s", "b"))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void upsertOverride_nullSubject_throws() {
        assertThatThrownBy(() -> service.upsertOverride(ORG_ID, "k", "fr", null, "b"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("subject");
    }

    @Test
    void upsertOverride_blankSubject_throws() {
        assertThatThrownBy(() -> service.upsertOverride(ORG_ID, "k", "fr", "   ", "b"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("subject");
    }

    @Test
    void upsertOverride_subjectTooLong_throws() {
        String tooLong = "x".repeat(256);
        assertThatThrownBy(() -> service.upsertOverride(ORG_ID, "k", "fr", tooLong, "b"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("255");
    }

    @Test
    void upsertOverride_nullBody_throws() {
        assertThatThrownBy(() -> service.upsertOverride(ORG_ID, "k", "fr", "s", null))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("body");
    }

    @Test
    void upsertOverride_blankBody_throws() {
        assertThatThrownBy(() -> service.upsertOverride(ORG_ID, "k", "fr", "s", "  "))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("body");
    }

    @Test
    void upsertOverride_bodyTooLong_throws() {
        String tooLong = "x".repeat(100001);
        assertThatThrownBy(() -> service.upsertOverride(ORG_ID, "k", "fr", "s", tooLong))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("100000");
    }

    // ----- removeOverride -----

    @Test
    void removeOverride_existing_deletes() {
        SystemEmailTemplate override = orgOverride();
        when(repository.findByOrganizationIdAndTemplateKeyAndLanguage(ORG_ID, "noise_alert_owner", "fr"))
            .thenReturn(Optional.of(override));

        service.removeOverride(ORG_ID, "noise_alert_owner", "fr");

        verify(repository).delete(override);
    }

    @Test
    void removeOverride_notFound_throws() {
        when(repository.findByOrganizationIdAndTemplateKeyAndLanguage(ORG_ID, "missing", "fr"))
            .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.removeOverride(ORG_ID, "missing", "fr"))
            .isInstanceOf(NotFoundException.class)
            .hasMessageContaining("override");
    }

    @Test
    void removeOverride_isSystem_throws() {
        SystemEmailTemplate sysWithOrg = systemTemplate();
        sysWithOrg.setOrganizationId(ORG_ID);
        sysWithOrg.setSystem(true);
        when(repository.findByOrganizationIdAndTemplateKeyAndLanguage(ORG_ID, "noise_alert_owner", "fr"))
            .thenReturn(Optional.of(sysWithOrg));

        assertThatThrownBy(() -> service.removeOverride(ORG_ID, "noise_alert_owner", "fr"))
            .isInstanceOf(AccessDeniedException.class);

        verify(repository, never()).delete(any(SystemEmailTemplate.class));
    }

    @Test
    void removeOverride_nullOrgId_throws() {
        assertThatThrownBy(() -> service.removeOverride(null, "k", "fr"))
            .isInstanceOf(IllegalArgumentException.class);
    }
}
