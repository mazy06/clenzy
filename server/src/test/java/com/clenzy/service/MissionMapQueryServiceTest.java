package com.clenzy.service;

import com.clenzy.dto.ServiceRequestDto;
import com.clenzy.model.*;
import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.springframework.security.oauth2.jwt.Jwt;
import java.io.ByteArrayInputStream;
import java.lang.reflect.Modifier;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Exécute les vraies requêtes HQL sur H2, sans charger tout le graphe du PMS. */
class MissionMapQueryServiceTest {
    static SessionFactory sessions;
    jakarta.persistence.EntityManager em;
    MissionMapQueryService service;
    UserRepository users;
    User owner;
    static final MissionMapQueryService.Filters ALL = filters(null, null, null, null);

    static MissionMapQueryService.Filters filters(Double north, Double south, Double east, Double west) {
        return new MissionMapQueryService.Filters(null, null, null, null, null, north, south, east, west);
    }

    @BeforeAll static void mapping() {
        Map<Class<?>, Set<String>> basics = new LinkedHashMap<>();
        basics.put(User.class, Set.of("id", "keycloakId"));
        basics.put(Property.class, Set.of("id", "name", "latitude", "longitude"));
        basics.put(Team.class, Set.of("id"));
        basics.put(TeamMember.class, Set.of("id"));
        basics.put(ServiceRequest.class, Set.of("id", "organizationId", "title", "description", "status", "priority", "serviceType", "desiredDate", "assignedToId", "assignedToType", "assignmentPhase"));
        basics.put(Intervention.class, Set.of("id", "organizationId", "title", "description", "status", "priority", "type", "scheduledDate", "teamId"));
        Map<Class<?>, Set<String>> relations = Map.of(
                Property.class, Set.of("owner"), TeamMember.class, Set.of("team", "user"),
                ServiceRequest.class, Set.of("property", "user"), Intervention.class, Set.of("property", "assignedUser", "serviceRequest"));
        StringBuilder xml = new StringBuilder("<entity-mappings xmlns=\"https://jakarta.ee/xml/ns/persistence/orm\" version=\"3.1\">");
        basics.forEach((type, fields) -> {
            xml.append("<entity class=\"").append(type.getName()).append("\" access=\"FIELD\" metadata-complete=\"true\"><table name=\"map_")
                    .append(type.getSimpleName()).append("\"/><attributes><id name=\"id\"/>");
            for (var field : type.getDeclaredFields()) {
                if (Modifier.isStatic(field.getModifiers()) || field.getName().equals("id")) continue;
                String name = field.getName();
                if (fields.contains(name)) {
                    xml.append("<basic name=\"").append(name).append("\">");
                    if (field.getType().isEnum()) xml.append("<enumerated>STRING</enumerated>");
                    xml.append("</basic>");
                } else if (relations.getOrDefault(type, Set.of()).contains(name)) {
                    xml.append("<many-to-one name=\"").append(name).append("\" fetch=\"LAZY\"/>");
                } else xml.append("<transient name=\"").append(name).append("\"/>");
            }
            xml.append("</attributes></entity>");
        });
        xml.append("</entity-mappings>");
        sessions = new Configuration().addPackage("com.clenzy.model").addInputStream(new ByteArrayInputStream(xml.toString().getBytes(StandardCharsets.UTF_8)))
                .setProperty("hibernate.connection.url", "jdbc:h2:mem:missionmap;DB_CLOSE_DELAY=-1;MODE=PostgreSQL")
                .setProperty("hibernate.hbm2ddl.auto", "create-drop")
                .setProperty("jakarta.persistence.validation.mode", "none").buildSessionFactory();
    }

