package com.clenzy.booking.service;

import com.clenzy.booking.dto.AutoTranslateResultDto;
import com.clenzy.booking.dto.BlogPostDto;
import com.clenzy.booking.dto.SitePageDto;
import com.clenzy.booking.model.BlogPost;
import com.clenzy.booking.model.Site;
import com.clenzy.booking.model.SitePage;
import com.clenzy.booking.model.SitePageType;
import com.clenzy.booking.model.SiteStatus;
import com.clenzy.booking.repository.BlogPostRepository;
import com.clenzy.booking.repository.SitePageRepository;
import com.clenzy.booking.repository.SiteRepository;
import com.clenzy.exception.ContentTranslationException;
import com.clenzy.exception.NotFoundException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Auto-traduction IA du contenu de site (P1) : brouillons cibles créés en DRAFT non publiés
 * ({@code aiGenerated=true}), markup/SEO traduits, échec IA non avalé, ownership cross-org refusé.
 * Le LLM est mocké au niveau de la brique partagée {@link SiteContentAiService}.
 */
@ExtendWith(MockitoExtension.class)
class ContentTranslationServiceTest {

    @Mock private SiteRepository siteRepository;
    @Mock private SitePageRepository pageRepository;
    @Mock private BlogPostRepository blogPostRepository;
    @Mock private SiteContentAiService translator;
    @Mock private ObjectProvider<ContentTranslationService> self;

    private ContentTranslationService service;

    private static final Long ORG = 1L;
    private static final Long SITE = 10L;
    private static final Long PAGE = 100L;
    private static final Long POST = 200L;

    @BeforeEach
    void setUp() {
        service = new ContentTranslationService(
            siteRepository, pageRepository, blogPostRepository, translator, new ObjectMapper(), self);
        // self.getObject() renvoie le service réel (pas de proxy en test) : les @Transactional internes
        // s'exécutent directement.
        lenient().when(self.getObject()).thenReturn(service);
    }

    private Site site(Long orgId) {
        Site s = new Site();
        s.setId(SITE);
        s.setOrganizationId(orgId);
        s.setDefaultLocale("fr");
        return s;
    }

    private SitePage sourcePage() {
        SitePage p = new SitePage();
        p.setId(PAGE);
        p.setSiteId(SITE);
        p.setPath("/about");
        p.setType(SitePageType.CUSTOM);
        p.setLocale("fr");
        p.setTitle("À propos");
        p.setBlocks("[{\"type\":\"hero\",\"props\":{\"heading\":\"Bienvenue\",\"imageUrl\":\"http://x/y.png\"}}]");
        p.setSeoTitle("À propos de nous");
        p.setSeoDescription("Notre histoire");
        p.setStatus(SiteStatus.PUBLISHED);
        return p;
    }

    private BlogPost sourcePost() {
        BlogPost b = new BlogPost();
        b.setId(POST);
        b.setSiteId(SITE);
        b.setOrganizationId(ORG);
        b.setSlug("mon-article");
        b.setLocale("fr");
        b.setTitle("Mon article");
        b.setExcerpt("Un résumé");
        b.setBody("<p>Bonjour le monde</p>");
        b.setSeoTitle("Titre SEO");
        b.setSeoDescription("Description SEO");
        b.setStatus(SiteStatus.PUBLISHED);
        return b;
    }

    // ─── Pages ────────────────────────────────────────────────────────────────

