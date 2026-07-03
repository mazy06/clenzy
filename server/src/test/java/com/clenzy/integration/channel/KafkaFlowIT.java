package com.clenzy.integration.channel;

import com.clenzy.AbstractIntegrationTest;
import com.clenzy.config.KafkaConfig;
import com.clenzy.config.TestSecurityConfig;
import com.clenzy.model.AutomationAction;
import com.clenzy.model.AutomationExecution;
import com.clenzy.model.AutomationRule;
import com.clenzy.model.AutomationTrigger;
import com.clenzy.model.CleaningFrequency;
import com.clenzy.model.Organization;
import com.clenzy.model.OrganizationType;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.User;
import com.clenzy.repository.AutomationExecutionRepository;
import com.clenzy.repository.AutomationRuleRepository;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.ServiceRequestService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Pageable;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.KafkaContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.TimeUnit;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Bout-en-bout evenementiel du registre central (strategie de tests, vague T1) :
 * un VRAI broker Kafka Testcontainers (dedie a cette classe — le socle partage
 * {@link AbstractIntegrationTest} garde un KafkaTemplate mocke), un message
 * {@code calendar.updates} BOOKED au format EXACT de
 * {@code CalendarEngine.buildPayload} (action / propertyId / orgId / from / to /
 * source / reservationId / timestamp), consomme par
 * {@link DeterministicFlowListener} (consumer group dedie
 * {@code clenzy-deterministic-flows}) → moteur → demande de menage en base.
 *
 * <p>La re-publication du MEME message (re-livraison Kafka) ne produit aucun
 * doublon : idempotence generique du moteur (regle x sujet) + cle metier
 * {@code AUTO_CLEANING} en filet.</p>
 *
 * <p>Publication alignee sur {@code OutboxRelay.sendEvent} : payload JSON String
 * parse en Object avant envoi (evite la double-serialisation JsonSerializer),
 * clef de partition = propertyId — tous les messages du test partagent la meme
 * partition, donc leur ordre de consommation est garanti (le message sentinelle
 * n'est traite qu'apres le doublon).</p>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("test")
@Import(TestSecurityConfig.class)
@EnabledIfEnvironmentVariable(named = "CLENZY_IT", matches = "true",
        disabledReason = "Tests d'integration (Docker/Testcontainers) — poser CLENZY_IT=true pour les executer")
class KafkaFlowIT {

    private static final LocalDate CHECK_IN_1 = LocalDate.of(2027, 9, 1);
    private static final LocalDate CHECK_OUT_1 = LocalDate.of(2027, 9, 5);
    private static final LocalDate CHECK_IN_2 = LocalDate.of(2027, 9, 20);
    private static final LocalDate CHECK_OUT_2 = LocalDate.of(2027, 9, 24);

    // Containers DEDIES : ce contexte a besoin d'un broker reel, et son schema
    // create-drop ne doit pas ecraser celui du contexte socle (base distincte).
    static final PostgreSQLContainer<?> postgres;
    @SuppressWarnings("resource")
    static final GenericContainer<?> redis;
    static final KafkaContainer kafka;

