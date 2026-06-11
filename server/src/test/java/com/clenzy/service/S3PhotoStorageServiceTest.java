package com.clenzy.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import com.clenzy.repository.AssistantMessageRepository;
import com.clenzy.tenant.TenantContext;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class S3PhotoStorageServiceTest {

    @Mock private S3Client s3Client;
    @Mock private AssistantMessageRepository assistantMessageRepository;
    @Mock private TenantContext tenantContext;

    private S3PhotoStorageService service;

    @BeforeEach
    void setUp() {
        service = new S3PhotoStorageService(
                s3Client, "test-bucket", "photos", assistantMessageRepository, tenantContext);
    }

    @Nested
    @DisplayName("store")
    class Store {

        @Test
        void uploadsAndReturnsKeyWithExtension() {
            byte[] data = "hello".getBytes(StandardCharsets.UTF_8);

            String key = service.store(data, "image/jpeg", "property/3/photo.jpg");

            assertThat(key).startsWith("photos/").endsWith(".jpg");

            ArgumentCaptor<PutObjectRequest> reqCap = ArgumentCaptor.forClass(PutObjectRequest.class);
            verify(s3Client).putObject(reqCap.capture(), any(RequestBody.class));
            PutObjectRequest req = reqCap.getValue();
            assertThat(req.bucket()).isEqualTo("test-bucket");
            assertThat(req.contentType()).isEqualTo("image/jpeg");
            assertThat(req.contentLength()).isEqualTo(5L);
            assertThat(req.key()).isEqualTo(key);
        }

        @Test
        void filenameWithoutExtension_defaultsToJpg() {
            String key = service.store(new byte[]{1, 2}, "image/jpeg", "no-extension");

            assertThat(key).endsWith(".jpg");
        }

        @Test
        void nullFilename_defaultsToJpg() {
            String key = service.store(new byte[]{1, 2}, "image/jpeg", null);

            assertThat(key).endsWith(".jpg");
        }

        @Test
        void filenameWithPngExtension_preserved() {
            String key = service.store(new byte[]{1, 2}, "image/png", "snap.PNG");

            assertThat(key).endsWith(".png");
        }

        @Test
        void filenameWithMultiDots_takesLastExtension() {
            String key = service.store(new byte[]{1}, "image/webp", "my.file.webp");

            assertThat(key).endsWith(".webp");
        }

        @Test
        void usesCustomPrefix() {
            S3PhotoStorageService custom = new S3PhotoStorageService(
                    s3Client, "other-bucket", "uploads", assistantMessageRepository, tenantContext);

            String key = custom.store(new byte[]{1}, "image/jpeg", "x.jpg");

            assertThat(key).startsWith("uploads/");
        }
    }

    @Nested
    @DisplayName("assertReadableInCurrentOrg")
    class AssertReadableInCurrentOrg {

        @Test
        void keyReferencedByOrgMessage_passes() {
            when(tenantContext.isSuperAdmin()).thenReturn(false);
            when(tenantContext.isSystemOrg()).thenReturn(false);
            when(tenantContext.getOrganizationId()).thenReturn(7L);
            when(assistantMessageRepository.existsAttachmentKeyForOrg("photos/abc.jpg", 7L))
                    .thenReturn(true);

            service.assertReadableInCurrentOrg("photos/abc.jpg");
            // pas d'exception → autorise
        }

        @Test
        void keyFromAnotherOrg_denied() {
            when(tenantContext.isSuperAdmin()).thenReturn(false);
            when(tenantContext.isSystemOrg()).thenReturn(false);
            when(tenantContext.getOrganizationId()).thenReturn(7L);
            when(assistantMessageRepository.existsAttachmentKeyForOrg("photos/foreign.jpg", 7L))
                    .thenReturn(false);

            assertThatThrownBy(() -> service.assertReadableInCurrentOrg("photos/foreign.jpg"))
                    .isInstanceOf(AccessDeniedException.class);
        }

        @Test
        void platformStaff_bypassesCheck() {
            when(tenantContext.isSuperAdmin()).thenReturn(true);

            service.assertReadableInCurrentOrg("photos/anything.jpg");

            verify(assistantMessageRepository, never())
                    .existsAttachmentKeyForOrg(any(), any());
        }

        @Test
        void nullTenantOrg_denied() {
            when(tenantContext.isSuperAdmin()).thenReturn(false);
            when(tenantContext.isSystemOrg()).thenReturn(false);
            when(tenantContext.getOrganizationId()).thenReturn(null);

            assertThatThrownBy(() -> service.assertReadableInCurrentOrg("photos/abc.jpg"))
                    .isInstanceOf(AccessDeniedException.class);
        }
    }

    @Nested
    @DisplayName("retrieve")
    class Retrieve {

        @Test
        void downloadsBytes() {
            byte[] payload = "payload".getBytes(StandardCharsets.UTF_8);
            GetObjectResponse getResp = GetObjectResponse.builder().build();
            ResponseInputStream<GetObjectResponse> inputStream = new ResponseInputStream<>(
                    getResp, new ByteArrayInputStream(payload));
            when(s3Client.getObject(any(GetObjectRequest.class))).thenReturn(inputStream);

            byte[] result = service.retrieve("photos/abc.jpg");

            assertThat(result).isEqualTo(payload);

            ArgumentCaptor<GetObjectRequest> cap = ArgumentCaptor.forClass(GetObjectRequest.class);
            verify(s3Client).getObject(cap.capture());
            assertThat(cap.getValue().bucket()).isEqualTo("test-bucket");
            assertThat(cap.getValue().key()).isEqualTo("photos/abc.jpg");
        }

        @Test
        void s3Exception_wrappedInIllegalState() {
            when(s3Client.getObject(any(GetObjectRequest.class)))
                    .thenThrow(NoSuchKeyException.builder().message("missing").build());

            assertThatThrownBy(() -> service.retrieve("photos/missing.jpg"))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("photos/missing.jpg");
        }
    }

    @Nested
    @DisplayName("delete")
    class Delete {

        @Test
        void issuesDeleteObject() {
            service.delete("photos/abc.jpg");

            ArgumentCaptor<DeleteObjectRequest> cap = ArgumentCaptor.forClass(DeleteObjectRequest.class);
            verify(s3Client).deleteObject(cap.capture());
            assertThat(cap.getValue().bucket()).isEqualTo("test-bucket");
            assertThat(cap.getValue().key()).isEqualTo("photos/abc.jpg");
        }
    }
}