    @Test
    void autoTranslatePage_createsDraftVariant_aiGenerated_notPublished() {
        when(siteRepository.findByIdAndOrganizationId(SITE, ORG)).thenReturn(Optional.of(site(ORG)));
        when(pageRepository.findByIdAndSiteId(PAGE, SITE)).thenReturn(Optional.of(sourcePage()));
        when(pageRepository.findBySiteIdAndPathAndLocale(SITE, "/about", "en")).thenReturn(Optional.empty());
        // Champs courts : le mock renvoie la version "EN".
        when(translator.translateTextFields(eq(ORG), eq(List.of("À propos")), eq("en"))).thenReturn(List.of("About"));
        when(translator.translateTextFields(eq(ORG), eq(List.of("À propos de nous")), eq("en"))).thenReturn(List.of("About us"));
        when(translator.translateTextFields(eq(ORG), eq(List.of("Notre histoire")), eq("en"))).thenReturn(List.of("Our story"));
        // Blocs : seul le texte rédactionnel ("Bienvenue") est traduit ; imageUrl ignorée.
        when(translator.translateTextFields(eq(ORG), eq(List.of("Bienvenue")), eq("en"))).thenReturn(List.of("Welcome"));
        when(pageRepository.save(any(SitePage.class))).thenAnswer(inv -> inv.getArgument(0));

        AutoTranslateResultDto result = service.autoTranslatePage(ORG, SITE, PAGE, List.of("en"));

        assertThat(result.createdPages()).hasSize(1);
        SitePageDto draft = result.createdPages().get(0);
        assertThat(draft.locale()).isEqualTo("en");
        assertThat(draft.status()).isEqualTo("DRAFT");        // jamais publié automatiquement
        assertThat(draft.aiGenerated()).isTrue();
        assertThat(draft.reviewedAt()).isNull();
        assertThat(draft.title()).isEqualTo("About");
        assertThat(draft.seoTitle()).isEqualTo("About us");   // SEO traduit
        assertThat(draft.seoDescription()).isEqualTo("Our story");
        // Markup (blocs JSON) préservé : structure intacte, texte traduit, URL non touchée.
        assertThat(draft.blocks()).contains("\"heading\":\"Welcome\"");
        assertThat(draft.blocks()).contains("\"imageUrl\":\"http://x/y.png\"");
    }

    @Test
    void autoTranslatePage_skipsExistingVariant() {
        when(siteRepository.findByIdAndOrganizationId(SITE, ORG)).thenReturn(Optional.of(site(ORG)));
        when(pageRepository.findByIdAndSiteId(PAGE, SITE)).thenReturn(Optional.of(sourcePage()));
        when(pageRepository.findBySiteIdAndPathAndLocale(SITE, "/about", "en"))
            .thenReturn(Optional.of(new SitePage()));

        AutoTranslateResultDto result = service.autoTranslatePage(ORG, SITE, PAGE, List.of("en"));

        assertThat(result.createdPages()).isEmpty();
        assertThat(result.skippedLocales()).containsExactly("en");
        verify(pageRepository, never()).save(any());
    }

    @Test
    void autoTranslatePage_llmFailure_throwsExplicitly_notSwallowed() {
        when(siteRepository.findByIdAndOrganizationId(SITE, ORG)).thenReturn(Optional.of(site(ORG)));
        when(pageRepository.findByIdAndSiteId(PAGE, SITE)).thenReturn(Optional.of(sourcePage()));
        when(pageRepository.findBySiteIdAndPathAndLocale(SITE, "/about", "en")).thenReturn(Optional.empty());
        // L'IA échoue sur le titre → null (pas une traduction exploitable).
        when(translator.translateTextFields(eq(ORG), eq(List.of("À propos")), eq("en"))).thenReturn(null);

        assertThatThrownBy(() -> service.autoTranslatePage(ORG, SITE, PAGE, List.of("en")))
            .isInstanceOf(ContentTranslationException.class);
        verify(pageRepository, never()).save(any());
    }

    @Test
    void autoTranslatePage_rejectsSiteFromAnotherOrg() {
        when(siteRepository.findByIdAndOrganizationId(SITE, ORG)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.autoTranslatePage(ORG, SITE, PAGE, List.of("en")))
            .isInstanceOf(NotFoundException.class);
        verify(pageRepository, never()).save(any());
    }

