package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TagResolverServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private InterventionRepository interventionRepository;
    @Mock private ServiceRequestRepository serviceRequestRepository;

    private TagResolverService service;

    @BeforeEach
    void setUp() {
        service = new TagResolverService(userRepository, propertyRepository,
                interventionRepository, serviceRequestRepository);
        ReflectionTestUtils.setField(service, "companyName", "Clenzy");
        ReflectionTestUtils.setField(service, "companyAddress", "10 rue de Paris");
        ReflectionTestUtils.setField(service, "companySiret", "12345678900001");
        ReflectionTestUtils.setField(service, "companyEmail", "info@clenzy.fr");
        ReflectionTestUtils.setField(service, "companyPhone", "0102030405");
    }

    // ===== SYSTEM TAGS =====

    @Nested
    class SystemTags {

        @Test
        void whenResolved_thenContainsDateAndEntreprise() {
            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.FACTURE, null, null);

            assertThat(context).containsKey("system");
            assertThat(context).containsKey("entreprise");

            @SuppressWarnings("unchecked")
            Map<String, Object> system = (Map<String, Object>) context.get("system");
            assertThat(system.get("date")).isNotNull();
            assertThat(system.get("annee")).isEqualTo(String.valueOf(LocalDateTime.now().getYear()));

            @SuppressWarnings("unchecked")
            Map<String, Object> entreprise = (Map<String, Object>) context.get("entreprise");
            assertThat(entreprise.get("nom")).isEqualTo("Clenzy");
            assertThat(entreprise.get("siret")).isEqualTo("12345678900001");
        }
    }

    // ===== RESOLVE FROM INTERVENTION =====

    @Nested
    class ResolveFromIntervention {

        @Test
        void whenInterventionExists_thenResolvesAllGroups() {
            User owner = new User();
            owner.setId(1L);
            owner.setFirstName("Jean");
            owner.setLastName("Dupont");
            owner.setEmail("jean@test.com");

            Property property = new Property();
            property.setId(10L);
            property.setName("Appart Paris");
            property.setAddress("5 rue Victor Hugo");
            property.setOwner(owner);

            User technicien = new User();
            technicien.setId(2L);
            technicien.setFirstName("Marc");
            technicien.setLastName("Tech");

            Intervention intervention = new Intervention();
            intervention.setId(100L);
            intervention.setTitle("Menage standard");
            intervention.setDescription("Nettoyage complet");
            intervention.setProperty(property);
            intervention.setAssignedUser(technicien);
            intervention.setEstimatedCost(BigDecimal.valueOf(120));
            intervention.setPaymentStatus(PaymentStatus.PENDING);

            when(interventionRepository.findById(100L)).thenReturn(Optional.of(intervention));

            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.BON_INTERVENTION, 100L, "intervention");

            assertThat(context).containsKeys("intervention", "property", "client", "technicien", "paiement");

            @SuppressWarnings("unchecked")
            Map<String, Object> intTags = (Map<String, Object>) context.get("intervention");
            assertThat(intTags.get("titre")).isEqualTo("Menage standard");

            @SuppressWarnings("unchecked")
            Map<String, Object> clientTags = (Map<String, Object>) context.get("client");
            assertThat(clientTags.get("nom")).isEqualTo("Dupont");

            @SuppressWarnings("unchecked")
            Map<String, Object> techTags = (Map<String, Object>) context.get("technicien");
            assertThat(techTags.get("prenom")).isEqualTo("Marc");
        }

        @Test
        void whenInterventionNotFound_thenOnlySystemTags() {
            when(interventionRepository.findById(999L)).thenReturn(Optional.empty());

            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.BON_INTERVENTION, 999L, "intervention");

            assertThat(context).containsKeys("system", "entreprise");
            assertThat(context).doesNotContainKey("intervention");
        }
    }

    // ===== RESOLVE FROM PROPERTY =====

    @Nested
    class ResolveFromProperty {

        @Test
        void whenPropertyExists_thenResolvesPropertyAndOwner() {
            User owner = new User();
            owner.setFirstName("Marie");
            owner.setLastName("Host");

            Property property = new Property();
            property.setId(10L);
            property.setName("Villa Nice");
            property.setCity("Nice");
            property.setOwner(owner);

            when(propertyRepository.findById(10L)).thenReturn(Optional.of(property));

            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.MANDAT_GESTION, 10L, "property");

            assertThat(context).containsKeys("property", "client");

            @SuppressWarnings("unchecked")
            Map<String, Object> propTags = (Map<String, Object>) context.get("property");
            assertThat(propTags.get("nom")).isEqualTo("Villa Nice");
            assertThat(propTags.get("ville")).isEqualTo("Nice");
        }
    }

    // ===== RESOLVE FROM USER =====

    @Nested
    class ResolveFromUser {

        @Test
        void whenUserExists_thenResolvesClientTags() {
            User user = new User();
            user.setId(5L);
            user.setFirstName("Claire");
            user.setLastName("Martin");
            user.setEmail("claire@test.com");
            user.setRole(UserRole.HOST);

            when(userRepository.findById(5L)).thenReturn(Optional.of(user));

            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.FACTURE, 5L, "user");

            @SuppressWarnings("unchecked")
            Map<String, Object> clientTags = (Map<String, Object>) context.get("client");
            assertThat(clientTags.get("prenom")).isEqualTo("Claire");
            assertThat(clientTags.get("role")).isEqualTo("HOST");
        }
    }

    // ===== UNKNOWN REFERENCE TYPE =====

    @Nested
    class UnknownReferenceType {

        @Test
        void whenUnknownType_thenOnlySystemTags() {
            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.FACTURE, 1L, "unknown_type");

            assertThat(context).containsKeys("system", "entreprise");
            assertThat(context).hasSize(2);
        }
    }
}
