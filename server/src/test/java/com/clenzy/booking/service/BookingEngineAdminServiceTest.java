package com.clenzy.booking.service;

import com.clenzy.booking.dto.BookingEngineAdminConfigDto;
import com.clenzy.booking.model.BookingEngineConfig;
import com.clenzy.booking.repository.BookingEngineConfigRepository;
import com.clenzy.model.Organization;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link BookingEngineAdminService}.
 * Covers single-config legacy path, multi-template CRUD, cross-org listing,
 * toggle, and API key rotation.
 */
@ExtendWith(MockitoExtension.class)
class BookingEngineAdminServiceTest {

    private static final Long ORG_ID = 5L;

    @Mock private BookingEngineConfigRepository configRepository;
    @Mock private OrganizationRepository organizationRepository;
    @Mock private TenantContext tenantContext;

    private BookingEngineAdminService service;

    @BeforeEach
    void setUp() {
        service = new BookingEngineAdminService(configRepository, organizationRepository, tenantContext);
    }

    // ─── helpers ─────────────────────────────────────────────────────────

    private BookingEngineConfig cfg(Long id, Long orgId, String name) {
        BookingEngineConfig c = new BookingEngineConfig();
        c.setId(id);
        c.setOrganizationId(orgId);
        c.setName(name);
        c.setApiKey("key-" + id);
        c.setEnabled(true);
        return c;
    }

    private BookingEngineAdminConfigDto dto(String name) {
        return new BookingEngineAdminConfigDto(
                null, null, name, false, null,
                "#fff", "#000", "https://logo", "Inter",
                "fr", "EUR", 1, 365,
                "cancel", "https://t", "https://p",
                "https://a",
                true, false, true, true,
                "css", "js", "{}",
                "[]",
                "1,2",
                "{}", "https://src", null,
                "bottom", "tgt", "after",
                null
        );
    }

    // ─── getConfig (legacy) ───────────────────────────────────────────────

    @Nested
    @DisplayName("getConfig (legacy)")
    class GetConfig {

        @Test
        @DisplayName("returns first config when one or more exist")
        void returnsFirst() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            BookingEngineConfig c1 = cfg(1L, ORG_ID, "A");
            BookingEngineConfig c2 = cfg(2L, ORG_ID, "B");
            when(configRepository.findAllByOrganizationId(ORG_ID)).thenReturn(List.of(c1, c2));

            BookingEngineAdminConfigDto result = service.getConfig();

            assertThat(result.id()).isEqualTo(1L);
            assertThat(result.name()).isEqualTo("A");
            verify(configRepository, never()).save(any());
        }

        @Test
        @DisplayName("auto-creates Default config when none exist")
        void autoCreatesDefault() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(configRepository.findAllByOrganizationId(ORG_ID)).thenReturn(List.of());
            when(configRepository.save(any(BookingEngineConfig.class))).thenAnswer(inv -> {
                BookingEngineConfig c = inv.getArgument(0);
                c.setId(100L);
                return c;
            });

            BookingEngineAdminConfigDto result = service.getConfig();

            assertThat(result.id()).isEqualTo(100L);
            assertThat(result.name()).isEqualTo("Default");

