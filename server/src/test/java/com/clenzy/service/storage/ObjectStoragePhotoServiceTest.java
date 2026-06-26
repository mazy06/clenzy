package com.clenzy.service.storage;

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

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Tests du stockage objet (MinIO, vendor-neutral) pour les photos.
 *
 * <p>On mocke uniquement {@link ObjectStorageClient} (pas de vrai MinIO) et on utilise
 * de vrais {@link TenantContext} / {@link OrganizationAccessGuard} (composants simples,
 * sans IO) pour exercer la semantique fail-closed reelle de l'isolation d'organisation.</p>
 */
@ExtendWith(MockitoExtension.class)
class ObjectStoragePhotoServiceTest {

    @Mock private ObjectStorageClient client;

    private TenantContext tenantContext;
    private ObjectStoragePhotoService service;

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        OrganizationAccessGuard guard = new OrganizationAccessGuard(tenantContext);
        service = new ObjectStoragePhotoService(client, tenantContext, guard);
    }

    @Nested
    @DisplayName("store")
    class Store {

        @Test
        @DisplayName("retourne une cle org-scopee et delegue au client.put")
        void returnsOrgScopedKeyAndDelegatesPut() {
            tenantContext.setOrganizationId(42L);
            byte[] data = "hello".getBytes(StandardCharsets.UTF_8);

            String key = service.store(data, "image/jpeg", "photo.jpg");

            assertThat(key).matches("^org/42/photos/[0-9a-f\\-]+$");
            verify(client).put(key, data, "image/jpeg");
        }

        @Test
        @DisplayName("sans org resolue → IllegalState (ecriture interdite hors tenant)")
        void noOrg_throws() {
            assertThatThrownBy(() -> service.store(new byte[]{1}, "image/jpeg", "x.jpg"))
                    .isInstanceOf(IllegalStateException.class);
            verifyNoInteractions(client);
        }
    }

    @Nested
    @DisplayName("retrieve")
    class Retrieve {

        @Test
        @DisplayName("delegue a client.get")
        void delegatesGet() {
            byte[] payload = "payload".getBytes(StandardCharsets.UTF_8);
            when(client.get("org/7/photos/abc")).thenReturn(payload);

            assertThat(service.retrieve("org/7/photos/abc")).isEqualTo(payload);
        }
    }

    @Nested
    @DisplayName("assertReadableInCurrentOrg")
    class AssertReadableInCurrentOrg {

        @Test
        @DisplayName("cle de la meme org → autorise")
        void sameOrg_passes() {
            tenantContext.setOrganizationId(7L);

            assertThatCode(() -> service.assertReadableInCurrentOrg("org/7/photos/abc"))
                    .doesNotThrowAnyException();
        }

        @Test
        @DisplayName("cle d'une AUTRE org → AccessDenied")
        void otherOrg_denied() {
            tenantContext.setOrganizationId(7L);

            assertThatThrownBy(() -> service.assertReadableInCurrentOrg("org/999/photos/abc"))
                    .isInstanceOf(AccessDeniedException.class);
        }

        @Test
        @DisplayName("cle malformee → AccessDenied (anti-enumeration / path traversal)")
        void malformedKey_denied() {
            tenantContext.setOrganizationId(7L);

            assertThatThrownBy(() -> service.assertReadableInCurrentOrg("../../etc/passwd"))
                    .isInstanceOf(AccessDeniedException.class);
        }

        @Test
        @DisplayName("cle null → AccessDenied")
        void nullKey_denied() {
            tenantContext.setOrganizationId(7L);

            assertThatThrownBy(() -> service.assertReadableInCurrentOrg(null))
                    .isInstanceOf(AccessDeniedException.class);
        }

        @Test
        @DisplayName("platform staff (SUPER_ADMIN) → bypass de la garde")
        void platformStaff_bypasses() {
            tenantContext.setOrganizationId(7L);
            tenantContext.setSuperAdmin(true);

            assertThatCode(() -> service.assertReadableInCurrentOrg("org/999/photos/abc"))
                    .doesNotThrowAnyException();
        }
    }

    @Nested
    @DisplayName("delete")
    class Delete {

        @Test
        @DisplayName("delegue a client.delete")
        void delegatesDelete() {
            service.delete("org/7/photos/abc");

            verify(client).delete("org/7/photos/abc");
        }
    }
}
