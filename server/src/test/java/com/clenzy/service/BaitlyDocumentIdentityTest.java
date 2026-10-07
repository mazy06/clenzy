package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.FiscalProfileRepository;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.service.tags.ReferenceTagResolver;
import com.clenzy.tenant.TenantContext;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Émetteur distinct de l'administrateur, du propriétaire et du fournisseur destinataire. */
class BaitlyDocumentIdentityTest {
    private final OrganizationRepository organizations = mock(OrganizationRepository.class);
    private final FiscalProfileRepository profiles = mock(FiscalProfileRepository.class);
    private final BaitlyDocumentIdentity identity = new BaitlyDocumentIdentity(organizations, profiles);

    @BeforeEach void fixtures() {
        organization(7L, "Conciergerie <TEST> & associés");
        organization(9L, "Gestion Atlas TEST");
    }

    private void organization(Long id, String name) {
        var org = new Organization(); org.setId(id); org.setName(name);
        when(organizations.findById(id)).thenReturn(Optional.of(org));
    }

    @Test void organizationIsUsedWithoutInventingPlatformContacts() {
        assertThat(identity.organization(7L, "FR")).containsEntry("nom", "Conciergerie <TEST> & associés")
                .containsEntry("email", "").containsEntry("telephone", "");
        assertThat(identity.name(9L, "MA")).isEqualTo("Gestion Atlas TEST");
    }

    @Test void fiscalCountrySelectsTheLegalIssuerWithoutBorrowingAnotherCountrysIdentifiers() {
        var profile = new FiscalProfile(7L, "MA", "MAD");
        profile.setLegalEntityName("Conciergerie Maroc TEST"); profile.setTaxIdNumber("TEST-ICE");
        when(profiles.findByOrganizationIdAndCountryCode(7L, "MA")).thenReturn(Optional.of(profile));
        assertThat(identity.organization(7L, "ma")).containsEntry("nom", "Conciergerie Maroc TEST").containsEntry("siret", "TEST-ICE");
        assertThat(identity.organization(7L, "FR")).containsEntry("nom", "Conciergerie <TEST> & associés").containsEntry("siret", "");
        verify(profiles, never()).findByOrganizationId(7L);
    }

    @Test void platformDocumentsUseBaitlyAndOldBrandIsNormalized() {
        assertThat(identity.name(null, null)).isEqualTo("Baitly");
        assertThat(BaitlyDocumentIdentity.displayName("CLENZY France")).isEqualTo("Baitly France");
        assertThat(BaitlyDocumentIdentity.displayName("Conciergerie Atlas")).isEqualTo("Conciergerie Atlas");
        verifyNoInteractions(profiles);
    }

    @Test void unknownOrUnnamedOrganizationNeverBecomesBaitly() {
        organization(12L, " ");
        assertThatThrownBy(() -> identity.name(404L, "FR")).hasMessageContaining("introuvable");
        assertThatThrownBy(() -> identity.name(12L, "FR")).hasMessageContaining("nom de l'organisation");
    }

    @Test void providerIssuesTheirQuoteButOrganizationIssuesTheirPurchaseOrder() {
        var provider = Map.<String, Object>of("nom", "Entreprise entretien TEST", "email", "test@example.invalid");
        var context = new LinkedHashMap<String, Object>(); context.put("emetteur_prestataire", provider);
        identity.apply(7L, "FR", DocumentType.DEVIS_PRESTATAIRE, "SERVICE_QUOTE", context);
        assertThat(((Map<?, ?>) context.get("entreprise")).get("nom")).isEqualTo("Entreprise entretien TEST");
        identity.apply(7L, "FR", DocumentType.BON_COMMANDE, "PROVIDER_EXPENSE", context);
        assertThat(((Map<?, ?>) context.get("entreprise")).get("nom")).isEqualTo("Conciergerie <TEST> & associés");
        assertThat(provider).containsEntry("nom", "Entreprise entretien TEST");
    }

    @Test void unidentifiedProviderCannotIssueQuoteInOrganizationsName() {
        assertThatThrownBy(() -> identity.apply(7L, "FR", DocumentType.DEVIS_PRESTATAIRE, "service_quote", new LinkedHashMap<>()))
                .hasMessageContaining("Émetteur du devis");
    }

