package com.clenzy.repository;

import com.clenzy.AbstractIntegrationTest;
import com.clenzy.model.CalendarDay;
import com.clenzy.model.CalendarDayStatus;
import com.clenzy.model.Organization;
import com.clenzy.model.OrganizationType;
import com.clenzy.model.Property;
import com.clenzy.model.PropertyStatus;
import com.clenzy.model.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.annotation.Rollback;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Périmètre de {@link CalendarDayRepository#findClosedNightsForDashboard} sur une vraie base :
 * il doit coïncider avec le dénominateur du dashboard (logements actifs de l'org, propriétaire
 * pour un HOST) et ne retenir que les nuits BLOCKED / MAINTENANCE de [from, toExclusive).
 */
@Transactional
@Rollback
class CalendarDayRepositoryIntegrationTest extends AbstractIntegrationTest {

    private static final LocalDate FROM = LocalDate.of(2027, 8, 10);
    private static final LocalDate TO_EXCLUSIVE = LocalDate.of(2027, 8, 20);
    private static final String HOST_KC = "kc-closed-nights-host";

    @Autowired private CalendarDayRepository calendarDayRepository;
    @Autowired private PropertyRepository propertyRepository;
    @Autowired private OrganizationRepository organizationRepository;
    @Autowired private UserRepository userRepository;

    private Long orgId;
    private Property hostProperty;
    private Property otherOwnerProperty;

    @BeforeEach
    void createTestData() {
        orgId = organization("closed-nights-org");
        User host = owner(HOST_KC, orgId);
        hostProperty = property(host, orgId, PropertyStatus.ACTIVE);
        otherOwnerProperty = property(owner("kc-closed-nights-other", orgId), orgId, PropertyStatus.ACTIVE);
        Property inactive = property(host, orgId, PropertyStatus.INACTIVE);
        Long foreignOrgId = organization("closed-nights-foreign");
        Property foreign = property(owner("kc-closed-nights-foreign", foreignOrgId), foreignOrgId, PropertyStatus.ACTIVE);

        day(hostProperty, FROM, CalendarDayStatus.BLOCKED);
        day(hostProperty, FROM.plusDays(1), CalendarDayStatus.MAINTENANCE);
        day(hostProperty, FROM.plusDays(2), CalendarDayStatus.BOOKED);
        day(hostProperty, FROM.plusDays(3), CalendarDayStatus.AVAILABLE);
        day(hostProperty, FROM.minusDays(1), CalendarDayStatus.BLOCKED);
        day(hostProperty, TO_EXCLUSIVE, CalendarDayStatus.BLOCKED);
        day(otherOwnerProperty, FROM, CalendarDayStatus.BLOCKED);
        day(inactive, FROM, CalendarDayStatus.BLOCKED);
        day(foreign, FROM, CalendarDayStatus.BLOCKED);
        calendarDayRepository.flush();

        // Super-admin : filtre Hibernate levé, seul le prédicat org de la requête isole les orgs.
        setupTenantContext(orgId, true);
    }

    @Test
    void whenNoOwnerScope_thenReturnsClosedNightsOfTheOrgsActivePropertiesWithinBounds() {
        // Act
        List<Object[]> rows = calendarDayRepository.findClosedNightsForDashboard(
                FROM, TO_EXCLUSIVE, orgId, null, PropertyStatus.ACTIVE);

        // Assert
        assertThat(keys(rows)).containsExactlyInAnyOrder(
                key(hostProperty, FROM), key(hostProperty, FROM.plusDays(1)), key(otherOwnerProperty, FROM));
    }

    @Test
    void whenHostScope_thenOnlyTheHostsPropertiesAreReturned() {
        // Act
        List<Object[]> rows = calendarDayRepository.findClosedNightsForDashboard(
                FROM, TO_EXCLUSIVE, orgId, HOST_KC, PropertyStatus.ACTIVE);

        // Assert
        assertThat(keys(rows)).containsExactlyInAnyOrder(
                key(hostProperty, FROM), key(hostProperty, FROM.plusDays(1)));
    }

    private Long organization(String slug) {
        return organizationRepository.save(new Organization(slug, OrganizationType.INDIVIDUAL, slug)).getId();
    }

    private User owner(String keycloakId, Long organizationId) {
        User user = new User("Test", keycloakId, keycloakId + "@test.com", "password123");
        user.setOrganizationId(organizationId);
        user.setKeycloakId(keycloakId);
        return userRepository.save(user);
    }

    private Property property(User owner, Long organizationId, PropertyStatus status) {
        Property property = new Property("Logement " + owner.getKeycloakId(), "1 rue du Test", 2, 1, owner);
        property.setOrganizationId(organizationId);
        property.setStatus(status);
        return propertyRepository.save(property);
    }

    private void day(Property property, LocalDate date, CalendarDayStatus status) {
        calendarDayRepository.save(new CalendarDay(property, date, status, property.getOrganizationId()));
    }

    private static List<String> keys(List<Object[]> rows) {
        return rows.stream().map(row -> row[0] + "@" + row[1]).toList();
    }

    private static String key(Property property, LocalDate date) {
        return property.getId() + "@" + date;
    }
}
