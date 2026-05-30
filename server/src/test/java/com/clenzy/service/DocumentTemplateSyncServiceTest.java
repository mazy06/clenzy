package com.clenzy.service;

import com.clenzy.model.DocumentTemplate;
import com.clenzy.model.DocumentTemplateTag;
import com.clenzy.model.DocumentType;
import com.clenzy.model.TagCategory;
import com.clenzy.model.TagType;
import com.clenzy.repository.DocumentTemplateRepository;
import com.clenzy.repository.DocumentTemplateTagRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.context.ApplicationContext;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class DocumentTemplateSyncServiceTest {

    @Mock private DocumentTemplateRepository templateRepository;
    @Mock private DocumentTemplateTagRepository tagRepository;
    @Mock private TemplateParserService templateParserService;
    @Mock private ApplicationContext applicationContext;

    private DocumentTemplateSyncService service;

    @BeforeEach
    void setUp() {
        service = new DocumentTemplateSyncService(
                templateRepository, tagRepository, templateParserService, applicationContext);
    }

    private DocumentTemplate buildTemplate(Long id, String name, byte[] content, DocumentType type) {
        DocumentTemplate t = new DocumentTemplate();
        t.setId(id);
        t.setName(name);
        t.setDocumentType(type);
        t.setFileContent(content);
        t.setOriginalFilename("template.odt");
        t.setVersion(1);
        t.setTags(new ArrayList<>());
        return t;
    }

    private DocumentTemplateTag buildTag(String name) {
        DocumentTemplateTag tag = new DocumentTemplateTag();
        tag.setTagName(name);
        tag.setTagCategory(TagCategory.CLIENT);
        tag.setTagType(TagType.SIMPLE);
        tag.setRequired(false);
        return tag;
    }

    @Nested
    @DisplayName("syncBundledTemplates")
    class SyncBundledTemplates {

        @Test
        @DisplayName("delegates to self proxy for each bundled template (TX REQUIRES_NEW)")
        void delegatesToSelfProxy() throws IOException {
            DocumentTemplateSyncService selfProxy = mock(DocumentTemplateSyncService.class);
            when(applicationContext.getBean(DocumentTemplateSyncService.class)).thenReturn(selfProxy);

            service.syncBundledTemplates();

            // Only template_devis.odt -> DEVIS for now
            verify(selfProxy).syncOne("template_devis.odt", "DEVIS");
        }

        @Test
        @DisplayName("swallows individual sync errors so boot does not crash")
        void swallowsErrors() throws IOException {
            DocumentTemplateSyncService selfProxy = mock(DocumentTemplateSyncService.class);
            when(applicationContext.getBean(DocumentTemplateSyncService.class)).thenReturn(selfProxy);
            doThrow(new RuntimeException("boom")).when(selfProxy).syncOne(any(), any());

            // Should not throw
            service.syncBundledTemplates();

            verify(selfProxy).syncOne(any(), any());
        }
    }

    @Nested
    @DisplayName("syncOne")
    class SyncOne {

        @Test
        @DisplayName("returns silently when resource is missing on classpath")
        void resourceMissing_skips() throws IOException {
            service.syncOne("non_existent_template.odt", "DEVIS");

            verifyNoInteractions(templateRepository, tagRepository, templateParserService);
        }

        @Test
        @DisplayName("returns silently when no existing template matches the documentType")
        void noExistingTemplate_skips() throws IOException {
            when(templateRepository.findAll()).thenReturn(List.of());

            service.syncOne("template_devis.odt", "DEVIS");

            verify(templateRepository).findAll();
            verify(templateRepository, never()).save(any());
        }

        @Test
        @DisplayName("does not update when content hash matches bundled file")
        void contentInSync_doesNotSave() throws IOException {
            byte[] bundled = readBundled();
            DocumentTemplate existing = buildTemplate(1L, "Devis", bundled, DocumentType.DEVIS);
            when(templateRepository.findAll()).thenReturn(List.of(existing));

            service.syncOne("template_devis.odt", "DEVIS");

            verify(templateRepository, never()).save(any());
            verifyNoInteractions(tagRepository, templateParserService);
        }

        @Test
        @DisplayName("updates template content when hash differs and re-parses tags")
        void contentDiffers_updates() throws IOException {
            DocumentTemplate existing = buildTemplate(1L, "Devis",
                    "stale-content".getBytes(), DocumentType.DEVIS);
            existing.setVersion(3);
            when(templateRepository.findAll()).thenReturn(List.of(existing));
            when(templateParserService.parseTemplate(any(byte[].class)))
                    .thenReturn(List.of(buildTag("client.nom"), buildTag("client.email")));

            service.syncOne("template_devis.odt", "DEVIS");

            ArgumentCaptor<DocumentTemplate> savedCaptor = ArgumentCaptor.forClass(DocumentTemplate.class);
            verify(templateRepository).save(savedCaptor.capture());
            DocumentTemplate saved = savedCaptor.getValue();
            assertThat(saved.getFileContent().length).isGreaterThan(100); // ODT file
            assertThat(saved.getVersion()).isEqualTo(4); // bumped

            // Tags re-parsed and saved
            verify(tagRepository).saveAll(anyList());
            verify(tagRepository, atLeastOnce()).flush();
        }

        @Test
        @DisplayName("sets originalFilename when blank")
        void blankOriginalFilename_setFromResource() throws IOException {
            DocumentTemplate existing = buildTemplate(1L, "Devis",
                    "stale".getBytes(), DocumentType.DEVIS);
            existing.setOriginalFilename(""); // blank
            when(templateRepository.findAll()).thenReturn(List.of(existing));
            when(templateParserService.parseTemplate(any(byte[].class))).thenReturn(List.of());

            service.syncOne("template_devis.odt", "DEVIS");

            ArgumentCaptor<DocumentTemplate> savedCaptor = ArgumentCaptor.forClass(DocumentTemplate.class);
            verify(templateRepository).save(savedCaptor.capture());
            assertThat(savedCaptor.getValue().getOriginalFilename()).isEqualTo("template_devis.odt");
        }

        @Test
        @DisplayName("initializes version to 2 when null")
        void nullVersion_defaultsToTwo() throws IOException {
            DocumentTemplate existing = buildTemplate(1L, "Devis",
                    "stale".getBytes(), DocumentType.DEVIS);
            existing.setVersion(null);
            when(templateRepository.findAll()).thenReturn(List.of(existing));
            when(templateParserService.parseTemplate(any(byte[].class))).thenReturn(List.of());

            service.syncOne("template_devis.odt", "DEVIS");

            ArgumentCaptor<DocumentTemplate> savedCaptor = ArgumentCaptor.forClass(DocumentTemplate.class);
            verify(templateRepository).save(savedCaptor.capture());
            assertThat(savedCaptor.getValue().getVersion()).isEqualTo(2);
        }

        @Test
        @DisplayName("dedupes parsed tags by name before saving")
        void dedupesTags() throws IOException {
            DocumentTemplate existing = buildTemplate(1L, "Devis",
                    "stale".getBytes(), DocumentType.DEVIS);
            when(templateRepository.findAll()).thenReturn(List.of(existing));
            // Parser returns 3 tags but 2 share the same tagName
            when(templateParserService.parseTemplate(any(byte[].class))).thenReturn(List.of(
                    buildTag("client.nom"),
                    buildTag("client.nom"), // duplicate
                    buildTag("client.email")));

            service.syncOne("template_devis.odt", "DEVIS");

            @SuppressWarnings("unchecked")
            ArgumentCaptor<List<DocumentTemplateTag>> tagCaptor =
                    ArgumentCaptor.forClass(List.class);
            verify(tagRepository).saveAll(tagCaptor.capture());
            assertThat(tagCaptor.getValue()).hasSize(2);
        }

        @Test
        @DisplayName("deletes existing tags first then flushes before re-insert")
        void deletesAndFlushesExistingTags() throws IOException {
            DocumentTemplate existing = buildTemplate(1L, "Devis",
                    "stale".getBytes(), DocumentType.DEVIS);
            List<DocumentTemplateTag> oldTags = List.of(buildTag("old.tag"));
            existing.setTags(new ArrayList<>(oldTags));
            when(templateRepository.findAll()).thenReturn(List.of(existing));
            when(templateParserService.parseTemplate(any(byte[].class))).thenReturn(List.of());

            service.syncOne("template_devis.odt", "DEVIS");

            verify(tagRepository).deleteAll(oldTags);
            verify(tagRepository, atLeastOnce()).flush();
        }

        @Test
        @DisplayName("skips templates of other types")
        void filtersByDocumentType() throws IOException {
            DocumentTemplate facture = buildTemplate(99L, "Facture",
                    "anything".getBytes(), DocumentType.FACTURE);
            when(templateRepository.findAll()).thenReturn(List.of(facture));

            service.syncOne("template_devis.odt", "DEVIS");

            verify(templateRepository, never()).save(any());
        }

        @Test
        @DisplayName("ignores null documentType templates")
        void nullDocumentType_filteredOut() throws IOException {
            DocumentTemplate weird = buildTemplate(99L, "Bug",
                    "anything".getBytes(), null);
            when(templateRepository.findAll()).thenReturn(List.of(weird));

            service.syncOne("template_devis.odt", "DEVIS");

            verify(templateRepository, never()).save(any());
        }
    }

    /** Helper : read the actual bundled file. */
    private byte[] readBundled() throws IOException {
        try (var is = getClass().getResourceAsStream("/templates/template_devis.odt")) {
            assertThat(is).isNotNull();
            return is.readAllBytes();
        }
    }
}
