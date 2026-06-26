package com.clenzy.service.storage;

import com.clenzy.exception.DocumentStorageException;
import com.clenzy.service.access.OrganizationAccessGuard;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Tests de la strategie de stockage objet des documents (MinIO mocke, pas de vrai MinIO).
 *
 * <p>On mocke {@link ObjectStorageClient} et on utilise de vrais {@link TenantContext} /
 * {@link OrganizationAccessGuard} (composants sans IO) pour exercer la semantique
 * fail-closed reelle de l'isolation d'organisation.</p>
 */
@ExtendWith(MockitoExtension.class)
class ObjectDocumentBinaryStoreTest {

    private static final String DOCS_BUCKET = "clenzy-documents";

    @Mock private ObjectStorageClient client;

    private TenantContext tenantContext;
    private ObjectDocumentBinaryStore store;

    @BeforeEach
    void setUp() {
        lenient().when(client.documentsBucket()).thenReturn(DOCS_BUCKET);
        tenantContext = new TenantContext();
        OrganizationAccessGuard guard = new OrganizationAccessGuard(tenantContext);
        store = new ObjectDocumentBinaryStore(client, tenantContext, guard);
    }

    @Nested
    @DisplayName("write")
    class Write {

        @Test
        @DisplayName("prefixe la cle logique en org/{orgId}/documents/... et delegue au client.put")
        void prefixesOrgScopedKeyAndDelegatesPut() {
            tenantContext.setOrganizationId(42L);
            byte[] data = "PDF".getBytes(StandardCharsets.UTF_8);

            String ref = store.write("FACTURE/2026-06/abc_facture.pdf", data, "application/pdf");

            assertThat(ref).isEqualTo("org/42/documents/FACTURE/2026-06/abc_facture.pdf");
            verify(client).put(DOCS_BUCKET, ref, data, "application/pdf");
        }

        @Test
        @DisplayName("sans org resolue → IllegalState (ecriture interdite hors tenant)")
        void noOrg_throws() {
            assertThatThrownBy(() -> store.write("FACTURE/x.pdf", new byte[]{1}, "application/pdf"))
                    .isInstanceOf(IllegalStateException.class);
            verifyNoInteractions(client);
        }
    }

    @Nested
    @DisplayName("write -> loadAsBytes (round-trip)")
    class RoundTrip {

        @Test
        @DisplayName("la reference retournee par write relit les memes octets via loadAsBytes")
        void storeThenRetrieve() {
            tenantContext.setOrganizationId(7L);
            byte[] data = "round-trip".getBytes(StandardCharsets.UTF_8);

            String ref = store.write("DEVIS/2026-06/u_devis.pdf", data, "application/pdf");
            when(client.get(DOCS_BUCKET, ref)).thenReturn(data);

            assertThat(store.loadAsBytes(ref)).isEqualTo(data);
        }
    }

    @Nested
    @DisplayName("loadAsBytes / delete — garde fail-closed")
    class FailClosed {

        @Test
        @DisplayName("cle d'une AUTRE org → refus (DocumentStorageException), aucun appel client.get")
        void otherOrg_denied() {
            tenantContext.setOrganizationId(7L);

            assertThatThrownBy(() -> store.loadAsBytes("org/999/documents/FACTURE/x.pdf"))
                    .isInstanceOf(DocumentStorageException.class);
        }

        @Test
        @DisplayName("cle hors prefixe documents (path traversal) → refus")
        void malformedKey_denied() {
            tenantContext.setOrganizationId(7L);

            assertThatThrownBy(() -> store.loadAsBytes("../../etc/passwd"))
                    .isInstanceOf(DocumentStorageException.class);
        }

        @Test
        @DisplayName("meme org → lecture autorisee, delegue au client.get")
        void sameOrg_reads() {
            tenantContext.setOrganizationId(7L);
            when(client.get(eq(DOCS_BUCKET), eq("org/7/documents/FACTURE/x.pdf")))
                    .thenReturn("ok".getBytes(StandardCharsets.UTF_8));

            assertThat(store.loadAsBytes("org/7/documents/FACTURE/x.pdf"))
                    .isEqualTo("ok".getBytes(StandardCharsets.UTF_8));
        }

        @Test
        @DisplayName("platform staff (SUPER_ADMIN) → bypass de la garde cross-org")
        void platformStaff_bypasses() {
            tenantContext.setOrganizationId(7L);
            tenantContext.setSuperAdmin(true);
            when(client.get(eq(DOCS_BUCKET), eq("org/999/documents/FACTURE/x.pdf")))
                    .thenReturn("ok".getBytes(StandardCharsets.UTF_8));

            assertThat(store.loadAsBytes("org/999/documents/FACTURE/x.pdf")).isNotNull();
        }

        @Test
        @DisplayName("delete d'une AUTRE org → refus, aucun appel client.delete")
        void deleteOtherOrg_denied() {
            tenantContext.setOrganizationId(7L);

            assertThatThrownBy(() -> store.delete("org/999/documents/FACTURE/x.pdf"))
                    .isInstanceOf(DocumentStorageException.class);
        }

        @Test
        @DisplayName("delete meme org → delegue au client.delete")
        void deleteSameOrg_delegates() {
            tenantContext.setOrganizationId(7L);

            store.delete("org/7/documents/FACTURE/x.pdf");

            verify(client).delete(DOCS_BUCKET, "org/7/documents/FACTURE/x.pdf");
        }

        @Test
        @DisplayName("delete null/blanc → no-op")
        void deleteNullBlank_noOp() {
            store.delete(null);
            store.delete("   ");
            verifyNoInteractions(client);
        }
    }

    @Nested
    @DisplayName("exists")
    class Exists {

        @Test
        @DisplayName("cle bien formee → delegue au client.exists")
        void wellFormed_delegates() {
            when(client.exists(DOCS_BUCKET, "org/7/documents/FACTURE/x.pdf")).thenReturn(true);

            assertThat(store.exists("org/7/documents/FACTURE/x.pdf")).isTrue();
        }

        @Test
        @DisplayName("cle null/blanche/malformee → false sans appel client")
        void malformed_false() {
            assertThat(store.exists(null)).isFalse();
            assertThat(store.exists("   ")).isFalse();
            assertThat(store.exists("../escape")).isFalse();
            verifyNoInteractions(client);
        }
    }
}
