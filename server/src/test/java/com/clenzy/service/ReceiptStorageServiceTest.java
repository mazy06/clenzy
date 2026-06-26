package com.clenzy.service;

import com.clenzy.exception.DocumentStorageException;
import com.clenzy.service.storage.DocumentBinaryStore;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.springframework.beans.factory.ObjectProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ReceiptStorageServiceTest {

    @TempDir
    Path tempDir;

    private ReceiptStorageService service;
    private MeterRegistry meterRegistry;

    @BeforeEach
    void setUp() {
        meterRegistry = new SimpleMeterRegistry();
        // Flag absent → strategie objet indisponible : comportement disque historique.
        @SuppressWarnings("unchecked")
        ObjectProvider<DocumentBinaryStore> noObjectStore = mock(ObjectProvider.class);
        when(noObjectStore.getIfAvailable()).thenReturn(null);
        service = new ReceiptStorageService(tempDir.toString(), meterRegistry, noObjectStore);
        service.init();
    }

    private MultipartFile mockFile(String filename, String contentType, byte[] content) throws IOException {
        MultipartFile file = mock(MultipartFile.class);
        when(file.getOriginalFilename()).thenReturn(filename);
        when(file.getContentType()).thenReturn(contentType);
        when(file.isEmpty()).thenReturn(content.length == 0);
        when(file.getSize()).thenReturn((long) content.length);
        when(file.getInputStream()).thenReturn(new ByteArrayInputStream(content));
        return file;
    }

    @Nested
    @DisplayName("store - validation")
    class StoreValidation {

        @Test
        @DisplayName("rejects empty file")
        void emptyFile_throws() throws IOException {
            MultipartFile file = mockFile("a.pdf", "application/pdf", new byte[0]);

            assertThatThrownBy(() -> service.store(1L, file))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("vide");
        }

        @Test
        @DisplayName("rejects file over 10MB")
        void fileTooBig_throws() throws IOException {
            MultipartFile file = mock(MultipartFile.class);
            when(file.isEmpty()).thenReturn(false);
            when(file.getSize()).thenReturn(11L * 1024 * 1024);

            assertThatThrownBy(() -> service.store(1L, file))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("10 MB");
        }

        @Test
        @DisplayName("rejects unsupported content type")
        void unsupportedType_throws() throws IOException {
            MultipartFile file = mockFile("evil.exe", "application/x-msdownload", "evil".getBytes());

            assertThatThrownBy(() -> service.store(1L, file))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Type de fichier");
        }

        @Test
        @DisplayName("rejects null content type")
        void nullType_throws() throws IOException {
            MultipartFile file = mockFile("x.bin", null, "binary".getBytes());

            assertThatThrownBy(() -> service.store(1L, file))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Type de fichier");
        }
    }

    @Nested
    @DisplayName("store - accepted types")
    class StoreAcceptedTypes {

        @Test
        @DisplayName("accepts PDF")
        void acceptsPdf() throws IOException {
            MultipartFile file = mockFile("receipt.pdf", "application/pdf", "PDF data".getBytes());

            String path = service.store(42L, file);

            assertThat(path).startsWith("42/");
            assertThat(path).contains("_receipt.pdf");
        }

        @Test
        @DisplayName("accepts JPEG")
        void acceptsJpeg() throws IOException {
            MultipartFile file = mockFile("a.jpg", "image/jpeg", "img".getBytes());

            String path = service.store(1L, file);

            assertThat(path).contains("_a.jpg");
        }

        @Test
        @DisplayName("accepts PNG")
        void acceptsPng() throws IOException {
            MultipartFile file = mockFile("a.png", "image/png", "img".getBytes());

            assertThat(service.store(1L, file)).contains("_a.png");
        }

        @Test
        @DisplayName("accepts WebP")
        void acceptsWebp() throws IOException {
            MultipartFile file = mockFile("a.webp", "image/webp", "img".getBytes());

            assertThat(service.store(1L, file)).contains("_a.webp");
        }
    }

    @Nested
    @DisplayName("store - happy path")
    class StoreHappyPath {

        @Test
        @DisplayName("writes file in org/yyyy-MM/uuid_filename structure")
        void writesCorrectStructure() throws IOException {
            byte[] content = "PDF data".getBytes();
            MultipartFile file = mockFile("receipt.pdf", "application/pdf", content);

            String relative = service.store(42L, file);

            String monthDir = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy-MM"));
            assertThat(relative).startsWith("42/" + monthDir + "/");
            assertThat(relative).endsWith("_receipt.pdf");

            Path written = tempDir.resolve(relative);
            assertThat(Files.exists(written)).isTrue();
            assertThat(Files.readAllBytes(written)).isEqualTo(content);
        }

        @Test
        @DisplayName("creates org directory on demand")
        void createsOrgDir() throws IOException {
            byte[] content = "data".getBytes();
            MultipartFile file = mockFile("a.pdf", "application/pdf", content);

            service.store(7L, file);

            assertThat(Files.isDirectory(tempDir.resolve("7"))).isTrue();
        }

        @Test
        @DisplayName("uses default name when original filename is null")
        void nullFilename_defaults() throws IOException {
            byte[] content = "data".getBytes();
            MultipartFile file = mock(MultipartFile.class);
            when(file.isEmpty()).thenReturn(false);
            when(file.getSize()).thenReturn((long) content.length);
            when(file.getContentType()).thenReturn("application/pdf");
            when(file.getOriginalFilename()).thenReturn(null);
            when(file.getInputStream()).thenReturn(new ByteArrayInputStream(content));

            String path = service.store(1L, file);

            assertThat(path).endsWith("_receipt.pdf");
        }

        @Test
        @DisplayName("uses default name when original filename is blank")
        void blankFilename_defaults() throws IOException {
            byte[] content = "data".getBytes();
            MultipartFile file = mockFile("   ", "application/pdf", content);

            String path = service.store(1L, file);

            assertThat(path).endsWith("_receipt.pdf");
        }

        @Test
        @DisplayName("sanitizes unsafe filename characters")
        void sanitizesSpecialChars() throws IOException {
            byte[] content = "data".getBytes();
            // Stars/slashes are sanitized; dots are allowed (file extension support)
            MultipartFile file = mockFile("naughty*name?bad.pdf", "application/pdf", content);

            String path = service.store(1L, file);

            assertThat(path).doesNotContain("*");
            assertThat(path).doesNotContain("?");
            assertThat(path).endsWith(".pdf");
        }

        @Test
        @DisplayName("wraps IOException as DocumentStorageException")
        void ioFailure_wraps() throws IOException {
            MultipartFile file = mock(MultipartFile.class);
            when(file.isEmpty()).thenReturn(false);
            when(file.getSize()).thenReturn(100L);
            when(file.getContentType()).thenReturn("application/pdf");
            when(file.getOriginalFilename()).thenReturn("x.pdf");
            when(file.getInputStream()).thenThrow(new IOException("disk error"));

            assertThatThrownBy(() -> service.store(1L, file))
                    .isInstanceOf(DocumentStorageException.class)
                    .hasMessageContaining("Failed to store receipt");
        }
    }

    @Nested
    @DisplayName("delete")
    class Delete {

        @Test
        @DisplayName("removes existing file")
        void existingFile_deletes() throws IOException {
            MultipartFile file = mockFile("a.pdf", "application/pdf", "x".getBytes());
            String path = service.store(1L, file);
            Path on = tempDir.resolve(path);
            assertThat(Files.exists(on)).isTrue();

            service.delete(path);

            assertThat(Files.exists(on)).isFalse();
        }

        @Test
        @DisplayName("no-op for null path")
        void nullPath_noOp() {
            service.delete(null);
            // no exception
        }

        @Test
        @DisplayName("no-op for blank path")
        void blankPath_noOp() {
            service.delete("   ");
        }

        @Test
        @DisplayName("no-op for non-existing file")
        void nonExisting_noOp() {
            service.delete("999/2099-12/never_existed.pdf");
        }
    }

    @Nested
    @DisplayName("exists / load (inherited)")
    class InheritedOps {

        @Test
        @DisplayName("exists returns true for stored file")
        void existsTrue() throws IOException {
            MultipartFile file = mockFile("a.pdf", "application/pdf", "x".getBytes());
            String path = service.store(1L, file);

            assertThat(service.exists(path)).isTrue();
        }

        @Test
        @DisplayName("exists returns false for null")
        void existsFalseNull() {
            assertThat(service.exists(null)).isFalse();
        }

        @Test
        @DisplayName("load returns resource for stored file")
        void loadReturnsResource() throws IOException {
            MultipartFile file = mockFile("a.pdf", "application/pdf", "x".getBytes());
            String path = service.store(1L, file);

            assertThat(service.load(path)).isNotNull();
        }
    }
}
