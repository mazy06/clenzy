package com.clenzy.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Tests for {@link AttachmentValidator}.
 * Validates sanitization, filtering, count limits, and size limits.
 */
class AttachmentValidatorTest {

    @Nested
    @DisplayName("sanitizeAndFilter")
    class SanitizeAndFilter {

        @Test
        void whenNullList_thenReturnsEmptyList() {
            List<MultipartFile> result = AttachmentValidator.sanitizeAndFilter(null);
            assertThat(result).isEmpty();
        }

        @Test
        void whenEmptyList_thenReturnsEmptyList() {
            List<MultipartFile> result = AttachmentValidator.sanitizeAndFilter(List.of());
            assertThat(result).isEmpty();
        }

        @Test
        void whenListContainsNulls_thenFiltersThemOut() {
            List<MultipartFile> input = new ArrayList<>();
            input.add(null);
            input.add(new MockMultipartFile("file", "test.pdf", "application/pdf", "content".getBytes()));
            input.add(null);

            List<MultipartFile> result = AttachmentValidator.sanitizeAndFilter(input);

            assertThat(result).hasSize(1);
        }

        @Test
        void whenListContainsEmptyFiles_thenFiltersThemOut() {
            List<MultipartFile> input = List.of(
                    new MockMultipartFile("file1", "empty.pdf", "application/pdf", new byte[0]),
                    new MockMultipartFile("file2", "real.pdf", "application/pdf", "content".getBytes())
            );

            List<MultipartFile> result = AttachmentValidator.sanitizeAndFilter(input);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).getOriginalFilename()).isEqualTo("real.pdf");
        }

        @Test
        void whenAllFilesValid_thenReturnsAll() {
            List<MultipartFile> input = List.of(
                    new MockMultipartFile("f1", "a.pdf", "application/pdf", "a".getBytes()),
                    new MockMultipartFile("f2", "b.pdf", "application/pdf", "b".getBytes())
            );

            List<MultipartFile> result = AttachmentValidator.sanitizeAndFilter(input);

            assertThat(result).hasSize(2);
        }
    }

    @Nested
    @DisplayName("validate")
    class Validate {

        @Test
        void whenWithinLimits_thenNoException() {
            List<MultipartFile> files = List.of(
                    new MockMultipartFile("f1", "a.pdf", "application/pdf", new byte[100]),
                    new MockMultipartFile("f2", "b.pdf", "application/pdf", new byte[200])
            );

            // Should not throw
            AttachmentValidator.validate(files, 5, 1024);
        }

        @Test
        void whenTooManyFiles_thenThrowsIllegalArgument() {
            List<MultipartFile> files = List.of(
                    new MockMultipartFile("f1", "a.pdf", "application/pdf", "a".getBytes()),
                    new MockMultipartFile("f2", "b.pdf", "application/pdf", "b".getBytes()),
                    new MockMultipartFile("f3", "c.pdf", "application/pdf", "c".getBytes())
            );

            assertThatThrownBy(() -> AttachmentValidator.validate(files, 2, 10_000))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Trop de pieces jointes")
                    .hasMessageContaining("max 2");
        }

        @Test
        void whenFileTooLarge_thenThrowsIllegalArgument() {
            List<MultipartFile> files = List.of(
                    new MockMultipartFile("f1", "big.pdf", "application/pdf", new byte[5000])
            );

            assertThatThrownBy(() -> AttachmentValidator.validate(files, 10, 1000))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("trop volumineuse");
        }

        @Test
        void whenExactlyAtLimit_thenNoException() {
            List<MultipartFile> files = List.of(
                    new MockMultipartFile("f1", "a.pdf", "application/pdf", new byte[1000])
            );

            // Exactly at limit should be fine (size == maxSizeBytes is not > maxSizeBytes)
            AttachmentValidator.validate(files, 1, 1000);
        }
    }
}
