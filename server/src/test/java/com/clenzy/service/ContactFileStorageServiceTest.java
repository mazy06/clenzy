package com.clenzy.service;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.core.io.Resource;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ContactFileStorageServiceTest {

    @TempDir
    Path tempDir;

    private ContactFileStorageService storageService;
    private MeterRegistry meterRegistry;

    @BeforeEach
    void setUp() {
        meterRegistry = new SimpleMeterRegistry();
        storageService = new ContactFileStorageService(tempDir.toString(), meterRegistry);
        storageService.init();
    }

    private MultipartFile mockMultipartFile(String filename, byte[] content) throws IOException {
        MultipartFile file = mock(MultipartFile.class);
        when(file.getOriginalFilename()).thenReturn(filename);
        when(file.getInputStream()).thenReturn(new ByteArrayInputStream(content));
        when(file.getSize()).thenReturn((long) content.length);
        return file;
    }

    @Nested
    @DisplayName("store")
    class Store {

        @Test
        @DisplayName("should store file and return relative path")
        void whenValidFile_thenStoresAndReturnsPath() throws IOException {
            // Arrange
            byte[] content = "Hello World".getBytes();
            MultipartFile file = mockMultipartFile("report.pdf", content);

            // Act
            String storagePath = storageService.store(42L, "abc-uuid", "report.pdf", file);

            // Assert
            assertThat(storagePath).isEqualTo("42/abc-uuid_report.pdf");
            Path stored = tempDir.resolve("42/abc-uuid_report.pdf");
            assertThat(Files.exists(stored)).isTrue();
            assertThat(Files.readAllBytes(stored)).isEqualTo(content);
        }

        @Test
        @DisplayName("should create message directory if it does not exist")
        void whenMessageDirMissing_thenCreatesIt() throws IOException {
            // Arrange
            byte[] content = "data".getBytes();
            MultipartFile file = mockMultipartFile("file.txt", content);

            // Act
            storageService.store(99L, "uuid-123", "file.txt", file);

            // Assert
            assertThat(Files.isDirectory(tempDir.resolve("99"))).isTrue();
        }

        @Test
        @DisplayName("should overwrite existing file with same name")
        void whenFileAlreadyExists_thenOverwrites() throws IOException {
            // Arrange
            byte[] original = "original".getBytes();
            byte[] updated = "updated".getBytes();
            MultipartFile file1 = mockMultipartFile("doc.txt", original);
            MultipartFile file2 = mockMultipartFile("doc.txt", updated);

            // Act
            storageService.store(1L, "uuid-1", "doc.txt", file1);
            storageService.store(1L, "uuid-1", "doc.txt", file2);

            // Assert
            Path stored = tempDir.resolve("1/uuid-1_doc.txt");
            assertThat(Files.readAllBytes(stored)).isEqualTo(updated);
        }

        @Test
        @DisplayName("should detect path traversal attempt when resolved path escapes uploadDir")
        void whenPathTraversal_thenThrowsSecurityException() throws Exception {
            // Arrange
            // Use toRealPath to handle macOS /var -> /private/var symlink
            Path rootDir = Files.createTempDirectory("clenzy-test-upload").toRealPath();
            ContactFileStorageService realService = new ContactFileStorageService(
                    rootDir.toString(), meterRegistry);
            realService.init();

            byte[] content = "malicious".getBytes();
            MultipartFile file = mockMultipartFile("passwd", content);

            // store() builds: diskFilename = attachmentId + "_" + filename
            // With attachmentId="../../.." and filename="passwd":
            //   diskFilename = "../../../.._passwd"
            //   target = rootDir/1/../../../.._passwd
            //   normalize -> two levels above rootDir + ".._passwd"
            //   This does NOT startsWith rootDir -> SecurityException
            // Act & Assert
            assertThatThrownBy(() -> realService.store(1L, "../../..", "passwd", file))
                    .isInstanceOf(SecurityException.class)
                    .hasMessageContaining("Path traversal");

            // Cleanup
            Files.deleteIfExists(rootDir.resolve("1"));
            Files.deleteIfExists(rootDir);
        }

        @Test
        @DisplayName("should throw RuntimeException when IO fails")
        void whenIOFails_thenThrowsRuntimeException() throws IOException {
            // Arrange
            MultipartFile file = mock(MultipartFile.class);
            when(file.getInputStream()).thenThrow(new IOException("Disk full"));

            // Act & Assert
            assertThatThrownBy(() -> storageService.store(1L, "uuid-1", "file.txt", file))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Failed to store attachment");
        }
    }

    @Nested
    @DisplayName("load")
    class Load {

        @Test
        @DisplayName("should return a Resource for an existing file")
        void whenFileExists_thenReturnsResource() throws IOException {
            // Arrange
            byte[] content = "content data".getBytes();
            MultipartFile file = mockMultipartFile("report.pdf", content);
            String path = storageService.store(1L, "uuid-1", "report.pdf", file);

            // Act
            Resource resource = storageService.load(path);

            // Assert
            assertThat(resource).isNotNull();
            assertThat(resource.exists()).isTrue();
        }

        @Test
        @DisplayName("should throw NoSuchFileException when file does not exist")
        void whenFileNotFound_thenThrowsRuntimeException() {
            // Act & Assert
            assertThatThrownBy(() -> storageService.load("999/nonexistent_file.pdf"))
                    .isInstanceOf(RuntimeException.class);
        }

        @Test
        @DisplayName("should detect path traversal attempt on load")
        void whenPathTraversalOnLoad_thenThrowsSecurityException() {
            // Act & Assert
            assertThatThrownBy(() -> storageService.load("../../etc/passwd"))
                    .isInstanceOf(SecurityException.class)
                    .hasMessageContaining("Path traversal");
        }
    }

    @Nested
    @DisplayName("exists")
    class Exists {

        @Test
        @DisplayName("should return true when file exists")
        void whenFileExists_thenReturnsTrue() throws IOException {
            // Arrange
            byte[] content = "data".getBytes();
            MultipartFile file = mockMultipartFile("file.txt", content);
            String path = storageService.store(1L, "uuid-1", "file.txt", file);

            // Act
            boolean result = storageService.exists(path);

            // Assert
            assertThat(result).isTrue();
        }

        @Test
        @DisplayName("should return false when file does not exist")
        void whenFileNotFound_thenReturnsFalse() {
            // Act
            boolean result = storageService.exists("999/nonexistent.txt");

            // Assert
            assertThat(result).isFalse();
        }

        @Test
        @DisplayName("should return false when storage path is null")
        void whenNullPath_thenReturnsFalse() {
            // Act
            boolean result = storageService.exists(null);

            // Assert
            assertThat(result).isFalse();
        }

        @Test
        @DisplayName("should return false when storage path is blank")
        void whenBlankPath_thenReturnsFalse() {
            // Act
            boolean result = storageService.exists("   ");

            // Assert
            assertThat(result).isFalse();
        }

        @Test
        @DisplayName("should return false for path traversal attempt")
        void whenPathTraversal_thenReturnsFalse() {
            // Act - path traversal will resolve outside uploadDir
            boolean result = storageService.exists("../../etc/passwd");

            // Assert
            assertThat(result).isFalse();
        }
    }

    @Nested
    @DisplayName("updateStorageMetrics")
    class UpdateStorageMetrics {

        @Test
        @DisplayName("should compute metrics after storing files")
        void whenFilesStored_thenMetricsUpdated() throws IOException {
            // Arrange
            byte[] content1 = "file1 content".getBytes();
            byte[] content2 = "file2 content longer".getBytes();
            storageService.store(1L, "uuid-1", "file1.txt", mockMultipartFile("file1.txt", content1));
            storageService.store(2L, "uuid-2", "file2.txt", mockMultipartFile("file2.txt", content2));

            // Act
            storageService.updateStorageMetrics();

            // Assert - metrics should be registered
            assertThat(meterRegistry.find("clenzy.storage.contact.file_count").gauge()).isNotNull();
            assertThat(meterRegistry.find("clenzy.storage.contact.total_bytes").gauge()).isNotNull();
            assertThat(meterRegistry.find("clenzy.storage.contact.disk_free_bytes").gauge()).isNotNull();
            assertThat(meterRegistry.find("clenzy.storage.contact.disk_total_bytes").gauge()).isNotNull();
        }
    }

    @Nested
    @DisplayName("init")
    class Init {

        @Test
        @DisplayName("should create upload directory on init")
        void whenInit_thenCreatesDirectory() {
            // Assert - directory should exist after setUp -> init()
            assertThat(Files.isDirectory(tempDir)).isTrue();
        }
    }
}