            ArgumentCaptor<BookingEngineConfig> captor = ArgumentCaptor.forClass(BookingEngineConfig.class);
            verify(configRepository).save(captor.capture());
            BookingEngineConfig saved = captor.getValue();
            assertThat(saved.getOrganizationId()).isEqualTo(ORG_ID);
            assertThat(saved.getApiKey()).isNotBlank();
            // valid UUID
            UUID.fromString(saved.getApiKey());
        }
    }

    // ─── listConfigs ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("listConfigs")
    class ListConfigs {

        @Test
        @DisplayName("returns DTOs for all existing configs")
        void returnsAll() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(configRepository.findAllByOrganizationId(ORG_ID))
                    .thenReturn(List.of(cfg(1L, ORG_ID, "A"), cfg(2L, ORG_ID, "B")));

            List<BookingEngineAdminConfigDto> result = service.listConfigs();
            assertThat(result).extracting(BookingEngineAdminConfigDto::name).containsExactly("A", "B");
            verify(configRepository, never()).save(any());
        }

        @Test
        @DisplayName("auto-creates Default and returns list when none exist")
        void autoCreatesWhenEmpty() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(configRepository.findAllByOrganizationId(ORG_ID)).thenReturn(List.of());
            when(configRepository.save(any(BookingEngineConfig.class))).thenAnswer(inv -> {
                BookingEngineConfig c = inv.getArgument(0);
                c.setId(50L);
                return c;
            });

            List<BookingEngineAdminConfigDto> result = service.listConfigs();
            assertThat(result).hasSize(1);
            assertThat(result.get(0).name()).isEqualTo("Default");
            verify(configRepository).save(any(BookingEngineConfig.class));
        }
    }

    // ─── listAllConfigs (cross-org) ───────────────────────────────────────

    @Nested
    @DisplayName("listAllConfigs (cross-org)")
    class ListAllConfigs {

        @Test
        @DisplayName("populates organizationName from org map")
        void populatesOrgName() {
            BookingEngineConfig c1 = cfg(1L, 10L, "A");
            BookingEngineConfig c2 = cfg(2L, 20L, "B");
            when(configRepository.findAll()).thenReturn(List.of(c1, c2));

            Organization o1 = new Organization();
            o1.setId(10L);
            o1.setName("Acme");
            Organization o2 = new Organization();
            o2.setId(20L);
            o2.setName("Beta");
            when(organizationRepository.findAllById(any())).thenReturn(List.of(o1, o2));

            List<BookingEngineAdminConfigDto> result = service.listAllConfigs();
            assertThat(result).hasSize(2);
            assertThat(result).extracting(BookingEngineAdminConfigDto::organizationName)
                    .containsExactlyInAnyOrder("Acme", "Beta");
        }

        @Test
        @DisplayName("falls back to placeholder when org name not found")
        void fallbackOrgName() {
            BookingEngineConfig c = cfg(1L, 99L, "X");
            when(configRepository.findAll()).thenReturn(List.of(c));
            when(organizationRepository.findAllById(any())).thenReturn(List.of());

            List<BookingEngineAdminConfigDto> result = service.listAllConfigs();
            assertThat(result.get(0).organizationName()).isEqualTo("Org #99");
        }

        @Test
        void emptyConfigs_returnsEmptyList() {
            when(configRepository.findAll()).thenReturn(List.of());
            when(organizationRepository.findAllById(any())).thenReturn(List.of());

            assertThat(service.listAllConfigs()).isEmpty();
        }
    }

    // ─── getConfigById ────────────────────────────────────────────────────

    @Nested
    @DisplayName("getConfigById")
    class GetById {

        @Test
        void returnsDto() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            BookingEngineConfig c = cfg(5L, ORG_ID, "X");
            when(configRepository.findByIdAndOrganizationId(5L, ORG_ID))
                    .thenReturn(Optional.of(c));

            BookingEngineAdminConfigDto dto = service.getConfigById(5L);
            assertThat(dto.id()).isEqualTo(5L);
            assertThat(dto.name()).isEqualTo("X");
        }

        @Test
        void throwsWhenMissing() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(configRepository.findByIdAndOrganizationId(404L, ORG_ID))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.getConfigById(404L))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("introuvable");
        }
    }

    // ─── createConfig ─────────────────────────────────────────────────────

    @Nested
    @DisplayName("createConfig")
    class CreateConfig {

        @Test
        @DisplayName("creates a new config and assigns UUID api key")
        void createsConfig() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(configRepository.existsByOrganizationIdAndName(ORG_ID, "MyTemplate"))
                    .thenReturn(false);
            when(configRepository.save(any(BookingEngineConfig.class))).thenAnswer(inv -> {
                BookingEngineConfig c = inv.getArgument(0);
                c.setId(123L);
                return c;
            });

            BookingEngineAdminConfigDto result = service.createConfig(dto("MyTemplate"));

            assertThat(result.id()).isEqualTo(123L);
            assertThat(result.name()).isEqualTo("MyTemplate");

            ArgumentCaptor<BookingEngineConfig> captor = ArgumentCaptor.forClass(BookingEngineConfig.class);
            verify(configRepository).save(captor.capture());
            BookingEngineConfig saved = captor.getValue();
            assertThat(saved.getOrganizationId()).isEqualTo(ORG_ID);
            assertThat(saved.getApiKey()).isNotBlank();
            UUID.fromString(saved.getApiKey());
            assertThat(saved.getName()).isEqualTo("MyTemplate");
            // applyTo copied the settings fields
            assertThat(saved.getDefaultCurrency()).isEqualTo("EUR");
            assertThat(saved.getPrimaryColor()).isEqualTo("#fff");
        }

        @Test
        @DisplayName("defaults to 'Default' when name is blank or null")
        void defaultsName() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(configRepository.existsByOrganizationIdAndName(ORG_ID, "Default"))
                    .thenReturn(false);
            when(configRepository.save(any(BookingEngineConfig.class))).thenAnswer(inv -> inv.getArgument(0));

            BookingEngineAdminConfigDto blank = dto("   ");
            service.createConfig(blank);

            ArgumentCaptor<BookingEngineConfig> captor = ArgumentCaptor.forClass(BookingEngineConfig.class);
            verify(configRepository).save(captor.capture());
            assertThat(captor.getValue().getName()).isEqualTo("Default");
        }

        @Test
        @DisplayName("trims whitespace around name")
        void trimsName() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(configRepository.existsByOrganizationIdAndName(ORG_ID, "Trimmed"))
                    .thenReturn(false);
            when(configRepository.save(any(BookingEngineConfig.class))).thenAnswer(inv -> inv.getArgument(0));

            service.createConfig(dto("  Trimmed  "));

            ArgumentCaptor<BookingEngineConfig> captor = ArgumentCaptor.forClass(BookingEngineConfig.class);
            verify(configRepository).save(captor.capture());
            assertThat(captor.getValue().getName()).isEqualTo("Trimmed");
        }

        @Test
        @DisplayName("rejects duplicate name within the org")
        void rejectsDuplicate() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(configRepository.existsByOrganizationIdAndName(ORG_ID, "Dup")).thenReturn(true);

            assertThatThrownBy(() -> service.createConfig(dto("Dup")))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("existe deja");
            verify(configRepository, never()).save(any());
        }
    }

    // ─── updateConfig ─────────────────────────────────────────────────────

    @Nested
    @DisplayName("updateConfig")
    class UpdateConfig {

        @Test
        @DisplayName("updates fields when found")
        void updates() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            BookingEngineConfig existing = cfg(7L, ORG_ID, "Old");
            when(configRepository.findByIdAndOrganizationId(7L, ORG_ID))
                    .thenReturn(Optional.of(existing));
            when(configRepository.existsByOrganizationIdAndName(ORG_ID, "Renamed"))
                    .thenReturn(false);
            when(configRepository.save(existing)).thenReturn(existing);

            service.updateConfig(7L, dto("Renamed"));

            assertThat(existing.getName()).isEqualTo("Renamed");
            assertThat(existing.getDefaultCurrency()).isEqualTo("EUR");
            assertThat(existing.getPrimaryColor()).isEqualTo("#fff");
        }

        @Test
        @DisplayName("keeps existing name when DTO name is blank")
        void keepsExistingNameWhenBlank() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            BookingEngineConfig existing = cfg(7L, ORG_ID, "KeepMe");
            when(configRepository.findByIdAndOrganizationId(7L, ORG_ID))
                    .thenReturn(Optional.of(existing));
            when(configRepository.save(existing)).thenReturn(existing);

            service.updateConfig(7L, dto("   "));

            assertThat(existing.getName()).isEqualTo("KeepMe");
            // No uniqueness check for unchanged name
            verify(configRepository, never()).existsByOrganizationIdAndName(eq(ORG_ID), any());
        }

        @Test
        @DisplayName("rejects rename collision")
        void rejectsRenameCollision() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            BookingEngineConfig existing = cfg(7L, ORG_ID, "Old");
            when(configRepository.findByIdAndOrganizationId(7L, ORG_ID))
                    .thenReturn(Optional.of(existing));
            when(configRepository.existsByOrganizationIdAndName(ORG_ID, "Taken")).thenReturn(true);

            assertThatThrownBy(() -> service.updateConfig(7L, dto("Taken")))
                    .isInstanceOf(IllegalArgumentException.class);
            verify(configRepository, never()).save(any());
        }

        @Test
        void throwsWhenMissing() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(configRepository.findByIdAndOrganizationId(404L, ORG_ID))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.updateConfig(404L, dto("X")))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    // ─── deleteConfig ─────────────────────────────────────────────────────

    @Nested
    @DisplayName("deleteConfig")
    class DeleteConfig {

        @Test
        void deletes() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            BookingEngineConfig existing = cfg(7L, ORG_ID, "X");
            when(configRepository.findByIdAndOrganizationId(7L, ORG_ID))
                    .thenReturn(Optional.of(existing));

            service.deleteConfig(7L);
            verify(configRepository).delete(existing);
        }

        @Test
        void throwsWhenMissing() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(configRepository.findByIdAndOrganizationId(404L, ORG_ID))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.deleteConfig(404L))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    // ─── toggleEnabled ────────────────────────────────────────────────────

    @Nested
    @DisplayName("toggleEnabled")
    class ToggleEnabled {

        @Test
        void enablesConfig() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            BookingEngineConfig existing = cfg(7L, ORG_ID, "X");
            existing.setEnabled(false);
            when(configRepository.findByIdAndOrganizationId(7L, ORG_ID))
                    .thenReturn(Optional.of(existing));
            when(configRepository.save(existing)).thenReturn(existing);

            BookingEngineAdminConfigDto result = service.toggleEnabled(7L, true);
            assertThat(existing.isEnabled()).isTrue();
            assertThat(result.enabled()).isTrue();
        }

        @Test
        void disablesConfig() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            BookingEngineConfig existing = cfg(7L, ORG_ID, "X");
            existing.setEnabled(true);
            when(configRepository.findByIdAndOrganizationId(7L, ORG_ID))
                    .thenReturn(Optional.of(existing));
            when(configRepository.save(existing)).thenReturn(existing);

            BookingEngineAdminConfigDto result = service.toggleEnabled(7L, false);
            assertThat(existing.isEnabled()).isFalse();
            assertThat(result.enabled()).isFalse();
        }

        @Test
        void throwsWhenMissing() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(configRepository.findByIdAndOrganizationId(404L, ORG_ID))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.toggleEnabled(404L, true))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    // ─── regenerateApiKey ─────────────────────────────────────────────────

    @Nested
    @DisplayName("regenerateApiKey")
    class RegenerateKey {

        @Test
        @DisplayName("rotates the API key with a fresh UUID")
        void rotates() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            BookingEngineConfig existing = cfg(7L, ORG_ID, "X");
            existing.setApiKey("old-key");
            when(configRepository.findByIdAndOrganizationId(7L, ORG_ID))
                    .thenReturn(Optional.of(existing));
            when(configRepository.save(existing)).thenReturn(existing);

            BookingEngineAdminConfigDto result = service.regenerateApiKey(7L);

            assertThat(existing.getApiKey()).isNotEqualTo("old-key");
            UUID.fromString(existing.getApiKey()); // valid UUID
            assertThat(result.apiKey()).isEqualTo(existing.getApiKey());
        }

        @Test
        void throwsWhenMissing() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(configRepository.findByIdAndOrganizationId(404L, ORG_ID))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.regenerateApiKey(404L))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }
}