    @AfterAll static void close() { if (sessions != null) sessions.close(); }
    @BeforeEach void setup() {
        em = sessions.createEntityManager(); em.getTransaction().begin();
        TenantContext tenant = mock(TenantContext.class); when(tenant.getRequiredOrganizationId()).thenReturn(1L);
        users = mock(UserRepository.class);
        ServiceRequestService requests = mock(ServiceRequestService.class);
        when(requests.readDtosWithMissionAssignment(anyList())).thenAnswer(invocation -> {
            List<ServiceRequest> entities = invocation.getArgument(0);
            return entities.stream().map(entity -> { var dto = new ServiceRequestDto(); dto.id = entity.getId(); return dto; }).toList();
        });
        service = new MissionMapQueryService(em, tenant, users, requests, mock(InterventionMapper.class));
        owner = new User(); owner.setId(1L); owner.setKeycloakId("owner"); em.persist(owner);
        Property property = new Property(); property.setId(1L); property.setName("Tours"); property.setOwner(owner);
        property.setLatitude(new BigDecimal("47.39")); property.setLongitude(new BigDecimal("0.68")); em.persist(property);
        for (long id = 1; id <= 45; id++) {
            ServiceRequest request = new ServiceRequest(); request.setId(id); request.setOrganizationId(1L);
            request.setTitle("Mission " + id); request.setDescription("Ménage"); request.setProperty(property);
            request.setStatus(RequestStatus.PENDING); request.setPriority(Priority.NORMAL); request.setServiceType(ServiceType.CLEANING);
            request.setDesiredDate(LocalDateTime.now().plusDays(id - 5)); em.persist(request);
            Intervention intervention = new Intervention(); intervention.setId(id); intervention.setOrganizationId(1L);
            intervention.setProperty(property); intervention.setTitle("Mission " + id); intervention.setDescription("Ménage");
            intervention.setType("CLEANING"); intervention.setPriority("NORMAL"); intervention.setStatus(InterventionStatus.PENDING);
            intervention.setScheduledDate(request.getDesiredDate()); em.persist(intervention);
        }
        em.flush(); em.clear();
    }
    @AfterEach void rollback() { em.getTransaction().rollback(); em.close(); }
    Jwt jwt(String role, String subject) {
        return Jwt.withTokenValue("test").header("alg", "none").subject(subject).claim("realm_access", Map.of("roles", List.of(role))).build();
    }
    @Test void bothScreensPageTwentyThenTwentyThenFiveAndKeepAllMarkers() {
        for (String kind : List.of("service-requests", "interventions")) {
            var jwt = jwt("SUPER_ADMIN", "admin");
            assertThat(service.overview(kind, ALL, jwt).markers()).hasSize(45);
            var first = service.page(kind, ALL, 0, jwt);
            var second = service.page(kind, ALL, 1, jwt);
            var last = service.page(kind, ALL, 2, jwt);
            assertThat(first.content()).hasSize(20); assertThat(first.last()).isFalse();
            assertThat(second.content()).hasSize(20); assertThat(second.totalElements()).isEqualTo(45);
            assertThat(last.content()).hasSize(5); assertThat(last.last()).isTrue();
            if (kind.equals("service-requests")) {
                assertThat(first.content().stream().map(row -> ((ServiceRequestDto) row).id)).containsExactlyElementsOf(java.util.stream.LongStream.rangeClosed(1, 20).boxed().toList());
            }
        }
    }
    @Test void boundsAndSearchApplyBeforePagination() {
        var jwt = jwt("SUPER_ADMIN", "admin");
        assertThat(service.page("service-requests", filters(48d, 47d, 1d, 0d), 0, jwt).totalElements()).isEqualTo(45);
        assertThat(service.page("service-requests", filters(20d, 10d, 1d, 0d), 0, jwt).content()).isEmpty();
        var search = new MissionMapQueryService.Filters("Mission 4", "cleaning", "pending", "normal", 1L, null, null, null, null);
        assertThat(service.page("interventions", search, 0, jwt).totalElements()).isEqualTo(7);
        assertThat(service.overview("interventions", search, jwt).markers()).hasSize(7);
        assertThat(service.page("interventions", filters(90d, -90d, -170d, 170d), 0, jwt).content()).isEmpty();
    }
    @Test void closedAndAlreadyConvertedRequestsAreExcludedBeforePagingAndCounting() {
        em.find(ServiceRequest.class, 1L).setStatus(RequestStatus.COMPLETED);
        em.find(ServiceRequest.class, 2L).setStatus(RequestStatus.AWAITING_PAYMENT);
        em.find(ServiceRequest.class, 3L).setStatus(RequestStatus.IN_PROGRESS);
        em.find(ServiceRequest.class, 4L).setStatus(RequestStatus.CANCELLED);
        em.find(ServiceRequest.class, 5L).setStatus(RequestStatus.REJECTED);
        em.find(ServiceRequest.class, 6L).setAssignmentPhase("CONVERTED");
        // Ancienne demande encore PENDING, mais déjà transformée en intervention.
        em.find(Intervention.class, 7L).setServiceRequest(em.find(ServiceRequest.class, 7L));
        em.find(ServiceRequest.class, 8L).setStatus(RequestStatus.ASSIGNED);
        em.flush();
        var admin = jwt("SUPER_ADMIN", "admin");
        assertThat(service.overview("service-requests", ALL, admin).total()).isEqualTo(38);
        var page = service.page("service-requests", ALL, 0, admin);
        assertThat(page.content()).hasSize(20);
        assertThat(page.totalElements()).isEqualTo(38);
        assertThat(page.content().stream().map(row -> ((ServiceRequestDto) row).id)).contains(8L).doesNotContain(1L,2L,3L,4L,5L,6L,7L);
        // La liste et la carte partagent le même prédicat exécuté en base.
        var list = em.createQuery("SELECT x FROM ServiceRequest x LEFT JOIN FETCH x.property LEFT JOIN FETCH x.user WHERE x.organizationId = :orgId AND "
                + com.clenzy.repository.ServiceRequestReadScope.OPEN, ServiceRequest.class).setParameter("orgId",1L).getResultList();
        assertThat(list).hasSize(38);
        assertThat(service.overview("interventions", ALL, admin).total()).isEqualTo(45);
    }
    @Test void ownersAndOperatorsCannotReadOtherPeoplesMissions() {
        User outsider = new User(); outsider.setId(99L);
        when(users.findByKeycloakId("outsider")).thenReturn(Optional.of(outsider));
        when(users.findByKeycloakId("owner")).thenReturn(Optional.of(owner));
        for (String kind : List.of("service-requests", "interventions")) {
            assertThat(service.overview(kind, ALL, jwt("HOST", "owner")).total()).isEqualTo(45);
            assertThat(service.overview(kind, ALL, jwt("HOST", "outsider")).markers()).isEmpty();
            assertThat(service.page(kind, ALL, 0, jwt("TECHNICIAN", "outsider")).content()).isEmpty();
        }
    }
    @Test void malformedBoundsAndPagesAreRejected() {
        assertThatThrownBy(() -> MissionMapQueryService.validateBounds(filters(91d, 0d, 0d, 0d))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> MissionMapQueryService.validateBounds(filters(Double.NaN, 0d, 0d, 0d))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.page("interventions", ALL, -1, jwt("SUPER_ADMIN", "admin"))).isInstanceOf(IllegalArgumentException.class);
    }

