package com.clenzy.service.tags;

import com.clenzy.model.DocumentType;
import com.clenzy.repository.CheckInInstructionsRepository;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.ManagementContractRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ProviderExpenseRepository;
import com.clenzy.repository.ReceivedFormRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.PricingConfigService;
import com.clenzy.service.TagResolverService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests du registre OCP de resolveurs de tags (T-SOLID-5) : le dispatch par
 * type de reference doit couvrir exactement les types de l'ancien switch et
 * router vers le resolveur correspondant.
 */
@ExtendWith(MockitoExtension.class)
class TagResolverRegistryTest {

    @Mock private UserRepository userRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private InterventionRepository interventionRepository;
    @Mock private ServiceRequestRepository serviceRequestRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private ProviderExpenseRepository providerExpenseRepository;
    @Mock private CheckInInstructionsRepository checkInInstructionsRepository;
    @Mock private ReceivedFormRepository receivedFormRepository;
    @Mock private ManagementContractRepository managementContractRepository;
    @Mock private PricingConfigService pricingConfigService;
    @Mock private com.clenzy.service.pricing.CleaningPricingEngine cleaningPricingEngine;

    @Test
    void whenDomainResolversCollected_thenTypesMatchLegacySwitchExactly() {
        // Arrange
        com.fasterxml.jackson.databind.ObjectMapper objectMapper = new com.fasterxml.jackson.databind.ObjectMapper();
        EntityTagBuilders builders = new EntityTagBuilders(checkInInstructionsRepository, objectMapper);
        List<ReferenceTagResolver> resolvers = List.of(
                new InterventionTagResolver(interventionRepository, builders, cleaningPricingEngine),
                new ReservationTagResolver(reservationRepository, builders),
                new ServiceRequestTagResolver(serviceRequestRepository, builders),
                new PropertyTagResolver(propertyRepository, builders),
                new UserTagResolver(userRepository, builders),
                new ProviderExpenseTagResolver(providerExpenseRepository, builders),
                new ReceivedFormTagResolver(receivedFormRepository, pricingConfigService, objectMapper),
                new ManagementContractTagResolver(managementContractRepository,
                        propertyRepository, userRepository, builders));

        // Act
        List<String> types = resolvers.stream().map(ReferenceTagResolver::referenceType).toList();

        // Assert — memes litteraux que l'ancien switch de TagResolverService
        assertThat(types).containsExactlyInAnyOrder(
                "intervention", "reservation", "service_request", "property",
                "user", "provider_expense", "received_form", "management_contract");
    }

    @Test
    void whenReferenceTypeIsUppercase_thenMatchingResolverInvoked() {
        // Arrange
        ReferenceTagResolver interventionResolver = mock(ReferenceTagResolver.class);
        when(interventionResolver.referenceType()).thenReturn("intervention");
        TagResolverService service = new TagResolverService(List.of(interventionResolver));

        // Act
        service.resolveTagsForDocument(DocumentType.FACTURE, 42L, "INTERVENTION");

        // Assert
        verify(interventionResolver).resolve(eq(42L), anyMap());
    }

    @Test
    void whenReferenceTypeIsUnknown_thenNoResolverInvokedAndOnlySystemTags() {
        // Arrange
        ReferenceTagResolver resolver = mock(ReferenceTagResolver.class);
        when(resolver.referenceType()).thenReturn("intervention");
        TagResolverService service = new TagResolverService(List.of(resolver));

        // Act
        Map<String, Object> context = service.resolveTagsForDocument(
                DocumentType.FACTURE, 42L, "unknown_type");

        // Assert
        verify(resolver, never()).resolve(anyLong(), anyMap());
        assertThat(context).containsOnlyKeys("system", "entreprise");
    }
}
