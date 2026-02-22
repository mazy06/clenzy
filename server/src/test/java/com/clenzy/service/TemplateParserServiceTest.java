package com.clenzy.service;

import com.clenzy.model.DocumentTemplateTag;
import com.clenzy.model.TagCategory;
import com.clenzy.model.TagType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.assertj.core.api.Assertions.assertThat;

class TemplateParserServiceTest {

    private TemplateParserService service;

    @TempDir
    Path tempDir;

    @BeforeEach
    void setUp() {
        service = new TemplateParserService();
    }

    /**
     * Helper: create a fake .odt (ZIP with content.xml) containing the given XML content.
     */
    private Path createFakeOdt(String xmlContent) throws Exception {
        Path odtFile = tempDir.resolve("test-template.odt");
        try (ZipOutputStream zos = new ZipOutputStream(new FileOutputStream(odtFile.toFile()))) {
            ZipEntry entry = new ZipEntry("content.xml");
            zos.putNextEntry(entry);
            zos.write(xmlContent.getBytes(StandardCharsets.UTF_8));
            zos.closeEntry();
        }
        return odtFile;
    }

    // ===== PARSE TEMPLATE =====

    @Nested
    class ParseTemplate {

        @Test
        void whenOdtContainsSimpleVars_thenExtractsTags() throws Exception {
            String xml = "<text:p>${client.nom}</text:p><text:p>${client.email}</text:p>";
            Path odt = createFakeOdt(xml);

            List<DocumentTemplateTag> tags = service.parseTemplate(odt);

            assertThat(tags).hasSize(2);
            assertThat(tags).extracting(DocumentTemplateTag::getTagName)
                    .containsExactlyInAnyOrder("client.nom", "client.email");
        }

        @Test
        void whenOdtContainsListDirective_thenExtractsCollectionTag() throws Exception {
            String xml = "<text>[#list intervention.lignes as ligne]${ligne.description}[/#list]</text>";
            Path odt = createFakeOdt(xml);

            List<DocumentTemplateTag> tags = service.parseTemplate(odt);

            assertThat(tags).extracting(DocumentTemplateTag::getTagName)
                    .contains("intervention.lignes");
        }

        @Test
        void whenOdtContainsIfDirective_thenExtractsConditionVar() throws Exception {
            String xml = "<text>[#if client.siret??]SIRET: ${client.siret}[/#if]</text>";
            Path odt = createFakeOdt(xml);

            List<DocumentTemplateTag> tags = service.parseTemplate(odt);

            assertThat(tags).extracting(DocumentTemplateTag::getTagName)
                    .contains("client.siret");
        }

        @Test
        void whenOdtContainsDuplicateTags_thenDeduplicates() throws Exception {
            String xml = "<text>${client.nom} et encore ${client.nom}</text>";
            Path odt = createFakeOdt(xml);

            List<DocumentTemplateTag> tags = service.parseTemplate(odt);

            long nomCount = tags.stream()
                    .filter(t -> "client.nom".equals(t.getTagName()))
                    .count();
            assertThat(nomCount).isEqualTo(1);
        }

        @Test
        void whenOdtContainsComplexExpressions_thenIgnoresThem() throws Exception {
            String xml = "<text>${client.nom} ${client.nom?upper_case} ${total + tva}</text>";
            Path odt = createFakeOdt(xml);

            List<DocumentTemplateTag> tags = service.parseTemplate(odt);

            assertThat(tags).extracting(DocumentTemplateTag::getTagName)
                    .contains("client.nom")
                    .doesNotContain("client.nom?upper_case", "total + tva");
        }

        @Test
        void whenOdtIsEmpty_thenReturnsEmptyList() throws Exception {
            Path odt = createFakeOdt("<text></text>");

            List<DocumentTemplateTag> tags = service.parseTemplate(odt);

            assertThat(tags).isEmpty();
        }
    }

    // ===== CATEGORY DETECTION =====

    @Nested
    class CategoryDetection {

        @Test
        void whenPrefixIsClient_thenCategoryIsClient() throws Exception {
            Path odt = createFakeOdt("<t>${client.telephone}</t>");

            List<DocumentTemplateTag> tags = service.parseTemplate(odt);

            assertThat(tags).hasSize(1);
            assertThat(tags.get(0).getTagCategory()).isEqualTo(TagCategory.CLIENT);
        }

        @Test
        void whenPrefixIsProperty_thenCategoryIsProperty() throws Exception {
            Path odt = createFakeOdt("<t>${property.adresse}</t>");

            List<DocumentTemplateTag> tags = service.parseTemplate(odt);

            assertThat(tags.get(0).getTagCategory()).isEqualTo(TagCategory.PROPERTY);
        }

        @Test
        void whenPrefixIsUnknown_thenDefaultsToSystem() throws Exception {
            Path odt = createFakeOdt("<t>${custom_field}</t>");

            List<DocumentTemplateTag> tags = service.parseTemplate(odt);

            assertThat(tags.get(0).getTagCategory()).isEqualTo(TagCategory.SYSTEM);
        }
    }

    // ===== TYPE DETECTION =====

    @Nested
    class TypeDetection {

        @Test
        void whenFieldIsDate_thenTypeIsDate() throws Exception {
            Path odt = createFakeOdt("<t>${intervention.date_debut}</t>");

            List<DocumentTemplateTag> tags = service.parseTemplate(odt);

            assertThat(tags.get(0).getTagType()).isEqualTo(TagType.DATE);
        }

        @Test
        void whenFieldIsMoney_thenTypeIsMoney() throws Exception {
            Path odt = createFakeOdt("<t>${intervention.cout_estime}</t>");

            List<DocumentTemplateTag> tags = service.parseTemplate(odt);

            assertThat(tags.get(0).getTagType()).isEqualTo(TagType.MONEY);
        }

        @Test
        void whenFieldIsImage_thenTypeIsImage() throws Exception {
            Path odt = createFakeOdt("<t>${entreprise.logo}</t>");

            List<DocumentTemplateTag> tags = service.parseTemplate(odt);

            assertThat(tags.get(0).getTagType()).isEqualTo(TagType.IMAGE);
        }

        @Test
        void whenFieldIsSimple_thenTypeIsSimple() throws Exception {
            Path odt = createFakeOdt("<t>${client.nom}</t>");

            List<DocumentTemplateTag> tags = service.parseTemplate(odt);

            assertThat(tags.get(0).getTagType()).isEqualTo(TagType.SIMPLE);
        }
    }
}