    @Test void quoteResolverUsesItsProviderEvenIfMissionHasAnotherAssignee() {
        var quotes = mock(com.clenzy.repository.ServiceQuoteRepository.class);
        var users = mock(com.clenzy.repository.UserRepository.class);
        var mission = mock(com.clenzy.service.tags.InterventionTagResolver.class);
        var builders = mock(com.clenzy.service.tags.EntityTagBuilders.class);
        var quote = new ServiceQuote(); quote.setId(42L); quote.setInterventionId(18L);
        quote.setProviderUserId(27L); quote.setAmount(new java.math.BigDecimal("75.00")); quote.setCurrency("EUR");
        when(quotes.findById(42L)).thenReturn(Optional.of(quote));
        var provider = new User(); provider.setCompanyName("Prestataire du devis TEST");
        when(users.findById(27L)).thenReturn(Optional.of(provider));
        doAnswer(call -> { Map<String, Object> ctx = call.getArgument(1);
            ctx.put("technicien", Map.of("nom_complet", "Autre intervenant")); return null;
        }).when(mission).resolve(eq(18L), any());
        var resolver = new com.clenzy.service.tags.ServiceQuoteTagResolver(quotes, mission, builders, users);
        var tags = new TagResolverService(List.of(resolver), identity, mock(TenantContext.class));
        var context = tags.resolveTagsForDocument(DocumentType.DEVIS_PRESTATAIRE, 42L, "service_quote", 7L, "FR");
        assertThat(((Map<?, ?>) context.get("entreprise")).get("nom")).isEqualTo("Prestataire du devis TEST");
    }

    @Test void externalProviderQuoteKeepsItsRecordedNameWithoutBorrowingOrganizationsIdentity() {
        var quotes = mock(com.clenzy.repository.ServiceQuoteRepository.class);
        var quote = new ServiceQuote(); quote.setId(42L); quote.setProviderName("Fournisseur externe TEST");
        quote.setAmount(java.math.BigDecimal.TEN); quote.setCurrency("EUR");
        when(quotes.findById(42L)).thenReturn(Optional.of(quote));
        var resolver = new com.clenzy.service.tags.ServiceQuoteTagResolver(quotes,
                mock(com.clenzy.service.tags.InterventionTagResolver.class), mock(com.clenzy.service.tags.EntityTagBuilders.class),
                mock(com.clenzy.repository.UserRepository.class));
        var tags = new TagResolverService(List.of(resolver), identity, mock(TenantContext.class));
        var context = tags.resolveTagsForDocument(DocumentType.DEVIS_PRESTATAIRE, 42L, "service_quote", 7L, "FR");
        assertThat(((Map<?, ?>) context.get("entreprise")).get("nom")).isEqualTo("Fournisseur externe TEST");
    }

    @Test void explicitGenerationOrganizationWinsOverLoggedInAdminAndTemplateOwner() {
        var tenant = mock(TenantContext.class);
        when(tenant.getOrganizationId()).thenReturn(9L);
        when(tenant.getCountryCode()).thenReturn("MA");
        ReferenceTagResolver resolver = mock(ReferenceTagResolver.class);
        when(resolver.referenceType()).thenReturn("management_contract");
        var tags = new TagResolverService(List.of(resolver), identity, tenant);
        var explicit = tags.resolveTagsForDocument(DocumentType.MANDAT_GESTION, 1L, "management_contract", 7L, "FR");
        assertThat(((Map<?, ?>) explicit.get("entreprise")).get("nom")).isEqualTo("Conciergerie <TEST> & associés");
        var current = tags.resolveTagsForDocument(DocumentType.MANDAT_GESTION, 1L, "management_contract");
        assertThat(((Map<?, ?>) current.get("entreprise")).get("nom")).isEqualTo("Gestion Atlas TEST");
    }

    @Test void nativeAndHistoricalMandatesHaveTheSameIssuerAndEscapeItsName() throws Exception {
        for (String name : List.of("mandat-gestion-baitly.html", "mandat-gestion-clenzy.odt")) {
            byte[] source;
            try (var in = getClass().getResourceAsStream("/seed/document-templates/" + name)) { source = in.readAllBytes(); }
            var template = new DocumentTemplate(); template.setTags(new TemplateParserService().parseTemplate(source));
            var renderer = new DocumentTemplateRenderer(null);
            var context = new LinkedHashMap<String, Object>();
            identity.apply(7L, "FR", DocumentType.MANDAT_GESTION, "management_contract", context);
            renderer.fillMissingTags(template, context, true);
            String html = new String(renderer.fillTemplate(source, context), StandardCharsets.UTF_8);
            var doc = org.jsoup.Jsoup.parse(html);
            assertThat(doc.text()).contains("Conciergerie <TEST> & associés").doesNotContainIgnoringCase("clenzy");
            assertThat(doc.select("test")).isEmpty();
            assertThat(doc.title()).contains("Conciergerie <TEST> & associés");
        }
    }
}