    @Test void crossOrganizationMissionsAreVisibleOnlyToTheirAssigneeOrTeam() {
        User worker = new User(); worker.setId(2L); worker.setKeycloakId("worker"); em.persist(worker);
        Team team = new Team(); team.setId(7L); em.persist(team);
        TeamMember membership = new TeamMember(); membership.setId(7L); membership.setTeam(team); membership.setUser(worker); em.persist(membership);
        Intervention direct = em.find(Intervention.class, 1L); direct.setOrganizationId(2L); direct.setAssignedUser(worker);
        Intervention collective = em.find(Intervention.class, 2L); collective.setOrganizationId(2L); collective.setTeamId(7L);
        when(users.findByKeycloakId("worker")).thenReturn(Optional.of(worker));
        em.flush();
        org.hibernate.Session session = em.unwrap(org.hibernate.Session.class);
        session.enableFilter("organizationFilter").setParameter("orgId", 1L);
        assertThat(service.page("interventions", ALL, 0, jwt("TECHNICIAN", "worker")).totalElements()).isEqualTo(2);
        assertThat(service.overview("interventions", ALL, jwt("TECHNICIAN", "worker")).markers()).hasSize(2);
        assertThat(((org.hibernate.internal.FilterImpl) session.getEnabledFilter("organizationFilter")).getParameter("orgId")).isEqualTo(1L);
        session.disableFilter("organizationFilter");
        assertThat(service.overview("interventions", ALL, jwt("SUPER_ADMIN", "admin")).total()).isEqualTo(43);
        em.find(ServiceRequest.class, 1L).setOrganizationId(2L);
        em.flush();
        assertThat(service.overview("service-requests", ALL, jwt("SUPER_ADMIN", "admin")).total()).isEqualTo(44);
    }
}
