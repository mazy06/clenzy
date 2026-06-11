package com.clenzy.service;

import com.clenzy.model.PropertyPhoto;
import com.clenzy.repository.PropertyPhotoRepository;
import com.clenzy.service.access.OrganizationAccessGuard;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/**
 * Garde d'autorisation cross-org sur la resolution des attachments du chat
 * assistant (audit 2026-06, A1-AGENT-IA-01). Le storageKey du storage local est
 * l'id d'un {@code property_photos} — enumerable cross-org sans la garde.
 *
 * <p>On utilise un vrai {@link OrganizationAccessGuard} + un vrai
 * {@link TenantContext} (composants simples, sans IO) pour exercer la semantique
 * fail-closed reelle, et on mocke uniquement le repository.</p>
 */
@ExtendWith(MockitoExtension.class)
class LocalPhotoStorageServiceTest {

    @Mock private PropertyPhotoRepository photoRepository;

    private TenantContext tenantContext;
    private LocalPhotoStorageService service;

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        OrganizationAccessGuard guard = new OrganizationAccessGuard(tenantContext);
        service = new LocalPhotoStorageService(photoRepository, guard);
    }

    private PropertyPhoto photoOfOrg(long id, Long orgId) {
        PropertyPhoto p = new PropertyPhoto();
        p.setId(id);
        p.setOrganizationId(orgId);
        return p;
    }

    @Test
    @DisplayName("storageKey d'une photo de la meme org → autorise")
    void sameOrg_passes() {
        tenantContext.setOrganizationId(7L);
        when(photoRepository.findById(42L)).thenReturn(Optional.of(photoOfOrg(42L, 7L)));

        assertThatCode(() -> service.assertReadableInCurrentOrg("42"))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("storageKey d'une photo d'une AUTRE org → AccessDenied")
    void otherOrg_denied() {
        tenantContext.setOrganizationId(7L);
        when(photoRepository.findById(99L)).thenReturn(Optional.of(photoOfOrg(99L, 999L)));

        assertThatThrownBy(() -> service.assertReadableInCurrentOrg("99"))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    @DisplayName("storageKey inexistant → AccessDenied (pas d'enumeration)")
    void unknownKey_denied() {
        tenantContext.setOrganizationId(7L);
        when(photoRepository.findById(1234L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.assertReadableInCurrentOrg("1234"))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    @DisplayName("storageKey malforme (non numerique) → AccessDenied")
    void malformedKey_denied() {
        lenient().when(photoRepository.findById(org.mockito.ArgumentMatchers.anyLong()))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.assertReadableInCurrentOrg("../../etc/passwd"))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    @DisplayName("platform staff (SUPER_ADMIN) → bypass de la garde")
    void platformStaff_bypasses() {
        tenantContext.setOrganizationId(7L);
        tenantContext.setSuperAdmin(true);
        when(photoRepository.findById(99L)).thenReturn(Optional.of(photoOfOrg(99L, 999L)));

        assertThatCode(() -> service.assertReadableInCurrentOrg("99"))
                .doesNotThrowAnyException();
    }
}
