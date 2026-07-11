package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.CheckInInstructionsRepository;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ProviderExpenseRepository;
import com.clenzy.repository.ReceivedFormRepository;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.tags.EntityTagBuilders;
import com.clenzy.service.tags.InterventionTagResolver;
import com.clenzy.service.tags.ManagementContractTagResolver;
import com.clenzy.service.tags.PropertyTagResolver;
import com.clenzy.service.tags.ProviderExpenseTagResolver;
import com.clenzy.service.tags.ReceivedFormTagResolver;
import com.clenzy.service.tags.ReservationTagResolver;
import com.clenzy.service.tags.ServiceRequestTagResolver;
import com.clenzy.service.tags.UserTagResolver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TagResolverServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private InterventionRepository interventionRepository;
    @Mock private ServiceRequestRepository serviceRequestRepository;
    @Mock private com.clenzy.repository.ReservationRepository reservationRepository;
    @Mock private ProviderExpenseRepository providerExpenseRepository;
    @Mock private CheckInInstructionsRepository checkInInstructionsRepository;
    @Mock private ReceivedFormRepository receivedFormRepository;
    @Mock private com.clenzy.repository.ManagementContractRepository managementContractRepository;
    @Mock private PricingConfigService pricingConfigService;
    @Mock private com.clenzy.service.pricing.CleaningPricingEngine cleaningPricingEngine;

    private TagResolverService service;

    @BeforeEach
    void setUp() {
        // Registre OCP (T-SOLID-5) : un resolveur par type de reference, wiring
        // identique a celui de Spring (List<ReferenceTagResolver> injectee).
        com.fasterxml.jackson.databind.ObjectMapper objectMapper = new com.fasterxml.jackson.databind.ObjectMapper();
        EntityTagBuilders builders = new EntityTagBuilders(checkInInstructionsRepository, objectMapper);
        service = new TagResolverService(List.of(
                new InterventionTagResolver(interventionRepository, builders, cleaningPricingEngine),
                new ReservationTagResolver(reservationRepository, builders),
                new ServiceRequestTagResolver(serviceRequestRepository, builders),
                new PropertyTagResolver(propertyRepository, builders,
                        org.mockito.Mockito.mock(com.clenzy.service.tags.CleaningQuoteTagBuilder.class)),
                new UserTagResolver(userRepository, builders),
                new ProviderExpenseTagResolver(providerExpenseRepository, builders),
                new ReceivedFormTagResolver(receivedFormRepository, pricingConfigService, objectMapper),
                new ManagementContractTagResolver(managementContractRepository,
                        propertyRepository, userRepository, builders)));
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

    // ===== CHECK-IN INSTRUCTIONS IN PROPERTY TAGS =====

    @Nested
    class CheckInInstructionsInPropertyTags {

        @Test
        void whenCheckInInstructionsExist_thenResolvesAllInstructionTags() {
            Property property = new Property();
            property.setId(10L);
            property.setName("Villa Nice");
            property.setCity("Nice");

            CheckInInstructions ci = new CheckInInstructions();
            ci.setAccessCode("1234A");
            ci.setWifiName("VillaWifi");
            ci.setWifiPassword("secret123");
            ci.setParkingInfo("Place B12");
            ci.setArrivalInstructions("Prendre l'ascenseur");
            ci.setDepartureInstructions("Laisser les cles");
            ci.setHouseRules("Pas de fete");
            ci.setEmergencyContact("+33612345678");

            when(propertyRepository.findById(10L)).thenReturn(Optional.of(property));
            when(checkInInstructionsRepository.findByPropertyId(10L)).thenReturn(Optional.of(ci));

            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.MANDAT_GESTION, 10L, "property");

            @SuppressWarnings("unchecked")
            Map<String, Object> propTags = (Map<String, Object>) context.get("property");
            assertThat(propTags.get("access_code")).isEqualTo("1234A");
            assertThat(propTags.get("wifi_name")).isEqualTo("VillaWifi");
            assertThat(propTags.get("wifi_password")).isEqualTo("secret123");
            assertThat(propTags.get("parking_info")).isEqualTo("Place B12");
            assertThat(propTags.get("arrival_instructions")).isEqualTo("Prendre l'ascenseur");
            assertThat(propTags.get("departure_instructions")).isEqualTo("Laisser les cles");
            assertThat(propTags.get("house_rules")).isEqualTo("Pas de fete");
            assertThat(propTags.get("emergency_contact")).isEqualTo("+33612345678");
        }

        @Test
        void whenNoCheckInInstructions_thenTagsAreEmptyStrings() {
            Property property = new Property();
            property.setId(10L);
            property.setName("Appart Lyon");

            when(propertyRepository.findById(10L)).thenReturn(Optional.of(property));
            when(checkInInstructionsRepository.findByPropertyId(10L)).thenReturn(Optional.empty());

            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.MANDAT_GESTION, 10L, "property");

            @SuppressWarnings("unchecked")
            Map<String, Object> propTags = (Map<String, Object>) context.get("property");
            assertThat(propTags.get("access_code")).isEqualTo("");
            assertThat(propTags.get("wifi_name")).isEqualTo("");
            assertThat(propTags.get("house_rules")).isEqualTo("");
            assertThat(propTags.get("emergency_contact")).isEqualTo("");
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

        @Test
        void whenNullType_thenOnlySystemTags() {
            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.FACTURE, 1L, null);

            assertThat(context).containsKeys("system", "entreprise");
            assertThat(context).hasSize(2);
        }

        @Test
        void whenTypeIsUppercase_thenResolvesCorrectly() {
            User user = new User();
            user.setId(5L);
            user.setFirstName("Anne");
            user.setLastName("Doe");
            when(userRepository.findById(5L)).thenReturn(Optional.of(user));

            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.FACTURE, 5L, "USER");

            assertThat(context).containsKey("client");
        }
    }

    // ===== RESOLVE FROM INTERVENTION - EDGE CASES =====

    @Nested
    class ResolveFromInterventionEdgeCases {

        @Test
        void whenInterventionIdIsNull_thenNoIntervention() {
            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.FACTURE, null, "intervention");

            assertThat(context).doesNotContainKey("intervention");
        }

        @Test
        void whenNoProperty_thenNoClientFromPropertyOwner() {
            Intervention intervention = new Intervention();
            intervention.setId(100L);
            intervention.setTitle("Test");
            intervention.setProperty(null); // no property

            when(interventionRepository.findById(100L)).thenReturn(Optional.of(intervention));

            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.FACTURE, 100L, "intervention");

            assertThat(context).containsKey("intervention");
            // technicien fallback to empty when assignedUser null
            assertThat(context).containsKey("technicien");
            @SuppressWarnings("unchecked")
            Map<String, Object> tech = (Map<String, Object>) context.get("technicien");
            assertThat(tech.get("nom")).isEqualTo("");
        }

        @Test
        void whenRequestorPresentButNoPropertyOwner_thenClientFromRequestor() {
            User requestor = new User();
            requestor.setId(1L);
            requestor.setFirstName("Req");
            requestor.setLastName("User");

            Property property = new Property();
            property.setId(10L);
            property.setName("Prop");
            property.setOwner(null);

            Intervention intervention = new Intervention();
            intervention.setId(100L);
            intervention.setProperty(property);
            intervention.setRequestor(requestor);

            when(interventionRepository.findById(100L)).thenReturn(Optional.of(intervention));

            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.FACTURE, 100L, "intervention");

            @SuppressWarnings("unchecked")
            Map<String, Object> client = (Map<String, Object>) context.get("client");
            assertThat(client.get("nom")).isEqualTo("User");
        }

        @Test
        void whenActualCostPresent_thenUsesActualCostInLigne() {
            Intervention intervention = new Intervention();
            intervention.setId(100L);
            intervention.setDescription("Reparation chaudiere");
            intervention.setEstimatedCost(new BigDecimal("100"));
            intervention.setActualCost(new BigDecimal("250"));

            when(interventionRepository.findById(100L)).thenReturn(Optional.of(intervention));

            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.FACTURE, 100L, "intervention");

            @SuppressWarnings("unchecked")
            Map<String, Object> ligne = (Map<String, Object>) context.get("ligne");
            assertThat(ligne.get("description")).isEqualTo("Reparation chaudiere");
            assertThat(ligne.get("total").toString()).contains("250").endsWith(" €");
        }

        @Test
        void whenNoActualCost_thenFallbackToEstimatedCostInLigne() {
            Intervention intervention = new Intervention();
            intervention.setId(100L);
            intervention.setDescription("Menage");
            intervention.setEstimatedCost(new BigDecimal("80"));

            when(interventionRepository.findById(100L)).thenReturn(Optional.of(intervention));

            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.FACTURE, 100L, "intervention");

            @SuppressWarnings("unchecked")
            Map<String, Object> ligne = (Map<String, Object>) context.get("ligne");
            assertThat(ligne.get("total").toString()).contains("80").endsWith(" €");
        }

        @Test
        void whenNullCosts_thenLigneShowsZero() {
            Intervention intervention = new Intervention();
            intervention.setId(100L);
            intervention.setDescription("Test");

            when(interventionRepository.findById(100L)).thenReturn(Optional.of(intervention));

            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.FACTURE, 100L, "intervention");

            @SuppressWarnings("unchecked")
            Map<String, Object> ligne = (Map<String, Object>) context.get("ligne");
            assertThat(ligne.get("total").toString()).contains("0").endsWith(" €");
            assertThat(ligne.get("quantite")).isEqualTo("1");
        }

        @Test
        void whenInterventionResolved_thenPaymentTagsPopulated() {
            Intervention intervention = new Intervention();
            intervention.setId(100L);
            intervention.setEstimatedCost(new BigDecimal("100"));
            intervention.setPaymentStatus(PaymentStatus.PAID);
            intervention.setPaidAt(LocalDateTime.of(2026, 1, 15, 10, 30));
            intervention.setStripePaymentIntentId("pi_123");

            when(interventionRepository.findById(100L)).thenReturn(Optional.of(intervention));

            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.FACTURE, 100L, "intervention");

            @SuppressWarnings("unchecked")
            Map<String, Object> paiement = (Map<String, Object>) context.get("paiement");
            assertThat(paiement.get("statut")).isEqualTo("PAID");
            assertThat(paiement.get("date_paiement")).isEqualTo("15/01/2026 10:30");
            assertThat(paiement.get("reference_stripe")).isEqualTo("pi_123");
        }

        @Test
        void whenNoPaymentStatus_thenPaymentTagsDefaultPending() {
            Intervention intervention = new Intervention();
            intervention.setId(100L);

            when(interventionRepository.findById(100L)).thenReturn(Optional.of(intervention));

            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.FACTURE, 100L, "intervention");

            @SuppressWarnings("unchecked")
            Map<String, Object> paiement = (Map<String, Object>) context.get("paiement");
            assertThat(paiement.get("statut")).isEqualTo("PENDING");
        }

        @Test
        void whenInterventionWithDates_thenAllDatesFormatted() {
            Intervention intervention = new Intervention();
            intervention.setId(100L);
            intervention.setScheduledDate(LocalDateTime.of(2026, 6, 1, 9, 0));
            intervention.setStartTime(LocalDateTime.of(2026, 6, 1, 9, 15));
            intervention.setEndTime(LocalDateTime.of(2026, 6, 1, 11, 30));
            intervention.setCompletedAt(LocalDateTime.of(2026, 6, 1, 12, 0));
            intervention.setEstimatedDurationHours(2);
            intervention.setActualDurationMinutes(135);
            intervention.setProgressPercentage(75);

            when(interventionRepository.findById(100L)).thenReturn(Optional.of(intervention));

            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.FACTURE, 100L, "intervention");

            @SuppressWarnings("unchecked")
            Map<String, Object> intTags = (Map<String, Object>) context.get("intervention");
            assertThat(intTags.get("date_planifiee")).isEqualTo("01/06/2026");
            assertThat(intTags.get("date_debut")).isEqualTo("01/06/2026 09:15");
            assertThat(intTags.get("date_fin")).isEqualTo("01/06/2026 11:30");
            assertThat(intTags.get("date_completion")).isEqualTo("01/06/2026 12:00");
            assertThat(intTags.get("duree_estimee")).isEqualTo("2h");
            assertThat(intTags.get("duree_reelle")).isEqualTo("135 min");
            assertThat(intTags.get("progression")).isEqualTo("75%");
        }

        @Test
        void whenInterventionNotes_thenPlainTextReturned() {
            Intervention intervention = new Intervention();
            intervention.setId(100L);
            intervention.setNotes("Note libre sans JSON");

            when(interventionRepository.findById(100L)).thenReturn(Optional.of(intervention));

            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.FACTURE, 100L, "intervention");

            @SuppressWarnings("unchecked")
            Map<String, Object> intTags = (Map<String, Object>) context.get("intervention");
            assertThat(intTags.get("notes")).isEqualTo("Note libre sans JSON");
        }

        @Test
        void whenInterventionNotesIsJson_thenAggregatesValues() {
            Intervention intervention = new Intervention();
            intervention.setId(100L);
            intervention.setNotes("{\"rooms\":{\"general\":\"propre\",\"0\":\"chambre nettoyee\"},\"inspection\":\"OK\"}");

            when(interventionRepository.findById(100L)).thenReturn(Optional.of(intervention));

            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.FACTURE, 100L, "intervention");

            @SuppressWarnings("unchecked")
            Map<String, Object> intTags = (Map<String, Object>) context.get("intervention");
            String notes = (String) intTags.get("notes");
            assertThat(notes).contains("propre");
            assertThat(notes).contains("chambre nettoyee");
            assertThat(notes).contains("OK");
        }

        @Test
        void whenInterventionNotesInvalidJson_thenReturnsRawText() {
            Intervention intervention = new Intervention();
            intervention.setId(100L);
            intervention.setNotes("{invalid json");

            when(interventionRepository.findById(100L)).thenReturn(Optional.of(intervention));

            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.FACTURE, 100L, "intervention");

            @SuppressWarnings("unchecked")
            Map<String, Object> intTags = (Map<String, Object>) context.get("intervention");
            assertThat(intTags.get("notes")).isEqualTo("{invalid json");
        }

        @Test
        void whenInterventionNotesIsBlank_thenEmptyString() {
            Intervention intervention = new Intervention();
            intervention.setId(100L);
            intervention.setNotes("   ");

            when(interventionRepository.findById(100L)).thenReturn(Optional.of(intervention));

            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.FACTURE, 100L, "intervention");

            @SuppressWarnings("unchecked")
            Map<String, Object> intTags = (Map<String, Object>) context.get("intervention");
            assertThat(intTags.get("notes")).isEqualTo("");
        }

        @Test
        void whenInterventionResolved_thenNfTagsContainNumber() {
            Intervention intervention = new Intervention();
            intervention.setId(100L);

            when(interventionRepository.findById(100L)).thenReturn(Optional.of(intervention));

            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.FACTURE, 100L, "intervention");

            @SuppressWarnings("unchecked")
            Map<String, Object> nf = (Map<String, Object>) context.get("nf");
            assertThat(nf.get("numero")).isEqualTo("");
            assertThat(nf.get("date")).isNotNull();
        }

        @Test
        void whenInterventionLignes_thenDefaultLineIncluded() {
            Intervention intervention = new Intervention();
            intervention.setId(100L);
            intervention.setDescription("Service x");
            intervention.setActualCost(BigDecimal.valueOf(50));

            when(interventionRepository.findById(100L)).thenReturn(Optional.of(intervention));

            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.FACTURE, 100L, "intervention");

            @SuppressWarnings("unchecked")
            Map<String, Object> intTags = (Map<String, Object>) context.get("intervention");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> lignes = (List<Map<String, Object>>) intTags.get("lignes");
            assertThat(lignes).hasSize(1);
            assertThat(lignes.get(0).get("description")).isEqualTo("Service x");
            assertThat(lignes.get(0).get("total").toString()).contains("50").endsWith(" €");
        }
    }

    // ===== RESOLVE FROM RESERVATION =====

    @Nested
    class ResolveFromReservation {

        private Reservation buildBaseReservation() {
            Reservation res = new Reservation();
            res.setId(50L);
            res.setGuestName("John Smith");
            res.setCheckIn(LocalDate.of(2026, 7, 1));
            res.setCheckOut(LocalDate.of(2026, 7, 5));
            res.setTotalPrice(new BigDecimal("400.00"));
            res.setRoomRevenue(new BigDecimal("360.00"));
            res.setCleaningFee(new BigDecimal("40.00"));
            res.setStatus("confirmed");
            res.setSource("airbnb");
            res.setCurrency("EUR");
            res.setGuestCount(2);
            return res;
        }

        @Test
        void whenReservationExistsWithGuest_thenClientUsesGuest() {
            Guest guest = new Guest();
            guest.setFirstName("Jane");
            guest.setLastName("Doe");
            guest.setEmail("jane@test.com");
            guest.setPhone("+33600000000");

            Reservation res = buildBaseReservation();
            res.setGuest(guest);

            when(reservationRepository.findByIdFetchAll(50L)).thenReturn(Optional.of(res));

            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.FACTURE, 50L, "reservation");

            @SuppressWarnings("unchecked")
            Map<String, Object> client = (Map<String, Object>) context.get("client");
            assertThat(client.get("prenom")).isEqualTo("Jane");
            assertThat(client.get("nom")).isEqualTo("Doe");
            assertThat(client.get("email")).isEqualTo("jane@test.com");
        }

        @Test
        void whenNoGuestEntity_thenFallbackToGuestName() {
            Reservation res = buildBaseReservation();
            res.setGuest(null);

            when(reservationRepository.findByIdFetchAll(50L)).thenReturn(Optional.of(res));

            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.FACTURE, 50L, "reservation");

            @SuppressWarnings("unchecked")
            Map<String, Object> client = (Map<String, Object>) context.get("client");
            assertThat(client.get("nom")).isEqualTo("John Smith");
            assertThat(client.get("nom_complet")).isEqualTo("John Smith");
            assertThat(client.get("email")).isEqualTo("");
            assertThat(client.get("societe")).isEqualTo("");
        }

        @Test
        void whenPropertyAndOwner_thenProprietaireTagsResolved() {
            User owner = new User();
            owner.setFirstName("Owner");
            owner.setLastName("Property");
            Property prop = new Property();
            prop.setId(10L);
            prop.setName("Loft");
            prop.setOwner(owner);

            Reservation res = buildBaseReservation();
            res.setProperty(prop);

            when(reservationRepository.findByIdFetchAll(50L)).thenReturn(Optional.of(res));

            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.FACTURE, 50L, "reservation");

            assertThat(context).containsKeys("property", "proprietaire");
            @SuppressWarnings("unchecked")
            Map<String, Object> proprio = (Map<String, Object>) context.get("proprietaire");
            assertThat(proprio.get("nom")).isEqualTo("Property");
        }

        @Test
        void whenReservationLigne_thenComputesUnitPrice() {
            Property prop = new Property();
            prop.setId(10L);
            prop.setName("Loft");

            Reservation res = buildBaseReservation();
            res.setProperty(prop);

            when(reservationRepository.findByIdFetchAll(50L)).thenReturn(Optional.of(res));

            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.FACTURE, 50L, "reservation");

            @SuppressWarnings("unchecked")
            Map<String, Object> ligne = (Map<String, Object>) context.get("ligne");
            assertThat(ligne.get("quantite")).isEqualTo("4"); // 4 nuits
            // 360 / 4 = 90,00 €
            assertThat(ligne.get("prix_unitaire").toString()).contains("90").endsWith(" €");
            assertThat(ligne.get("description").toString()).contains("Loft");
            assertThat(ligne.get("description").toString()).contains("01/07/2026");
        }

        @Test
        void whenReservationHasInterventionWithTechnicien_thenTechnicienResolved() {
            User tech = new User();
            tech.setFirstName("Tech");
            tech.setLastName("Person");
            Intervention intervention = new Intervention();
            intervention.setId(900L);
            intervention.setTitle("Menage");
            intervention.setAssignedUser(tech);

            Reservation res = buildBaseReservation();
            res.setIntervention(intervention);

            when(reservationRepository.findByIdFetchAll(50L)).thenReturn(Optional.of(res));

            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.FACTURE, 50L, "reservation");

            @SuppressWarnings("unchecked")
            Map<String, Object> technicien = (Map<String, Object>) context.get("technicien");
            assertThat(technicien.get("nom")).isEqualTo("Person");
            assertThat(context).containsKey("intervention");
        }

        @Test
        void whenNoIntervention_thenInterventionAndTechnicienAbsent() {
            Reservation res = buildBaseReservation();
            res.setIntervention(null);

            when(reservationRepository.findByIdFetchAll(50L)).thenReturn(Optional.of(res));

            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.FACTURE, 50L, "reservation");

            // Sans intervention reelle : ni "intervention" ni "technicien" dans le contexte
            // (has_intervention / has_technicien = false cote rendu).
            assertThat(context).doesNotContainKeys("intervention", "technicien");
        }

        @Test
        void whenReservationCleaningFee_thenLigneIncludesCleaningRow() {
            Property prop = new Property();
            prop.setId(10L);
            prop.setName("Loft");

            Reservation res = buildBaseReservation();
            res.setProperty(prop);
            res.setTouristTaxAmount(new BigDecimal("8.00"));

            when(reservationRepository.findByIdFetchAll(50L)).thenReturn(Optional.of(res));

            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.FACTURE, 50L, "reservation");

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> lignes = (List<Map<String, Object>>) context.get("lignes");
            // hebergement + menage + taxe = 3
            assertThat(lignes).hasSize(3);
            assertThat(lignes.get(1).get("description")).isEqualTo("Frais de menage");
            assertThat(lignes.get(2).get("description")).isEqualTo("Taxe de sejour");
        }

        @Test
        void whenReservationWithoutCleaningOrTax_thenOneLineOnly() {
            Property prop = new Property();
            prop.setId(10L);
            prop.setName("Loft");

            Reservation res = buildBaseReservation();
            res.setProperty(prop);
            res.setCleaningFee(BigDecimal.ZERO);
            res.setTouristTaxAmount(null);

            when(reservationRepository.findByIdFetchAll(50L)).thenReturn(Optional.of(res));

            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.FACTURE, 50L, "reservation");

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> lignes = (List<Map<String, Object>>) context.get("lignes");
            assertThat(lignes).hasSize(1);
        }

        @Test
        void whenReservationNotFound_thenOnlySystemTags() {
            when(reservationRepository.findByIdFetchAll(999L)).thenReturn(Optional.empty());

            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.FACTURE, 999L, "reservation");

            assertThat(context).doesNotContainKey("reservation");
        }

        @Test
        void whenReservationIdNull_thenNothingResolved() {
            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.FACTURE, null, "reservation");

            assertThat(context).doesNotContainKey("reservation");
        }

        @Test
        void whenReservationPaymentTags_thenStripeAndPaidAt() {
            Reservation res = buildBaseReservation();
            res.setPaymentStatus(PaymentStatus.PAID);
            res.setPaidAt(LocalDateTime.of(2026, 7, 1, 12, 0));
            res.setStripeSessionId("cs_test_123");
            res.setPaymentLinkSentAt(LocalDateTime.of(2026, 6, 30, 18, 0));
            res.setPaymentLinkEmail("guest@test.com");

            when(reservationRepository.findByIdFetchAll(50L)).thenReturn(Optional.of(res));

            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.FACTURE, 50L, "reservation");

            @SuppressWarnings("unchecked")
            Map<String, Object> paiement = (Map<String, Object>) context.get("paiement");
            assertThat(paiement.get("statut")).isEqualTo("PAID");
            assertThat(paiement.get("reference_stripe")).isEqualTo("cs_test_123");
            assertThat(paiement.get("email_paiement")).isEqualTo("guest@test.com");
            assertThat(paiement.get("lien_envoye_le")).isEqualTo("30/06/2026 18:00");
        }

        @Test
        void whenReservationNoPaymentStatus_thenPending() {
            Reservation res = buildBaseReservation();

            when(reservationRepository.findByIdFetchAll(50L)).thenReturn(Optional.of(res));

            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.FACTURE, 50L, "reservation");

            @SuppressWarnings("unchecked")
            Map<String, Object> paiement = (Map<String, Object>) context.get("paiement");
            assertThat(paiement.get("statut")).isEqualTo("PENDING");
        }

        @Test
        void whenReservationGuestPartialName_thenFallbackPopulatesNomComplet() {
            Guest guest = new Guest();
            guest.setLastName("Solo");
            // No firstname, getFullName() may be blank
            Reservation res = buildBaseReservation();
            res.setGuestName("Solo Backup");
            res.setGuest(guest);

            when(reservationRepository.findByIdFetchAll(50L)).thenReturn(Optional.of(res));

            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.FACTURE, 50L, "reservation");

            @SuppressWarnings("unchecked")
            Map<String, Object> client = (Map<String, Object>) context.get("client");
            // fallback to "Solo Backup" since guest.getFullName() is blank
            assertThat(client.get("nom_complet").toString()).isNotEmpty();
        }
    }

    // ===== RESOLVE FROM SERVICE REQUEST =====

    @Nested
    class ResolveFromServiceRequest {

        @Test
        void whenServiceRequestExists_thenResolvesDemande() {
            User user = new User();
            user.setId(1L);
            user.setFirstName("Carl");
            user.setLastName("Customer");

            Property prop = new Property();
            prop.setId(10L);
            prop.setName("Studio");

            ServiceRequest sr = new ServiceRequest();
            sr.setTitle("Demande Test");
            sr.setDescription("Description test");
            sr.setServiceType(ServiceType.CLEANING);
            sr.setPriority(Priority.HIGH);
            sr.setStatus(RequestStatus.PENDING);
            sr.setDesiredDate(LocalDateTime.of(2026, 8, 1, 14, 0));
            sr.setPreferredTimeSlot("Matin");
            sr.setEstimatedCost(new BigDecimal("150"));
            sr.setActualCost(new BigDecimal("180"));
            sr.setSpecialInstructions("Apporter aspirateur");
            sr.setProperty(prop);
            sr.setUser(user);

            when(serviceRequestRepository.findById(200L)).thenReturn(Optional.of(sr));

            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.DEVIS, 200L, "service_request");

            assertThat(context).containsKeys("demande", "property", "client");

            @SuppressWarnings("unchecked")
            Map<String, Object> demande = (Map<String, Object>) context.get("demande");
            assertThat(demande.get("titre")).isEqualTo("Demande Test");
            assertThat(demande.get("type_service")).isEqualTo("CLEANING");
            assertThat(demande.get("priorite")).isEqualTo("HIGH");
            assertThat(demande.get("statut")).isEqualTo("PENDING");
            assertThat(demande.get("creneau")).isEqualTo("Matin");
            assertThat(demande.get("cout_estime").toString()).contains("150").endsWith(" €");
            assertThat(demande.get("cout_reel").toString()).contains("180").endsWith(" €");
        }

        @Test
        void whenServiceRequestIdIsNull_thenNoDemande() {
            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.DEVIS, null, "service_request");

            assertThat(context).doesNotContainKey("demande");
        }

        @Test
        void whenSrNotFound_thenNoDemande() {
            when(serviceRequestRepository.findById(999L)).thenReturn(Optional.empty());
            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.DEVIS, 999L, "service_request");
            assertThat(context).doesNotContainKey("demande");
        }
    }

    // ===== RESOLVE FROM PROVIDER EXPENSE =====

    @Nested
    class ResolveFromProviderExpense {

        @Test
        void whenExpenseExists_thenResolvesDepenseAndPrestataire() {
            User provider = new User();
            provider.setFirstName("Marie");
            provider.setLastName("Provider");

            User owner = new User();
            owner.setFirstName("Owner");
            owner.setLastName("Property");

            Property property = new Property();
            property.setId(10L);
            property.setName("Studio");
            property.setOwner(owner);

            ProviderExpense expense = new ProviderExpense();
            expense.setId(500L);
            expense.setProvider(provider);
            expense.setProperty(property);
            expense.setDescription("Reparation plomberie");
            expense.setAmountHt(new BigDecimal("100"));
            expense.setAmountTtc(new BigDecimal("120"));
            expense.setTaxRate(new BigDecimal("0.20"));
            expense.setTaxAmount(new BigDecimal("20"));
            expense.setCurrency("EUR");
            expense.setCategory(ExpenseCategory.MAINTENANCE);
            expense.setStatus(ExpenseStatus.APPROVED);
            expense.setExpenseDate(LocalDate.of(2026, 3, 15));
            expense.setInvoiceReference("FAC-2026-001");
            expense.setNotes("Facture reglee");
            expense.setPaymentReference("VIR-001");

            when(providerExpenseRepository.findById(500L)).thenReturn(Optional.of(expense));

            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.JUSTIFICATIF_PAIEMENT, 500L, "provider_expense");

            assertThat(context).containsKeys("depense", "prestataire", "property", "client");

            @SuppressWarnings("unchecked")
            Map<String, Object> dep = (Map<String, Object>) context.get("depense");
            assertThat(dep.get("description")).isEqualTo("Reparation plomberie");
            assertThat(dep.get("montant_ht").toString()).contains("100").endsWith(" €");
            assertThat(dep.get("montant_ttc").toString()).contains("120").endsWith(" €");
            assertThat(dep.get("devise")).isEqualTo("EUR");
            assertThat(dep.get("categorie")).isEqualTo("Maintenance");
            assertThat(dep.get("date")).isEqualTo("15/03/2026");
            assertThat(dep.get("statut")).isEqualTo("APPROVED");
            assertThat(dep.get("reference_facture")).isEqualTo("FAC-2026-001");

            @SuppressWarnings("unchecked")
            Map<String, Object> presta = (Map<String, Object>) context.get("prestataire");
            assertThat(presta.get("nom")).isEqualTo("Provider");
        }

        @Test
        void whenExpenseTaxRateNull_thenDefaultTaxString() {
            ProviderExpense expense = new ProviderExpense();
            expense.setId(500L);
            expense.setAmountHt(BigDecimal.TEN);
            expense.setCurrency("EUR");

            when(providerExpenseRepository.findById(500L)).thenReturn(Optional.of(expense));

            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.JUSTIFICATIF_PAIEMENT, 500L, "provider_expense");

            @SuppressWarnings("unchecked")
            Map<String, Object> dep = (Map<String, Object>) context.get("depense");
            assertThat(dep.get("taux_tva")).isEqualTo("0 %");
        }

        @Test
        void whenExpenseIdNull_thenNoDepense() {
            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.JUSTIFICATIF_PAIEMENT, null, "provider_expense");

            assertThat(context).doesNotContainKey("depense");
        }
    }

    // ===== RESOLVE FROM RECEIVED FORM =====

    @Nested
    class ResolveFromReceivedForm {

        @Test
        void whenReceivedFormIsContactType_thenSupportDemande() {
            ReceivedForm form = new ReceivedForm();
            form.setId(700L);
            form.setFormType("CONTACT");
            form.setFullName("Alice Dupont");
            form.setEmail("alice@test.com");
            form.setPhone("0102030405");
            form.setCity("Paris");
            form.setPostalCode("75001");
            form.setSubject("Question sur tarifs");
            form.setStatus("NEW");
            form.setPayload("{\"subject\":\"x\",\"message\":\"contact details\"}");
            form.setCreatedAt(LocalDateTime.of(2026, 2, 20, 10, 0));

            when(receivedFormRepository.findById(700L)).thenReturn(Optional.of(form));

            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.DEVIS, 700L, "received_form");

            assertThat(context).containsKeys("client", "property", "demande", "ligne", "devis", "intervention");

            @SuppressWarnings("unchecked")
            Map<String, Object> client = (Map<String, Object>) context.get("client");
            assertThat(client.get("prenom")).isEqualTo("Alice");
            assertThat(client.get("nom")).isEqualTo("Dupont");
            assertThat(client.get("email")).isEqualTo("alice@test.com");
            assertThat(client.get("ville")).isEqualTo("Paris");
            assertThat(client.get("role")).isEqualTo("PROSPECT");

            @SuppressWarnings("unchecked")
            Map<String, Object> demande = (Map<String, Object>) context.get("demande");
            assertThat(demande.get("type_service")).isEqualTo("Support");
            assertThat(demande.get("titre")).isEqualTo("Question sur tarifs");

            // No quote computation for CONTACT
            @SuppressWarnings("unchecked")
            Map<String, Object> devis = (Map<String, Object>) context.get("devis");
            assertThat(devis).containsKey("forfait");
            @SuppressWarnings("unchecked")
            Map<String, Object> forfait = (Map<String, Object>) devis.get("forfait");
            assertThat(forfait.get("nom")).isEqualTo("");
        }

        @Test
        void whenReceivedFormIsMaintenanceType_thenMaintenanceDescription() {
            ReceivedForm form = new ReceivedForm();
            form.setId(701L);
            form.setFormType("MAINTENANCE");
            form.setFullName("Bob Marc Smith");
            form.setEmail("bob@test.com");
            form.setCity("Lyon");
            form.setPayload("{\"selectedWorks\":[\"peinture\",\"plomberie\"],\"urgency\":\"tres-urgent\",\"customNeed\":\"changer chaudiere\",\"description\":\"Detail complet\"}");
            form.setCreatedAt(LocalDateTime.of(2026, 5, 1, 9, 30));

            when(receivedFormRepository.findById(701L)).thenReturn(Optional.of(form));

            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.AUTORISATION_TRAVAUX, 701L, "received_form");

            @SuppressWarnings("unchecked")
            Map<String, Object> demande = (Map<String, Object>) context.get("demande");
            assertThat(demande.get("type_service")).isEqualTo("Travaux / maintenance");
            assertThat(demande.get("titre").toString()).contains("Travaux");
            // urgency value: "tres-urgent" → "Tres Urgent" (labelize)
            assertThat(demande.get("priorite").toString()).isEqualTo("Tres Urgent");
            assertThat(demande.get("description").toString()).contains("Peinture, Plomberie");
            assertThat(demande.get("description").toString()).contains("changer chaudiere");

            @SuppressWarnings("unchecked")
            Map<String, Object> client = (Map<String, Object>) context.get("client");
            assertThat(client.get("prenom")).isEqualTo("Bob");
            assertThat(client.get("nom")).isEqualTo("Marc Smith");
        }

        @Test
        void whenReceivedFormIsDevisType_thenInvokesPricingService() {
            ReceivedForm form = new ReceivedForm();
            form.setId(702L);
            form.setFormType("DEVIS");
            form.setFullName("Charles Owner");
            form.setEmail("c@test.com");
            form.setCity("Nice");
            form.setPayload("{\"propertyType\":\"appartement\",\"propertyCount\":\"1\",\"guestCapacity\":\"3-4\",\"surface\":\"80\",\"services\":[\"a\",\"b\"],\"calendarSync\":\"airbnb\",\"bookingFrequency\":\"frequent\"}");
            form.setCreatedAt(LocalDateTime.of(2026, 4, 1, 10, 0));

            PricingConfigService.DevisQuoteBreakdown quote = new PricingConfigService.DevisQuoteBreakdown(
                    "essentiel", "Essentiel",
                    75, 4, 300, 3600,                 // menage : 75/intervention, 4/mois, 300/mois, 3600/an
                    31, false, 372, 309, 63, 17,      // PMS : 31/mois, 372/an -> 309 (remise 17 %, 63 economises)
                    300, 331, 3909                    // formules : menage seul 300, +PMS 331, annuel 3909
            );
            when(pricingConfigService.computeDevisQuote(
                    anyString(), anyString(), anyString(), anyInt(), anyList(), anyString(), anyString()))
                    .thenReturn(quote);

            when(receivedFormRepository.findById(702L)).thenReturn(Optional.of(form));

            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.DEVIS, 702L, "received_form");

            @SuppressWarnings("unchecked")
            Map<String, Object> devis = (Map<String, Object>) context.get("devis");
            @SuppressWarnings("unchecked")
            Map<String, Object> forfait = (Map<String, Object>) devis.get("forfait");
            assertThat(forfait.get("id")).isEqualTo("essentiel");
            assertThat(forfait.get("nom")).isEqualTo("Essentiel");

            @SuppressWarnings("unchecked")
            Map<String, Object> ligne = (Map<String, Object>) context.get("ligne");
            assertThat(ligne.get("description").toString()).contains("Essentiel");

            @SuppressWarnings("unchecked")
            Map<String, Object> intTags = (Map<String, Object>) context.get("intervention");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> lignes = (List<Map<String, Object>>) intTags.get("lignes");
            // 5 lignes : menage, option PMS (mensuel), option PMS (annuel remise),
            // formule 1 (menage seul), formule 2 (menage + PMS)
            assertThat(lignes).hasSize(5);
        }

        @Test
        void whenDevisAndPricingThrows_thenEmptyDevisAndDescriptionWithoutQuote() {
            ReceivedForm form = new ReceivedForm();
            form.setId(703L);
            form.setFormType("DEVIS");
            form.setFullName("X Y");
            form.setEmail("x@test.com");
            form.setPayload("{\"propertyType\":\"villa\"}");
            form.setCreatedAt(LocalDateTime.of(2026, 4, 5, 8, 0));

            when(pricingConfigService.computeDevisQuote(
                    anyString(), any(), any(), anyInt(), anyList(), any(), any()))
                    .thenThrow(new RuntimeException("compute failed"));

            when(receivedFormRepository.findById(703L)).thenReturn(Optional.of(form));

            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.DEVIS, 703L, "received_form");

            @SuppressWarnings("unchecked")
            Map<String, Object> devis = (Map<String, Object>) context.get("devis");
            @SuppressWarnings("unchecked")
            Map<String, Object> forfait = (Map<String, Object>) devis.get("forfait");
            assertThat(forfait.get("id")).isEqualTo("");

            @SuppressWarnings("unchecked")
            Map<String, Object> ligne = (Map<String, Object>) context.get("ligne");
            // Fallback line for non-quote: "Forfait Essentiel — ..."
            assertThat(ligne.get("description").toString())
                    .containsAnyOf("Forfait", "Sur demande");
        }

        @Test
        void whenReceivedFormPayloadInvalidJson_thenStillResolvesWithEmptyPayload() {
            ReceivedForm form = new ReceivedForm();
            form.setId(704L);
            form.setFormType("CONTACT");
            form.setFullName("Solo");
            form.setEmail("s@t.com");
            form.setPayload("{invalid json}");
            form.setCreatedAt(LocalDateTime.of(2026, 1, 1, 0, 0));

            when(receivedFormRepository.findById(704L)).thenReturn(Optional.of(form));

            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.DEVIS, 704L, "received_form");

            @SuppressWarnings("unchecked")
            Map<String, Object> client = (Map<String, Object>) context.get("client");
            assertThat(client.get("nom_complet")).isEqualTo("Solo");
            assertThat(client.get("prenom")).isEqualTo(""); // single token → no firstname
        }

        @Test
        void whenReceivedFormPayloadIsNullOrEmpty_thenNoPayloadFields() {
            ReceivedForm form = new ReceivedForm();
            form.setId(705L);
            form.setFormType("CONTACT");
            form.setFullName("Mono");
            form.setEmail("m@t.com");
            form.setPayload(null);
            form.setCreatedAt(LocalDateTime.of(2026, 1, 1, 0, 0));

            when(receivedFormRepository.findById(705L)).thenReturn(Optional.of(form));

            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.DEVIS, 705L, "received_form");

            @SuppressWarnings("unchecked")
            Map<String, Object> property = (Map<String, Object>) context.get("property");
            assertThat(property.get("type")).isEqualTo("");
            assertThat(property.get("surface")).isEqualTo("");
        }

        @Test
        void whenReceivedFormIdNull_thenNoDemande() {
            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.DEVIS, null, "received_form");
            assertThat(context).doesNotContainKey("demande");
        }

        @Test
        void whenReceivedFormNotFound_thenSilent() {
            when(receivedFormRepository.findById(999L)).thenReturn(Optional.empty());
            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.DEVIS, 999L, "received_form");
            assertThat(context).doesNotContainKey("demande");
        }
    }

    // ===== RESOLVE FROM MANAGEMENT CONTRACT =====

    @Nested
    class ResolveFromManagementContract {

        @Test
        void whenContractExists_thenResolvesContratAndCommission() {
            ManagementContract contract = new ManagementContract();
            contract.setId(900L);
            contract.setContractNumber("MAN-2026-001");
            contract.setContractType(ManagementContract.ContractType.FULL_MANAGEMENT);
            contract.setStatus(ManagementContract.ContractStatus.ACTIVE);
            contract.setStartDate(LocalDate.of(2026, 1, 1));
            contract.setEndDate(LocalDate.of(2026, 12, 31));
            contract.setCommissionRate(new BigDecimal("0.20")); // 20%
            contract.setMinimumStayNights(2);
            contract.setNoticePeriodDays(45);
            contract.setAutoRenew(true);
            contract.setCleaningFeeIncluded(true);
            contract.setMaintenanceIncluded(false);
            contract.setNotes("Notes contractuelles");
            contract.setSignedAt(Instant.parse("2026-01-01T10:00:00Z"));

            when(managementContractRepository.findById(900L)).thenReturn(Optional.of(contract));

            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.MANDAT_GESTION, 900L, "management_contract");

            assertThat(context).containsKeys("contrat", "mandat", "commission");

            @SuppressWarnings("unchecked")
            Map<String, Object> contrat = (Map<String, Object>) context.get("contrat");
            assertThat(contrat.get("numero")).isEqualTo("MAN-2026-001");
            assertThat(contrat.get("type")).isEqualTo("FULL_MANAGEMENT");
            assertThat(contrat.get("type_label")).isEqualTo("Gestion complète");
            assertThat(contrat.get("statut")).isEqualTo("ACTIVE");
            assertThat(contrat.get("date_debut")).isEqualTo("01/01/2026");
            assertThat(contrat.get("date_fin")).isEqualTo("31/12/2026");
            assertThat(contrat.get("nuits_minimum")).isEqualTo("2");
            assertThat(contrat.get("preavis_jours")).isEqualTo("45 jours");
            assertThat(contrat.get("renouvellement_auto")).isEqualTo("Oui");
            assertThat(contrat.get("menage_inclus")).isEqualTo("Oui");
            assertThat(contrat.get("maintenance_incluse")).isEqualTo("Non");

            @SuppressWarnings("unchecked")
            Map<String, Object> commission = (Map<String, Object>) context.get("commission");
            assertThat(commission.get("taux").toString()).contains("20");
        }

        @Test
        void whenContractTypesVary_thenAllLabelsResolved() {
            ManagementContract contract = new ManagementContract();
            contract.setId(901L);
            contract.setContractType(ManagementContract.ContractType.BOOKING_ONLY);

            when(managementContractRepository.findById(901L)).thenReturn(Optional.of(contract));
            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.MANDAT_GESTION, 901L, "management_contract");

            @SuppressWarnings("unchecked")
            Map<String, Object> contrat = (Map<String, Object>) context.get("contrat");
            assertThat(contrat.get("type_label")).isEqualTo("Réservations uniquement");
        }

        @Test
        void whenContractTypeMaintenanceOnly_thenLabel() {
            ManagementContract contract = new ManagementContract();
            contract.setId(902L);
            contract.setContractType(ManagementContract.ContractType.MAINTENANCE_ONLY);

            when(managementContractRepository.findById(902L)).thenReturn(Optional.of(contract));
            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.MANDAT_GESTION, 902L, "management_contract");

            @SuppressWarnings("unchecked")
            Map<String, Object> contrat = (Map<String, Object>) context.get("contrat");
            assertThat(contrat.get("type_label")).isEqualTo("Maintenance uniquement");
        }

        @Test
        void whenContractTypeCustom_thenLabel() {
            ManagementContract contract = new ManagementContract();
            contract.setId(903L);
            contract.setContractType(ManagementContract.ContractType.CUSTOM);

            when(managementContractRepository.findById(903L)).thenReturn(Optional.of(contract));
            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.MANDAT_GESTION, 903L, "management_contract");

            @SuppressWarnings("unchecked")
            Map<String, Object> contrat = (Map<String, Object>) context.get("contrat");
            assertThat(contrat.get("type_label")).isEqualTo("Personnalisé");
        }

        @Test
        void whenContractMinimalFields_thenDefaultsAndIndetermine() {
            ManagementContract contract = new ManagementContract();
            contract.setId(904L);
            // All optional fields null

            when(managementContractRepository.findById(904L)).thenReturn(Optional.of(contract));

            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.MANDAT_GESTION, 904L, "management_contract");

            @SuppressWarnings("unchecked")
            Map<String, Object> contrat = (Map<String, Object>) context.get("contrat");
            assertThat(contrat.get("date_fin")).isEqualTo("Indéterminée");
            assertThat(contrat.get("nuits_minimum")).isEqualTo("Aucun");
            assertThat(contrat.get("preavis_jours")).isEqualTo("30 jours");
            assertThat(contrat.get("renouvellement_auto")).isEqualTo("Non");
            // Defaults: cleaningFeeIncluded and maintenanceIncluded both default to true
            assertThat(contrat.get("menage_inclus")).isEqualTo("Oui");
            assertThat(contrat.get("maintenance_incluse")).isEqualTo("Oui");
        }

        @Test
        void whenContractIdNull_thenNothing() {
            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.MANDAT_GESTION, null, "management_contract");
            assertThat(context).doesNotContainKey("contrat");
        }

        @Test
        void whenContractAndProperty_thenBienAndPropertyResolved() {
            User owner = new User();
            owner.setFirstName("Pierre");
            owner.setLastName("Owner");
            Property prop = new Property();
            prop.setId(11L);
            prop.setName("Bien Test");

            ManagementContract contract = new ManagementContract();
            contract.setId(905L);
            contract.setPropertyId(11L);
            contract.setOwnerId(12L);

            when(managementContractRepository.findById(905L)).thenReturn(Optional.of(contract));
            when(propertyRepository.findById(11L)).thenReturn(Optional.of(prop));
            when(userRepository.findById(12L)).thenReturn(Optional.of(owner));

            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.MANDAT_GESTION, 905L, "management_contract");

            assertThat(context).containsKeys("property", "bien", "proprietaire");

            @SuppressWarnings("unchecked")
            Map<String, Object> proprio = (Map<String, Object>) context.get("proprietaire");
            assertThat(proprio.get("nom")).isEqualTo("Owner");
        }
    }

    // ===== PROPERTY TAGS - ALL FIELDS =====

    @Nested
    class PropertyTagsAllFields {

        @Test
        void whenAllPropertyFieldsSet_thenAllResolved() {
            User owner = new User();
            owner.setFirstName("A");
            owner.setLastName("B");

            Property property = new Property();
            property.setId(10L);
            property.setName("Villa Sud");
            property.setAddress("12 rue test");
            property.setCity("Cannes");
            property.setPostalCode("06400");
            property.setCountry("France");
            property.setType(PropertyType.VILLA);
            property.setSquareMeters(150);
            property.setBedroomCount(4);
            property.setBathroomCount(2);
            property.setMaxGuests(8);
            property.setNightlyPrice(new BigDecimal("250"));
            property.setDefaultCheckInTime("15:00");
            property.setDefaultCheckOutTime("11:00");
            property.setAccessInstructions("Code 1234");
            property.setOwner(owner);

            when(propertyRepository.findById(10L)).thenReturn(Optional.of(property));

            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.MANDAT_GESTION, 10L, "property");

            @SuppressWarnings("unchecked")
            Map<String, Object> propTags = (Map<String, Object>) context.get("property");
            assertThat(propTags.get("nom")).isEqualTo("Villa Sud");
            assertThat(propTags.get("adresse")).isEqualTo("12 rue test");
            assertThat(propTags.get("type")).isEqualTo("VILLA");
            assertThat(propTags.get("surface")).isEqualTo("150 m²");
            assertThat(propTags.get("chambres")).isEqualTo("4");
            assertThat(propTags.get("salles_bain")).isEqualTo("2");
            assertThat(propTags.get("capacite")).isEqualTo("8");
            assertThat(propTags.get("prix_nuit").toString()).contains("250").endsWith(" €");
            assertThat(propTags.get("check_in")).isEqualTo("15:00");
            assertThat(propTags.get("check_out")).isEqualTo("11:00");
            assertThat(propTags.get("instructions_acces")).isEqualTo("Code 1234");
        }

        @Test
        void whenPropertyMinimal_thenEmptyDefaults() {
            Property property = new Property();
            property.setId(10L);
            property.setName("Minimal");

            when(propertyRepository.findById(10L)).thenReturn(Optional.of(property));

            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.MANDAT_GESTION, 10L, "property");

            @SuppressWarnings("unchecked")
            Map<String, Object> propTags = (Map<String, Object>) context.get("property");
            assertThat(propTags.get("adresse")).isEqualTo("");
            // Property.type defaults to APARTMENT
            assertThat(propTags.get("type")).isEqualTo("APARTMENT");
            assertThat(propTags.get("surface")).isEqualTo("");
            assertThat(propTags.get("prix_nuit").toString()).contains("0").endsWith(" €");
        }
    }

    // ===== MONEY FORMATTING =====

    @Nested
    class MoneyFormatting {

        @Test
        void whenInterventionWithUsdCurrency_thenStillFormatsEur() {
            // formatMoney(BigDecimal) is hardcoded to EUR for property tags
            Property property = new Property();
            property.setId(10L);
            property.setName("US Studio");
            property.setNightlyPrice(new BigDecimal("100.50"));

            when(propertyRepository.findById(10L)).thenReturn(Optional.of(property));

            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.MANDAT_GESTION, 10L, "property");

            @SuppressWarnings("unchecked")
            Map<String, Object> propTags = (Map<String, Object>) context.get("property");
            assertThat(propTags.get("prix_nuit").toString()).contains("100").contains("50").endsWith(" €");
        }

        @Test
        void whenMoneyHasNullAmount_thenZeroEur() {
            Property property = new Property();
            property.setId(10L);
            property.setName("Null Price Prop");
            property.setNightlyPrice(null);

            when(propertyRepository.findById(10L)).thenReturn(Optional.of(property));

            Map<String, Object> context = service.resolveTagsForDocument(
                    DocumentType.MANDAT_GESTION, 10L, "property");

            @SuppressWarnings("unchecked")
            Map<String, Object> propTags = (Map<String, Object>) context.get("property");
            assertThat(propTags.get("prix_nuit").toString()).contains("0").endsWith(" €");
        }
    }
}
