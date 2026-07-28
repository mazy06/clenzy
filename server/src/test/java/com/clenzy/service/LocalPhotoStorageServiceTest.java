package com.clenzy.service;

import com.clenzy.model.PropertyPhoto;
import com.clenzy.repository.PropertyPhotoRepository;
import com.clenzy.service.access.OrganizationAccessGuard;
import com.clenzy.service.storage.BinaryAssetStorage;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
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
    @Mock private BinaryAssetStorage binaryAssetStorage;

    private TenantContext tenantContext;
    private LocalPhotoStorageService service;

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        OrganizationAccessGuard guard = new OrganizationAccessGuard(tenantContext);
        service = new LocalPhotoStorageService(photoRepository, guard, binaryAssetStorage, tenantContext);
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

    // --- store/retrieve : la cle org-scopee remplace le litteral "pending" ---

    @Test
    @DisplayName("store persiste dans binary_asset et rend une cle org-scopee (plus jamais 'pending')")
    void store_returnsOrgScopedKey() {
        tenantContext.setOrganizationId(7L);
        byte[] data = {1, 2, 3};

        String key = service.store(data, "image/png", "logo.png");

        assertThat(key).matches("^org/7/photos/[0-9a-f-]{36}$");
        verify(binaryAssetStorage).store(key, "image/png", data);
    }

    @Test
    @DisplayName("retrieve d'une cle org-scopee lit binary_asset, pas property_photos")
    void retrieve_orgScopedKey_readsBinaryAsset() {
        byte[] data = {4, 5, 6};
        String key = "org/7/photos/" + java.util.UUID.randomUUID();
        when(binaryAssetStorage.load(key))
                .thenReturn(Optional.of(new BinaryAssetStorage.StoredBinaryAsset(data, "image/png", 3L)));

        assertThat(service.retrieve(key)).isEqualTo(data);
        verifyNoInteractions(photoRepository);
    }

    @Test
    @DisplayName("retrieve d'une cle numerique legacy lit toujours le BYTEA de property_photos")
    void retrieve_legacyNumericKey_readsBytea() {
        byte[] data = {7, 8};
        PropertyPhoto photo = photoOfOrg(42L, 7L);
        photo.setData(data);
        when(photoRepository.findById(42L)).thenReturn(Optional.of(photo));

        assertThat(service.retrieve("42")).isEqualTo(data);
        verifyNoInteractions(binaryAssetStorage);
    }

    @Test
    @DisplayName("cle org-scopee d'une AUTRE org → AccessDenied sans toucher au repository")
    void orgScopedKey_otherOrg_denied() {
        tenantContext.setOrganizationId(7L);

        assertThatThrownBy(() -> service.assertReadableInCurrentOrg("org/999/photos/abc"))
                .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(photoRepository);
    }

    @Test
    @DisplayName("cle org-scopee de la meme org → autorise")
    void orgScopedKey_sameOrg_passes() {
        tenantContext.setOrganizationId(7L);

        assertThatCode(() -> service.assertReadableInCurrentOrg("org/7/photos/abc"))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("delete : cle org-scopee purge binary_asset, cle legacy est un no-op")
    void delete_onlyTouchesBinaryAssetForOrgScopedKeys() {
        String key = "org/7/photos/abc";

        service.delete(key);
        verify(binaryAssetStorage).delete(key);

        service.delete("42");
        verifyNoMoreInteractions(binaryAssetStorage);
    }
}
