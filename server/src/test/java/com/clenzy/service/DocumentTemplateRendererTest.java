package com.clenzy.service;

import com.clenzy.exception.DocumentGenerationException;
import com.clenzy.exception.DocumentStorageException;
import com.clenzy.model.DocumentTemplate;
import com.clenzy.model.DocumentTemplateTag;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("DocumentTemplateRenderer")
class DocumentTemplateRendererTest {

    @Mock private DocumentTemplateStorageService templateStorageService;

    private DocumentTemplateRenderer renderer;

    @BeforeEach
    void setUp() {
        renderer = new DocumentTemplateRenderer(templateStorageService);
    }

    private static DocumentTemplateTag tag(String name) {
        DocumentTemplateTag t = new DocumentTemplateTag();
        t.setTagName(name);
        return t;
    }

    // ─── resolveTemplateContent ─────────────────────────────────────────────

    @Nested
    @DisplayName("resolveTemplateContent")
    class ResolveTemplateContent {

        @Test
        void whenFileContentPresent_thenReturnsItWithoutTouchingStorage() {
            // Arrange
            DocumentTemplate template = new DocumentTemplate();
            template.setFileContent(new byte[]{1, 2, 3});
            template.setFilePath("/legacy/path.odt");

            // Act
            byte[] content = renderer.resolveTemplateContent(template);

            // Assert
            assertThat(content).containsExactly(1, 2, 3);
            verifyNoInteractions(templateStorageService);
        }

        @Test
        void whenOnlyFilePathPresent_thenLoadsFromStorage() {
            // Arrange
            DocumentTemplate template = new DocumentTemplate();
            template.setFileContent(null);
            template.setFilePath("/legacy/path.odt");
            when(templateStorageService.loadAsBytes("/legacy/path.odt")).thenReturn(new byte[]{9});

            // Act
            byte[] content = renderer.resolveTemplateContent(template);

            // Assert
            assertThat(content).containsExactly(9);
            verify(templateStorageService).loadAsBytes("/legacy/path.odt");
        }

        @Test
        void whenNoContentAndNoPath_thenThrowsStorageException() {
            // Arrange
            DocumentTemplate template = new DocumentTemplate();
            template.setId(5L);
            template.setFileContent(null);
            template.setFilePath(null);

            // Act + Assert
            assertThatThrownBy(() -> renderer.resolveTemplateContent(template))
                    .isInstanceOf(DocumentStorageException.class)
                    .hasMessageContaining("5");
        }

        @Test
        void whenFilePathBlank_thenThrowsStorageException() {
            // Arrange
            DocumentTemplate template = new DocumentTemplate();
            template.setId(6L);
            template.setFileContent(null);
            template.setFilePath("   ");

            // Act + Assert
            assertThatThrownBy(() -> renderer.resolveTemplateContent(template))
                    .isInstanceOf(DocumentStorageException.class);
        }
    }

    // ─── ensureTemplateTagsPresent ──────────────────────────────────────────

    @Nested
    @DisplayName("ensureTemplateTagsPresent")
    class EnsureTemplateTagsPresent {

        @Test
        void whenAllTagsResolved_thenNoException() {
            // Arrange
            DocumentTemplate template = new DocumentTemplate();
            template.setName("T");
            template.setTags(List.of(tag("intervention.title")));
            Map<String, Object> context = new LinkedHashMap<>();
            context.put("intervention", new LinkedHashMap<>(Map.of("title", "Menage")));

            // Act + Assert
            assertThatCode(() -> renderer.ensureTemplateTagsPresent(template, context))
                    .doesNotThrowAnyException();
        }

        @Test
        void whenGroupMissing_thenThrowsWithExplicitTagList() {
            // Arrange
            DocumentTemplate template = new DocumentTemplate();
            template.setName("Bon intervention");
            template.setTags(List.of(tag("intervention.title")));
            Map<String, Object> context = new LinkedHashMap<>();
            context.put("client", new LinkedHashMap<>());

            // Act + Assert
            assertThatThrownBy(() -> renderer.ensureTemplateTagsPresent(template, context))
                    .isInstanceOf(DocumentGenerationException.class)
                    .hasMessageContaining("${intervention.title}")
                    .hasMessageContaining("groupe 'intervention' absent")
                    .hasMessageContaining("Bon intervention");
        }

        @Test
        void whenFieldMissingInGroup_thenThrowsWithFieldDetail() {
            // Arrange
            DocumentTemplate template = new DocumentTemplate();
            template.setName("T");
            template.setTags(List.of(tag("intervention.lignes")));
            Map<String, Object> context = new LinkedHashMap<>();
            context.put("intervention", new LinkedHashMap<>(Map.of("title", "Menage")));

            // Act + Assert
            assertThatThrownBy(() -> renderer.ensureTemplateTagsPresent(template, context))
                    .isInstanceOf(DocumentGenerationException.class)
                    .hasMessageContaining("champ 'lignes' absent du groupe 'intervention'");
        }

        @Test
        void whenNoTags_thenNoException() {
            // Arrange
            DocumentTemplate template = new DocumentTemplate();
            template.setTags(List.of());

            // Act + Assert
            assertThatCode(() -> renderer.ensureTemplateTagsPresent(template, new LinkedHashMap<>()))
                    .doesNotThrowAnyException();
        }

        @Test
        void whenTagWithoutDot_thenIgnored() {
            // Arrange : un tag sans namespace (pas de '.') est ignore par la validation
            DocumentTemplate template = new DocumentTemplate();
            template.setName("T");
            template.setTags(List.of(tag("orphanTag")));

            // Act + Assert
            assertThatCode(() -> renderer.ensureTemplateTagsPresent(template, new LinkedHashMap<>()))
                    .doesNotThrowAnyException();
        }
    }
}
