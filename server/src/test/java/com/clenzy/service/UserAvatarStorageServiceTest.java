package com.clenzy.service;

import com.clenzy.service.storage.BinaryAssetStorage;
import com.clenzy.service.storage.BinaryAssetStorage.StoredBinaryAsset;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.io.Resource;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserAvatarStorageServiceTest {

    @Mock private BinaryAssetStorage storage;

    private UserAvatarStorageService service;

    @BeforeEach
    void setUp() {
        service = new UserAvatarStorageService(storage);
    }

    @Test
    void store_validPng_persistsAndReturnsKey() {
        byte[] bytes = "fake-png-bytes".getBytes();
        MultipartFile file = new MockMultipartFile(
                "file", "avatar.png", "image/png", bytes);

        String key = service.store(42L, file);

        assertThat(key).startsWith("users/42/").endsWith(".png");
        verify(storage).store(eq(key), eq("image/png"), eq(bytes));
    }

    @Test
    void store_jpegFile_usesJpgExtension() {
        MultipartFile file = new MockMultipartFile(
                "f", "a.jpeg", "image/jpeg", new byte[]{1, 2, 3});

        String key = service.store(7L, file);

        assertThat(key).endsWith(".jpg").startsWith("users/7/");
    }

    @Test
    void store_webpFile_usesWebpExtension() {
        MultipartFile file = new MockMultipartFile(
                "f", "a.webp", "image/webp", new byte[]{1});

        String key = service.store(3L, file);

        assertThat(key).endsWith(".webp");
    }

    @Test
    void store_gifFile_usesGifExtension() {
        MultipartFile file = new MockMultipartFile(
                "f", "a.gif", "image/gif", new byte[]{1});

        String key = service.store(3L, file);

        assertThat(key).endsWith(".gif");
    }

    @Test
    void store_nullUserId_throws() {
        MultipartFile file = new MockMultipartFile(
                "f", "a.png", "image/png", new byte[]{1});

        assertThatThrownBy(() -> service.store(null, file))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("userId");
    }

    @Test
    void store_emptyFile_throws() {
        MultipartFile file = new MockMultipartFile(
                "f", "a.png", "image/png", new byte[0]);

        assertThatThrownBy(() -> service.store(1L, file))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("empty");
    }

    @Test
    void store_oversizeFile_throws() {
        byte[] big = new byte[(int) (UserAvatarStorageService.MAX_BYTES + 1)];
        MultipartFile file = new MockMultipartFile(
                "f", "a.png", "image/png", big);

        assertThatThrownBy(() -> service.store(1L, file))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("maximum size");
    }

    @Test
    void store_unsupportedContentType_throws() {
        MultipartFile file = new MockMultipartFile(
                "f", "a.pdf", "application/pdf", new byte[]{1});

        assertThatThrownBy(() -> service.store(1L, file))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Unsupported");
    }

    @Test
    void store_nullContentType_throws() {
        MultipartFile file = new MockMultipartFile(
                "f", "a.png", null, new byte[]{1});

        assertThatThrownBy(() -> service.store(1L, file))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void store_ioException_wrappedInRuntime() throws Exception {
        MultipartFile file = org.mockito.Mockito.mock(MultipartFile.class);
        when(file.isEmpty()).thenReturn(false);
        when(file.getSize()).thenReturn(10L);
        when(file.getContentType()).thenReturn("image/png");
        when(file.getBytes()).thenThrow(new IOException("disk full"));

        assertThatThrownBy(() -> service.store(1L, file))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Failed to read");
    }

    @Test
    void load_existing_returnsResource() throws IOException {
        byte[] bytes = "data".getBytes();
        when(storage.load("users/1/x.png"))
                .thenReturn(Optional.of(new StoredBinaryAsset(bytes, "image/png", bytes.length)));

        Resource r = service.load("users/1/x.png");

        assertThat(r).isNotNull();
        assertThat(r.contentLength()).isEqualTo(bytes.length);
    }

    @Test
    void load_missing_throws() {
        when(storage.load(anyString())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.load("nope"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("not found");
    }

    @Test
    void delete_validKey_callsStorage() {
        service.delete("users/1/x.png");
        verify(storage).delete("users/1/x.png");
    }

    @Test
    void delete_nullOrBlank_noOp() {
        service.delete(null);
        service.delete("");
        service.delete("   ");
        verify(storage, never()).delete(any());
    }

    @Test
    void exists_nullOrBlank_returnsFalse() {
        assertThat(service.exists(null)).isFalse();
        assertThat(service.exists("")).isFalse();
        assertThat(service.exists("  ")).isFalse();
        verify(storage, never()).exists(any());
    }

    @Test
    void exists_delegatesToStorage() {
        when(storage.exists("k")).thenReturn(true);
        assertThat(service.exists("k")).isTrue();
    }

    @Test
    void contentTypeFor_nullKey_returnsOctetStream() {
        assertThat(service.contentTypeFor(null)).isEqualTo("application/octet-stream");
    }

    @Test
    void contentTypeFor_pngExtension_returnsImagePng() {
        assertThat(service.contentTypeFor("users/1/x.png")).isEqualTo("image/png");
    }

    @Test
    void contentTypeFor_jpgExtension_returnsImageJpeg() {
        assertThat(service.contentTypeFor("users/1/x.jpg")).isEqualTo("image/jpeg");
        assertThat(service.contentTypeFor("users/1/x.jpeg")).isEqualTo("image/jpeg");
    }

    @Test
    void contentTypeFor_webpExtension_returnsImageWebp() {
        assertThat(service.contentTypeFor("users/1/x.webp")).isEqualTo("image/webp");
    }

    @Test
    void contentTypeFor_gifExtension_returnsImageGif() {
        assertThat(service.contentTypeFor("users/1/x.gif")).isEqualTo("image/gif");
    }

    @Test
    void contentTypeFor_unknownExtension_fallsBackToStorage() {
        when(storage.load("users/1/x"))
                .thenReturn(Optional.of(new StoredBinaryAsset(new byte[]{1}, "image/png", 1)));

        assertThat(service.contentTypeFor("users/1/x")).isEqualTo("image/png");
    }

    @Test
    void contentTypeFor_unknownExtensionStorageEmpty_fallsBackToOctetStream() {
        when(storage.load("users/1/y")).thenReturn(Optional.empty());

        assertThat(service.contentTypeFor("users/1/y")).isEqualTo("application/octet-stream");
    }
}