    static {
        if (AbstractIntegrationTest.IT_ENABLED) {
            postgres = new PostgreSQLContainer<>(
                    DockerImageName.parse("pgvector/pgvector:pg15").asCompatibleSubstituteFor("postgres"))
                    .withDatabaseName("clenzy_kafka")
                    .withUsername("test")
                    .withPassword("test")
                    .withInitScript("testcontainers/init-pgvector.sql");
            postgres.start();
            redis = new GenericContainer<>("redis:7-alpine").withExposedPorts(6379);
            redis.start();
            kafka = new KafkaContainer(DockerImageName.parse("confluentinc/cp-kafka:7.4.0"));
            kafka.start();
        } else {
            postgres = null;
            redis = null;
            kafka = null;
        }
    }

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url",
                () -> postgres.getJdbcUrl() + "&stringtype=unspecified");
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("spring.redis.host", redis::getHost);
        registry.add("spring.redis.port", () -> redis.getMappedPort(6379));
        // Broker reel : KafkaConfig actif (producer + containers @KafkaListener).
        registry.add("clenzy.kafka.enabled", () -> "true");
        registry.add("spring.kafka.bootstrap-servers", kafka::getBootstrapServers);
    }

    @Autowired private KafkaTemplate<String, Object> kafkaTemplate;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private AutomationRuleRepository ruleRepository;
    @Autowired private AutomationExecutionRepository executionRepository;
    @Autowired private ServiceRequestRepository serviceRequestRepository;
    @Autowired private ReservationRepository reservationRepository;
    @Autowired private PropertyRepository propertyRepository;
    @Autowired private OrganizationRepository organizationRepository;
    @Autowired private UserRepository userRepository;

    @Test
    void bookedEvent_flowsToCleaningRequest_andRedeliveryCreatesNoDuplicate() throws Exception {
        // ── Fixtures COMMITEES (le consumer Kafka lit dans sa propre transaction) ──
        Organization organization = organizationRepository.save(
            new Organization("Kafka Flow Org", OrganizationType.INDIVIDUAL, "kafka-flow-org"));
        Long orgId = organization.getId();

        User owner = new User("Kevin", "Kafka", "kevin.kafka@test.com", "password123");
        owner.setOrganizationId(orgId);
        owner.setKeycloakId("kc-kafka-flow");
        userRepository.save(owner);

        Property property = new Property("Studio Kafka", "3 rue des Topics", 1, 1, owner);
        property.setOrganizationId(orgId);
        property.setNightlyPrice(new BigDecimal("70.00"));
        property.setCleaningFrequency(CleaningFrequency.AFTER_EACH_STAY);
        propertyRepository.save(property);

        // saveAndFlush : Hibernate DIFFERE l'insert IDENTITY des entites versionnees
        // (@Version) — avec un simple save(), getId() reste null et le payload
        // partirait sans reservationId (le listener le deleguerait au filet quotidien).
        Reservation reservation1 = new Reservation(property, "Guest Kafka 1",
            CHECK_IN_1, CHECK_OUT_1, "confirmed", "MANUAL");
        reservation1.setOrganizationId(orgId);
        reservation1 = reservationRepository.saveAndFlush(reservation1);
        Reservation reservation2 = new Reservation(property, "Guest Kafka 2",
            CHECK_IN_2, CHECK_OUT_2, "confirmed", "MANUAL");
        reservation2.setOrganizationId(orgId);
        reservation2 = reservationRepository.saveAndFlush(reservation2);
        final Long reservation1Id = reservation1.getId();

        AutomationRule rule = new AutomationRule();
        rule.setOrganizationId(orgId);
        rule.setName("IT Kafka BOOKED -> menage");
        rule.setEnabled(true);
        rule.setTriggerType(AutomationTrigger.RESERVATION_BOOKED);
        rule.setActionType(AutomationAction.CREATE_CLEANING_REQUEST);
        ruleRepository.save(rule);

        String key1 = ServiceRequestService.buildAutoCleaningKey(property.getId(), CHECK_IN_1, CHECK_OUT_1);
        String key2 = ServiceRequestService.buildAutoCleaningKey(property.getId(), CHECK_IN_2, CHECK_OUT_2);

        // Sanity fixture : la regle est bien visible hors transaction de test.
        assertEquals(1, ruleRepository.findByOrganizationIdAndTriggerTypeAndEnabledTrue(
            orgId, AutomationTrigger.RESERVATION_BOOKED).size(), "Regle non visible en base");

        // ── 1. BOOKED reel → listener → moteur → SR menage en base ──────────────
        publishBooked(property.getId(), orgId, CHECK_IN_1, CHECK_OUT_1, reservation1.getId());
        await().atMost(Duration.ofSeconds(120)).untilAsserted(() ->
            assertTrue(serviceRequestRepository.findByAutoFlowKey(key1, orgId).isPresent(),
                "La demande de menage doit etre creee par le flux Kafka"));

        // ── 2. Re-livraison du MEME message, puis message sentinelle (meme clef
        //       de partition → consomme APRES le doublon) ─────────────────────────
        publishBooked(property.getId(), orgId, CHECK_IN_1, CHECK_OUT_1, reservation1.getId());
        publishBooked(property.getId(), orgId, CHECK_IN_2, CHECK_OUT_2, reservation2.getId());
        await().atMost(Duration.ofSeconds(120)).untilAsserted(() ->
            assertTrue(serviceRequestRepository.findByAutoFlowKey(key2, orgId).isPresent(),
                "Le message sentinelle doit etre traite"));

        // ── 3. Toujours UNE SEULE execution / UNE SEULE SR pour la reservation 1 ──
        List<AutomationExecution> executions = executionRepository
            .findByAutomationRuleIdAndOrganizationIdOrderByCreatedAtDesc(
                rule.getId(), orgId, Pageable.unpaged())
            .getContent();
        assertEquals(2, executions.size(),
            "Une execution par reservation, pas de doublon a la re-livraison");
        assertEquals(1, executions.stream()
            .filter(e -> reservation1Id.equals(e.getSubjectId())).count(),
            "Idempotence : une seule execution pour la reservation re-livree");
        assertTrue(serviceRequestRepository.findByAutoFlowKey(key1, orgId).isPresent());
    }

    /**
     * Publie sur {@code calendar.updates} le payload EXACT de
     * {@code CalendarEngine.buildPayload}, de la meme facon que
     * {@code OutboxRelay.sendEvent} (JSON String parse en Object, clef = propertyId).
     */
    private void publishBooked(Long propertyId, Long orgId, LocalDate from, LocalDate to,
                               Long reservationId) throws Exception {
        String json = "{"
            + "\"action\":\"BOOKED\""
            + ",\"propertyId\":" + propertyId
            + ",\"orgId\":" + orgId
            + ",\"from\":\"" + from + "\""
            + ",\"to\":\"" + to + "\""
            + ",\"source\":\"MANUAL\""
            + ",\"reservationId\":" + reservationId
            + ",\"timestamp\":\"" + Instant.now() + "\""
            + "}";
        Object payload = objectMapper.readValue(json, Object.class);
        kafkaTemplate.send(KafkaConfig.TOPIC_CALENDAR_UPDATES, String.valueOf(propertyId), payload)
            .get(30, TimeUnit.SECONDS);
    }
}
