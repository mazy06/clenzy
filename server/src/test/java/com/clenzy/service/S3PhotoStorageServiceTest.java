package com.clenzy.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import software.amazon.awssdk.core.ResponseBytes;
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

    private S3PhotoStorageService service;

    @BeforeEach
    void setUp() {
        service = new S3PhotoStorageService(s3Client, "test-bucket", "photos");
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
            S3PhotoStorageService custom = new S3PhotoStorageService(s3Client, "other-bucket", "uploads");

            String key = custom.store(new byte[]{1}, "image/jpeg", "x.jpg");

            assertThat(key).startsWith("uploads/");
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
