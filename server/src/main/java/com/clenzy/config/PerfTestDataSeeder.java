package com.clenzy.config;

import com.clenzy.model.Organization;
import com.clenzy.model.OrganizationType;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.model.UserStatus;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Peuple la base ephemere du profil {@code ci} avec le jeu minimal que les tests
 * de charge K6 doivent traverser : une organisation, l'utilisateur porte par le
 * JWT de CI, ses logements et quelques reservations.
 *
 * <p><b>Le probleme qu'il resout.</b> Le profil {@code ci} tourne en
 * {@code ddl-auto: create-drop} sans Liquibase : le schema existe, les tables
 * sont vides. Le {@code sub} du JWT de CI n'a donc aucune ligne dans
 * {@code users}, et {@link com.clenzy.tenant.TenantFilter} refuse — a raison,
 * fail-closed — toute requete org-scopee avec un 403 rendu en ~3 ms. Le load
 * test mesurait alors la chaine de filtres Spring Security et rien d'autre :
 * 83 % d'erreurs, une p95 flatteuse, aucun controleur atteint. Les chiffres
 * paraissaient verts parce qu'aucun travail n'etait fait.</p>
 *
 * <p><b>Pourquoi un seeder JPA et pas un script SQL.</b> {@code first_name},
 * {@code last_name}, {@code email} et {@code phone_number} passent par
 * {@link EncryptedFieldConverter} (AES-256 au repos). Des INSERT en clair
 * seraient relus comme du ciphertext corrompu et leveraient une
 * {@code FieldDecryptionException} a la premiere lecture. Le chiffrement, les
 * timestamps et les valeurs par defaut des entites ne sont corrects que si les
 * lignes passent par Hibernate.</p>
 *
 * <p><b>Role HOST volontaire.</b> Un compte staff plateforme court-circuiterait
 * le filtre tenant : la mesure porterait sur un chemin que le trafic reel
 * n'emprunte pas. Le HOST garde l'isolation org active, donc le cout que l'on
 * cherche a mesurer. Corollaire assume : {@code GET /api/users} reste
 * SUPER_ADMIN-only et repond 403 — le scenario K6 declare ce refus comme
 * attendu plutot que de gonfler le role du compte de test.</p>
 *
 * <p><b>Idempotent</b> : si l'utilisateur de perf existe deja, le runner ne fait
 * rien. Une erreur de seed n'empeche pas le demarrage — elle est loggee, et le
 * garde-fou du workflow (taux d'erreur K6 &gt; 50 %) transforme le silence en
 * echec visible.</p>
 */
@Component
@Profile("ci")
@Order(Ordered.LOWEST_PRECEDENCE)
public class PerfTestDataSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(PerfTestDataSeeder.class);

    private static final String ORG_NAME = "Baitly Perf Test";
    private static final String ORG_SLUG = "baitly-perf-test";
    private static final String USER_EMAIL = "perf-test@baitly.fr";

    /**
     * Nombre de logements seedes, et de reservations par logement.
     *
     * <p>10 et pas 5 : le soak tire un id au hasard dans 1..10. Un jeu plus
     * etroit renverrait 4xx sur la moitie de ces lectures — un taux d'erreur
     * de fixture, indiscernable d'une vraie panne dans le resultat.</p>
     */
    private static final int PROPERTY_COUNT = 10;
    private static final int RESERVATIONS_PER_PROPERTY = 4;

    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository;
    private final PropertyRepository propertyRepository;
    private final ReservationRepository reservationRepository;
    private final TransactionTemplate transactionTemplate;
    private final String keycloakId;

    public PerfTestDataSeeder(OrganizationRepository organizationRepository,
                              UserRepository userRepository,
                              PropertyRepository propertyRepository,
                              ReservationRepository reservationRepository,
                              PlatformTransactionManager transactionManager,
                              @Value("${clenzy.perf.seed.keycloak-id}") String keycloakId) {
        this.organizationRepository = organizationRepository;
        this.userRepository = userRepository;
        this.propertyRepository = propertyRepository;
        this.reservationRepository = reservationRepository;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
        this.keycloakId = keycloakId;
    }

    @Override
    public void run(ApplicationArguments args) {
        try {
            transactionTemplate.executeWithoutResult(status -> seed());
        } catch (Exception e) {
            log.error("Seed du jeu de perf impossible : {}", e.getMessage(), e);
        }
    }

    private void seed() {
        if (userRepository.findByKeycloakId(keycloakId).isPresent()) {
            log.info("Jeu de perf deja present (keycloakId={}), seed ignore", keycloakId);
            return;
        }

        Organization organization = organizationRepository.findBySlug(ORG_SLUG)
                .orElseGet(() -> organizationRepository.save(newOrganization()));

        User owner = userRepository.save(newOwner(organization.getId()));

        List<Property> properties = new ArrayList<>(PROPERTY_COUNT);
        for (int i = 1; i <= PROPERTY_COUNT; i++) {
            properties.add(propertyRepository.save(newProperty(i, owner, organization.getId())));
        }

        int reservations = 0;
        for (Property property : properties) {
            for (Reservation reservation : newReservations(property, organization.getId())) {
                reservationRepository.save(reservation);
                reservations++;
            }
        }

        log.info("Jeu de perf seede : org={}, user={}, {} logements, {} reservations",
                organization.getId(), owner.getId(), properties.size(), reservations);
    }

    private Organization newOrganization() {
        Organization organization = new Organization();
        organization.setName(ORG_NAME);
        organization.setSlug(ORG_SLUG);
        organization.setType(OrganizationType.INDIVIDUAL);
        return organization;
    }

    private User newOwner(Long organizationId) {
        User user = new User();
        user.setOrganizationId(organizationId);
        user.setKeycloakId(keycloakId);
        user.setFirstName("Perf");
        user.setLastName("Test");
        user.setEmail(USER_EMAIL);
        user.setRole(UserRole.HOST);
        user.setStatus(UserStatus.ACTIVE);
        return user;
    }

    private Property newProperty(int index, User owner, Long organizationId) {
        Property property = new Property(
                "Baitly Perf Logement " + index,
                index + " rue de la Charge, 75001 Paris",
                2,
                1,
                owner);
        property.setOrganizationId(organizationId);
        property.setCity("Paris");
        property.setCountry("France");
        property.setCountryCode("FR");
        property.setPostalCode("75001");
        property.setNightlyPrice(new BigDecimal("120.00"));
        return property;
    }

    /**
     * Quatre sejours de trois nuits espaces d'une semaine sur le mois courant :
     * le scenario K6 interroge le mois en cours, la fenetre doit donc contenir
     * des lignes a resoudre plutot qu'un calendrier vide.
     */
    private List<Reservation> newReservations(Property property, Long organizationId) {
        LocalDate firstOfMonth = LocalDate.now().withDayOfMonth(1);
        List<Reservation> reservations = new ArrayList<>(RESERVATIONS_PER_PROPERTY);

        for (int i = 0; i < RESERVATIONS_PER_PROPERTY; i++) {
            LocalDate checkIn = firstOfMonth.plusDays(i * 7L);
            Reservation reservation = new Reservation(
                    property,
                    "Voyageur Perf " + (i + 1),
                    checkIn,
                    checkIn.plusDays(3),
                    "confirmed",
                    "direct");
            reservation.setOrganizationId(organizationId);
            reservation.setTotalPrice(new BigDecimal("360.00"));
            reservations.add(reservation);
        }
        return reservations;
    }
}