    @Test
    void autoTranslatePage_noValidTarget_throws() {
        when(siteRepository.findByIdAndOrganizationId(SITE, ORG)).thenReturn(Optional.of(site(ORG)));
        when(pageRepository.findByIdAndSiteId(PAGE, SITE)).thenReturn(Optional.of(sourcePage()));

        // Seule cible = la langue source → aucune cible valide.
        assertThatThrownBy(() -> service.autoTranslatePage(ORG, SITE, PAGE, List.of("fr")))
            .isInstanceOf(IllegalArgumentException.class);
    }

    // ─── Articles ───────────────────────────────────────────────────────────────

    @Test
    void autoTranslatePost_createsDraft_bodyMarkupViaSharedBrick_arabicForRtl() {
        when(siteRepository.findByIdAndOrganizationId(SITE, ORG)).thenReturn(Optional.of(site(ORG)));
        when(blogPostRepository.findByIdAndSiteId(POST, SITE)).thenReturn(Optional.of(sourcePost()));
        when(blogPostRepository.findBySiteIdAndSlugAndLocale(SITE, "mon-article", "ar")).thenReturn(Optional.empty());
        when(translator.translateTextFields(eq(ORG), eq(List.of("Mon article")), eq("ar"))).thenReturn(List.of("مقالتي"));
        when(translator.translateTextFields(eq(ORG), eq(List.of("Un résumé")), eq("ar"))).thenReturn(List.of("ملخص"));
        when(translator.translateTextFields(eq(ORG), eq(List.of("Titre SEO")), eq("ar"))).thenReturn(List.of("عنوان"));
        when(translator.translateTextFields(eq(ORG), eq(List.of("Description SEO")), eq("ar"))).thenReturn(List.of("وصف"));
        // Corps : la brique markup-preserving renvoie le HTML traduit (markup conservé).
        when(translator.translateHtmlMarkup(eq(ORG), eq("<p>Bonjour le monde</p>"), eq("ar")))
            .thenReturn("<p>مرحبا بالعالم</p>");
        when(blogPostRepository.save(any(BlogPost.class))).thenAnswer(inv -> inv.getArgument(0));

        AutoTranslateResultDto result = service.autoTranslatePost(ORG, SITE, POST, List.of("ar"));

        assertThat(result.createdPosts()).hasSize(1);
        BlogPostDto draft = result.createdPosts().get(0);
        assertThat(draft.locale()).isEqualTo("ar");
        assertThat(draft.status()).isEqualTo("DRAFT");
        assertThat(draft.aiGenerated()).isTrue();
        assertThat(draft.reviewedAt()).isNull();
        assertThat(draft.title()).isEqualTo("مقالتي");
        // Markup du corps préservé (balises <p> intactes), texte traduit.
        assertThat(draft.body()).isEqualTo("<p>مرحبا بالعالم</p>");
        assertThat(draft.seoTitle()).isEqualTo("عنوان");
    }

    @Test
    void autoTranslatePost_rejectsPostFromAnotherOrg() {
        when(siteRepository.findByIdAndOrganizationId(SITE, ORG)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.autoTranslatePost(ORG, SITE, POST, List.of("en")))
            .isInstanceOf(NotFoundException.class);
        verify(blogPostRepository, never()).save(any());
    }

    @Test
    void autoTranslatePost_llmFieldFailure_throwsExplicitly_notSwallowed() {
        when(siteRepository.findByIdAndOrganizationId(SITE, ORG)).thenReturn(Optional.of(site(ORG)));
        when(blogPostRepository.findByIdAndSiteId(POST, SITE)).thenReturn(Optional.of(sourcePost()));
        when(blogPostRepository.findBySiteIdAndSlugAndLocale(SITE, "mon-article", "en")).thenReturn(Optional.empty());
        // L'IA échoue sur le titre → null : l'échec remonte (pas avalé), aucune variante persistée.
        when(translator.translateTextFields(eq(ORG), eq(List.of("Mon article")), eq("en"))).thenReturn(null);

        assertThatThrownBy(() -> service.autoTranslatePost(ORG, SITE, POST, List.of("en")))
            .isInstanceOf(ContentTranslationException.class);
        verify(blogPostRepository, never()).save(any());
    }
}
