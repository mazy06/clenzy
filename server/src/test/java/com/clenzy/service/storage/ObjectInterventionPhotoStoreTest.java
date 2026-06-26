package com.clenzy.service.storage;

import com.clenzy.model.InterventionPhoto;
import com.clenzy.service.access.OrganizationAccessGuard;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Tests du stockage objet (MinIO, vendor-neutral) pour les photos d'intervention.
 *
 * <p>On mocke uniquement {@link ObjectStorageClient} (pas de vrai MinIO) et on utilise de vrais
 * {@link TenantContext} / {@link OrganizationAccessGuard} pour exercer la semantique fail-closed
 * reelle de l'isolation d'organisation.</p>
 */
@ExtendWith(MockitoExtension.class)
class ObjectInterventionPhotoStoreTest {

    @Mock private ObjectStorageClient client;

    private TenantContext tenantContext;
    private ObjectInterventionPhotoStore store;

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        // TenantContext s'appuie sur un ThreadLocal partage entre tests (meme thread d'exec) :
        // on le reinitialise pour eviter qu'un superAdmin/org pose par un test precedent ne fuite.
        tenantContext.clear();
        OrganizationAccessGuard guard = new OrganizationAccessGuard(tenantContext);
        store = new ObjectInterventionPhotoStore(client, guard);
    }

    private static InterventionPhoto photoWithKey(String storageKey) {
        InterventionPhoto photo = new InterventionPhoto();
        photo.setStorageKey(storageKey);
        ReflectionTestUtils.setField(photo, "id", 5L);
        return photo;
    }

    @Nested
    @DisplayName("resolveBytes")
    class ResolveBytes {

        @Test
        @DisplayName("cle de la meme org -> delegue a client.get")
        void sameOrg_delegatesGet() {
            tenantContext.setOrganizationId(7L);
            byte[] payload = "payload".getBytes(StandardCharsets.UTF_8);
            when(client.get("org/7/intervention-photos/abc")).thenReturn(payload);

            byte[] result = store.resolveBytes(photoWithKey("org/7/intervention-photos/abc"));

            assertThat(result).isEqualTo(payload);
        }

        @Test
        @DisplayName("cle d'une AUTRE org -> AccessDenied, pas de lecture objet")
        void otherOrg_denied() {
            tenantContext.setOrganizationId(7L);

            assertThatThrownBy(() -> store.resolveBytes(photoWithKey("org/999/intervention-photos/abc")))
                    .isInstanceOf(AccessDeniedException.class);
            verifyNoInteractions(client);
        }

        @Test
        @DisplayName("cle malformee -> AccessDenied (anti-enumeration / path traversal)")
        void malformedKey_denied() {
            tenantContext.setOrganizationId(7L);

            assertThatThrownBy(() -> store.resolveBytes(photoWithKey("../../etc/passwd")))
                    .isInstanceOf(AccessDeniedException.class);
            verifyNoInteractions(client);
        }

        @Test
        @DisplayName("cle d'un autre type (photos propriete) -> AccessDenied (prefixe strict)")
        void wrongPrefix_denied() {
            tenantContext.setOrganizationId(7L);

            assertThatThrownBy(() -> store.resolveBytes(photoWithKey("org/7/photos/abc")))
                    .isInstanceOf(AccessDeniedException.class);
            verifyNoInteractions(client);
        }

        @Test
        @DisplayName("storageKey null -> AccessDenied")
        void nullKey_denied() {
            tenantContext.setOrganizationId(7L);

            assertThatThrownBy(() -> store.resolveBytes(photoWithKey(null)))
                    .isInstanceOf(AccessDeniedException.class);
            verifyNoInteractions(client);
        }

        @Test
        @DisplayName("platform staff (SUPER_ADMIN) -> bypass de la garde, lecture autorisee")
        void platformStaff_bypasses() {
            tenantContext.setOrganizationId(7L);
            tenantContext.setSuperAdmin(true);
            byte[] payload = "x".getBytes(StandardCharsets.UTF_8);
            when(client.get("org/999/intervention-photos/abc")).thenReturn(payload);

            assertThatCode(() -> store.resolveBytes(photoWithKey("org/999/intervention-photos/abc")))
                    .doesNotThrowAnyException();
        }
    }
}
