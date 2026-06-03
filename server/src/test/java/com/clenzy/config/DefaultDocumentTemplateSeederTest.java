package com.clenzy.config;

import com.clenzy.model.DocumentTemplate;
import com.clenzy.model.DocumentTemplateTag;
import com.clenzy.model.DocumentType;
import com.clenzy.model.Organization;
import com.clenzy.repository.DocumentTemplateRepository;
import com.clenzy.repository.DocumentTemplateTagRepository;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.service.TemplateParserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires pour {@link DefaultDocumentTemplateSeeder}.
 *
 * <p>On mocke les repositories, le parser et le PlatformTransactionManager.
 * Le {@code TransactionTemplate} construit dans le constructeur execute le
 * callback de maniere synchrone avec un manager mocke (getTransaction renvoie
 * null, commit est un no-op).</p>
 *
 * <p>La ressource ODT reelle (src/main/resources) est sur le classpath de test :
 * le chemin heureux valide donc aussi que le fichier embarque est lisible.</p>
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("DefaultDocumentTemplateSeeder")
class DefaultDocumentTemplateSeederTest {

    @Mock private DocumentTemplateRepository templateRepository;
    @Mock private DocumentTemplateTagRepository tagRepository;
    @Mock private OrganizationRepository organizationRepository;
    @Mock private TemplateParserService templateParserService;
    @Mock private PlatformTransactionManager transactionManager;

    private DefaultDocumentTemplateSeeder seeder;

    @BeforeEach
    void setUp() {
        seeder = new DefaultDocumentTemplateSeeder(templateRepository, tagRepository,
                organizationRepository, templateParserService, transactionManager);
        ReflectionTestUtils.setField(seeder, "enabled", true);
        ReflectionTestUtils.setField(seeder, "orgName", "Clenzy");
    }

    @Test
    @DisplayName("run: feature flag desactive -> aucune interaction")
    void run_disabled_doesNothing() {
        ReflectionTestUtils.setField(seeder, "enabled", false);

        seeder.run(null);

        verifyNoInteractions(templateRepository, organizationRepository,
                tagRepository, templateParserService, transactionManager);
    }

    @Test
    @DisplayName("run: un template DEVIS actif existe deja -> idempotent, pas d'insert")
    void run_activeDevisExists_skips() {
        when(templateRepository.existsByDocumentTypeAndActiveTrue(DocumentType.DEVIS)).thenReturn(true);

        seeder.run(null);

        verify(organizationRepository, never()).findByName(any());
        verify(templateRepository, never()).save(any());
        verify(tagRepository, never()).saveAll(anyList());
    }

    @Test
    @DisplayName("run: organisation Clenzy introuvable -> pas d'insert")
    void run_orgMissing_skips() {
        when(templateRepository.existsByDocumentTypeAndActiveTrue(DocumentType.DEVIS)).thenReturn(false);
        when(organizationRepository.findByName("Clenzy")).thenReturn(Optional.empty());

        seeder.run(null);

        verify(templateRepository, never()).save(any());
        verify(tagRepository, never()).saveAll(anyList());
    }

    @Test
    @DisplayName("run: chemin heureux -> insert template DEVIS actif, org Clenzy, tags lies")
    void run_happyPath_seedsActiveDevisTemplate() {
        Organization org = org(42L);
        when(templateRepository.existsByDocumentTypeAndActiveTrue(DocumentType.DEVIS)).thenReturn(false);
        when(organizationRepository.findByName("Clenzy")).thenReturn(Optional.of(org));
        when(templateRepository.save(any(DocumentTemplate.class))).thenAnswer(inv -> inv.getArgument(0));
        DocumentTemplateTag tag = new DocumentTemplateTag();
        when(templateParserService.parseTemplate(any(byte[].class))).thenReturn(List.of(tag));

        seeder.run(null);

        ArgumentCaptor<DocumentTemplate> captor = ArgumentCaptor.forClass(DocumentTemplate.class);
        verify(templateRepository).save(captor.capture());
        DocumentTemplate saved = captor.getValue();
        assertThat(saved.getDocumentType()).isEqualTo(DocumentType.DEVIS);
        assertThat(saved.getOrganizationId()).isEqualTo(42L);
        assertThat(saved.isActive()).isTrue();
        assertThat(saved.getName()).isEqualTo("Devis Clenzy");
        assertThat(saved.getOriginalFilename()).isEqualTo("Devis Clenzy.odt");
        assertThat(saved.getFileContent()).isNotEmpty();

        verify(tagRepository).saveAll(anyList());
        assertThat(tag.getTemplate()).isSameAs(saved);
    }

    @Test
    @DisplayName("run: template seed actif au contenu different -> mis a jour (re-seed par checksum)")
    void run_seededTemplateChanged_updatesContent() {
        DocumentTemplate active = new DocumentTemplate();
        active.setDocumentType(DocumentType.DEVIS);
        active.setActive(true);
        active.setCreatedBy("system-seed");
        active.setFileContent("ancien-contenu-different".getBytes());
        active.setVersion(1);
        when(templateRepository.existsByDocumentTypeAndActiveTrue(DocumentType.DEVIS)).thenReturn(true);
        when(templateRepository.findByDocumentTypeAndActiveTrue(DocumentType.DEVIS)).thenReturn(Optional.of(active));
        when(templateRepository.save(any(DocumentTemplate.class))).thenAnswer(inv -> inv.getArgument(0));

        seeder.run(null);

        ArgumentCaptor<DocumentTemplate> captor = ArgumentCaptor.forClass(DocumentTemplate.class);
        verify(templateRepository).save(captor.capture());
        DocumentTemplate saved = captor.getValue();
        // Le contenu a ete remplace par le .odt embarque (non vide, different de l'ancien).
        assertThat(saved.getFileContent()).isNotEmpty();
        assertThat(new String(saved.getFileContent())).isNotEqualTo("ancien-contenu-different");
        assertThat(saved.getVersion()).isEqualTo(2);
        // Pas de nouvel insert : on a juste mis a jour la ligne existante.
        verify(organizationRepository, never()).findByName(any());
        verify(tagRepository, never()).saveAll(anyList());
    }

    @Test
    @DisplayName("run: template DEVIS personnalise par un admin -> jamais ecrase")
    void run_customizedTemplate_notOverwritten() {
        DocumentTemplate active = new DocumentTemplate();
        active.setDocumentType(DocumentType.DEVIS);
        active.setActive(true);
        active.setCreatedBy("admin-user");
        active.setFileContent("template-personnalise".getBytes());
        active.setVersion(3);
        when(templateRepository.existsByDocumentTypeAndActiveTrue(DocumentType.DEVIS)).thenReturn(true);
        when(templateRepository.findByDocumentTypeAndActiveTrue(DocumentType.DEVIS)).thenReturn(Optional.of(active));

        seeder.run(null);

        verify(templateRepository, never()).save(any());
    }

    @Test
    @DisplayName("run: exception interne -> swallowed, ne bloque pas le boot")
    void run_swallowsException() {
        when(templateRepository.existsByDocumentTypeAndActiveTrue(DocumentType.DEVIS))
                .thenThrow(new RuntimeException("DB down"));

        // Ne propage pas l'exception.
        seeder.run(null);

        verify(templateRepository, never()).save(any());
    }

    private static Organization org(Long id) {
        Organization org = new Organization();
        ReflectionTestUtils.setField(org, "id", id);
        return org;
    }
}
