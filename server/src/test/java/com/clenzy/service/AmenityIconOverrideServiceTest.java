package com.clenzy.service;

import com.clenzy.dto.AmenityIconOverrideDto;
import com.clenzy.model.OrganizationAmenityIconOverride;
import com.clenzy.repository.OrganizationAmenityIconOverrideRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("AmenityIconOverrideService — upsert / list / delete + validation")
class AmenityIconOverrideServiceTest {

    @Mock private OrganizationAmenityIconOverrideRepository repository;
    @InjectMocks private AmenityIconOverrideService service;

    // ─── listForOrganization ────────────────────────────────────────────────

    @Test
    @DisplayName("list : retourne tous les overrides d'une organisation")
    void list_returnsAllForOrg() {
        OrganizationAmenityIconOverride a = override(42L, "WIFI", "WifiHigh");
        OrganizationAmenityIconOverride b = override(42L, "POOL", "WavesLadder");
        when(repository.findByOrganizationId(42L)).thenReturn(List.of(a, b));

        List<AmenityIconOverrideDto> result = service.listForOrganization(42L);

        assertThat(result).extracting(AmenityIconOverrideDto::amenityCode)
                .containsExactly("WIFI", "POOL");
        assertThat(result).extracting(AmenityIconOverrideDto::iconName)
                .containsExactly("WifiHigh", "WavesLadder");
    }

    @Test
    @DisplayName("list : retourne liste vide quand l'org n'a rien personnalise")
    void list_emptyForFreshOrg() {
        when(repository.findByOrganizationId(99L)).thenReturn(List.of());
        assertThat(service.listForOrganization(99L)).isEmpty();
    }

    // ─── upsert ──────────────────────────────────────────────────────────────

    @Test
    @DisplayName("upsert : cree un nouvel override si aucun n'existe pour (org, code)")
    void upsert_insertsWhenAbsent() {
        when(repository.findByOrganizationIdAndAmenityCode(42L, "WIFI")).thenReturn(Optional.empty());
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        AmenityIconOverrideDto result = service.upsert(42L, "WIFI", "Router");

        assertThat(result.amenityCode()).isEqualTo("WIFI");
        assertThat(result.iconName()).isEqualTo("Router");
    }

    @Test
    @DisplayName("upsert : met a jour l'override existant (preserve l'id et createdAt)")
    void upsert_updatesWhenPresent() {
        OrganizationAmenityIconOverride existing = override(42L, "WIFI", "WifiHigh");
        existing.setId(7L);
        when(repository.findByOrganizationIdAndAmenityCode(42L, "WIFI")).thenReturn(Optional.of(existing));
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        AmenityIconOverrideDto result = service.upsert(42L, "WIFI", "Router");

        assertThat(result.iconName()).isEqualTo("Router");
        assertThat(existing.getIconName()).isEqualTo("Router"); // entity mutee in-place
    }

    @Test
    @DisplayName("upsert : rejette un amenityCode invalide (lowercase)")
    void upsert_rejectsLowercaseCode() {
        assertThatThrownBy(() -> service.upsert(42L, "wifi", "Wifi"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("amenityCode invalide");
        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("upsert : rejette un iconName invalide (lowercase)")
    void upsert_rejectsLowercaseIcon() {
        assertThatThrownBy(() -> service.upsert(42L, "WIFI", "wifi"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("iconName invalide");
        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("upsert : accepte les suffixes numeriques (Tv2, Building2)")
    void upsert_acceptsNumericSuffixIcons() {
        when(repository.findByOrganizationIdAndAmenityCode(eq(42L), any())).thenReturn(Optional.empty());
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.upsert(42L, "TV", "Tv2");
        service.upsert(42L, "STAFF_OFFICE", "Building2");
        // no exception = pass
    }

    @Test
    @DisplayName("upsert : rejette amenityCode null")
    void upsert_rejectsNullCode() {
        assertThatThrownBy(() -> service.upsert(42L, null, "Wifi"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("upsert : rejette iconName null")
    void upsert_rejectsNullIcon() {
        assertThatThrownBy(() -> service.upsert(42L, "WIFI", null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    // ─── delete ──────────────────────────────────────────────────────────────

    @Test
    @DisplayName("delete : delegue au repository avec org + code")
    void delete_delegatesToRepository() {
        service.delete(42L, "WIFI");
        verify(repository).deleteByOrganizationIdAndAmenityCode(42L, "WIFI");
    }

    @Test
    @DisplayName("delete : valide le code (rejette invalide)")
    void delete_validatesCode() {
        assertThatThrownBy(() -> service.delete(42L, "lowercase"))
                .isInstanceOf(IllegalArgumentException.class);
        verify(repository, never()).deleteByOrganizationIdAndAmenityCode(any(), any());
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private static OrganizationAmenityIconOverride override(Long orgId, String code, String icon) {
        OrganizationAmenityIconOverride o = new OrganizationAmenityIconOverride();
        o.setOrganizationId(orgId);
        o.setAmenityCode(code);
        o.setIconName(icon);
        return o;
    }
}
