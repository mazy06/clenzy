package com.clenzy.service;

import com.clenzy.model.Property;
import com.clenzy.model.PropertyStockItem;
import com.clenzy.model.SupervisionSuggestion;
import com.clenzy.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import org.springframework.security.access.AccessDeniedException;

import java.io.ByteArrayInputStream;
import java.lang.reflect.Modifier;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Vraies requêtes JPA, pagination et isolation, sans Docker ni services externes. */
class ConsumablesOverviewTest {
    static SessionFactory sessions;
    jakarta.persistence.EntityManager em;
    ConsumablesOverviewService service;
    static final Instant NOW = Instant.parse("2026-10-01T12:00:00Z");

    @BeforeAll static void mapping() {
        // Le logement a de nombreuses relations hors sujet ; conserver ses champs utilisés par les jointures.
        StringBuilder xml = new StringBuilder("<entity-mappings xmlns=\"https://jakarta.ee/xml/ns/persistence/orm\" version=\"3.1\"><entity class=\"")
                .append(Property.class.getName()).append("\" access=\"FIELD\" metadata-complete=\"true\"><table name=\"stock_test_properties\"/><attributes><id name=\"id\"/>");
        for (var field : Property.class.getDeclaredFields()) {
            if (Modifier.isStatic(field.getModifiers()) || field.getName().equals("id")) continue;
            xml.append(Set.of("name", "organizationId").contains(field.getName()) ? "<basic name=\"" : "<transient name=\"")
                    .append(field.getName()).append("\"/>");
        }
        xml.append("</attributes></entity></entity-mappings>");
        sessions = new Configuration().addPackage("com.clenzy.model")
                .addInputStream(new ByteArrayInputStream(xml.toString().getBytes(StandardCharsets.UTF_8)))
                .addAnnotatedClass(PropertyStockItem.class).addAnnotatedClass(SupervisionSuggestion.class)
                .setProperty("hibernate.connection.url", "jdbc:h2:mem:consumables;MODE=PostgreSQL")
                .setProperty("hibernate.hbm2ddl.auto", "create-drop")
                .setProperty("jakarta.persistence.validation.mode", "none").buildSessionFactory();
    }
    @AfterAll static void close() { if (sessions != null) sessions.close(); }
    @BeforeEach void setup() {
        em = sessions.createEntityManager(); em.getTransaction().begin();
        Property p = new Property(); p.setId(7L); p.setOrganizationId(1L); p.setName("Villa Azur"); em.persist(p);
        Property other = new Property(); other.setId(8L); other.setOrganizationId(2L); other.setName("Autre organisation"); em.persist(other);
        var properties = mock(PropertyRepository.class);
        var choice = mock(PropertyRepository.StockPropertyChoice.class);
        when(choice.getId()).thenReturn(7L); when(choice.getName()).thenReturn("Villa Azur");
        when(properties.findStockPropertyChoices(1L)).thenReturn(List.of(choice));
        var factory = new JpaRepositoryFactory(em);
        service = new ConsumablesOverviewService(factory.getRepository(PropertyStockItemRepository.class),
                factory.getRepository(SupervisionSuggestionRepository.class), properties, new ObjectMapper(), Clock.fixed(NOW, ZoneOffset.UTC));
    }
    @AfterEach void rollback() { em.getTransaction().rollback(); em.close(); }

    PropertyStockItem item(long org, long property, String name) {
        var item = new PropertyStockItem(); item.setOrganizationId(org); item.setPropertyId(property);
        item.setName(name); item.setQuantity(3); item.setReorderThreshold(4); item.setReorderQuantity(12);
        item.setSupplierName("Maison Café"); item.setUnit("boîtes"); item.setCatalogKey("coffee-capsules");
        em.persist(item); return item;
    }
    SupervisionSuggestion suggestion(long org, long property, String status, Instant expiry, Long itemId) {
        var s = new SupervisionSuggestion(org, property, "ops", "stock_low", "Stock bas : Café (3 restant)", "Fournisseur Maison Café", expiry);
        s.setActionType("LINEN_STOCK_ORDER"); s.setStatus(status); s.setActionParams("{\"stockItemId\":" + itemId + "}");
        if (status.equals("APPLIED")) s.setAppliedAt(NOW.minusSeconds(600));
        em.persist(s); return s;
    }

    @Test void queriesExcludeExpiredDismissedOtherTenantsAndMismatchedProperties() {
        var item = item(1, 7, "Capsules de café");
        suggestion(1, 7, "PENDING", NOW.plusSeconds(60), item.getId());
        suggestion(1, 7, "PENDING", NOW.minusSeconds(1), item.getId());
        suggestion(1, 7, "DISMISSED", NOW.plusSeconds(60), item.getId());
        suggestion(1, 7, "APPLIED", NOW.minusSeconds(60), item.getId());
        suggestion(2, 8, "PENDING", NOW.plusSeconds(60), item.getId());
        suggestion(1, 8, "PENDING", NOW.plusSeconds(60), item.getId());
        item(2, 8, "Secret"); item(1, 8, "Incohérent");
        em.flush();
        var pending = service.list(1L, ConsumablesOverviewService.View.pending, null, "", 0, 20);
        assertThat(pending.counts()).containsEntry(ConsumablesOverviewService.View.pending, 1L)
                .containsEntry(ConsumablesOverviewService.View.ordered, 1L).containsEntry(ConsumablesOverviewService.View.stock, 1L);
        assertThat(pending.rows()).singleElement().satisfies(row -> {
            assertThat(row.name()).isEqualTo("Capsules de café"); assertThat(row.quantity()).isEqualTo(12);
        });
        var ordered = service.list(1L, ConsumablesOverviewService.View.ordered, null, "", 0, 20).rows().getFirst();
        assertThat(ordered.quantity()).isNull(); assertThat(ordered.supplierName()).isNull();
        assertThat(ordered.name()).isEqualTo("Café"); assertThat(ordered.orderedAt()).isNotNull();
        assertThat(ordered.lastRestockedAt()).isNull();
    }

    @Test void stockPaginationAndSearchRunBeforeLoadingPhotos() {
        for (int i = 0; i < 45; i++) item(1, 7, String.format("Article %02d", i));
        item(1, 7, "100% coton");
        em.flush();
        var second = service.list(1L, ConsumablesOverviewService.View.stock, 7L, "", 1, 20);
        assertThat(second.totalElements()).isEqualTo(46); assertThat(second.rows()).hasSize(20);
        assertThat(second.rows().getFirst().name()).isEqualTo("Article 19");
        assertThat(service.list(1L, ConsumablesOverviewService.View.stock, null, "100%", 0, 20).rows()).hasSize(1);
        assertThat(service.list(1L, ConsumablesOverviewService.View.stock, null, "maison café", 0, 20).totalElements()).isEqualTo(46);
        assertThat(service.list(1L, ConsumablesOverviewService.View.stock, null, "villa", 99, 20).page()).isEqualTo(2);
        assertThat(service.list(1L, ConsumablesOverviewService.View.stock, null, "absent", 99, 20).rows()).isEmpty();
    }

    @Test void archivedOrderSurvivesItemEditsAndDeletion() {
        var item = item(1, 7, "Nouveau café");
        var s = suggestion(1, 7, "APPLIED", NOW.minusSeconds(60), item.getId());
        s.setActionParams("{\"stockItemId\":" + item.getId() + ",\"stockOrder\":{\"name\":\"Ancien café\",\"quantity\":8,\"unit\":\"boîtes\",\"supplierName\":\"Ancien fournisseur\",\"catalogKey\":\"coffee-capsules\"}}");
        em.remove(item); em.flush();
        var row = service.list(1L, ConsumablesOverviewService.View.ordered, null, "", 0, 20).rows().getFirst();
        assertThat(row.name()).isEqualTo("Ancien café"); assertThat(row.quantity()).isEqualTo(8);
        assertThat(row.supplierName()).isEqualTo("Ancien fournisseur"); assertThat(row.catalogKey()).isEqualTo("coffee-capsules");
        assertThat(row.stockItemId()).isNull();
    }

    @Test void invalidLegacyParamsAndInformationalAlertsStillRender() {
        var s = suggestion(1, 7, "PENDING", NOW.plusSeconds(60), null);
        s.setActionType(null); s.setActionParams("invalid-json"); em.flush();
        var row = service.list(1L, ConsumablesOverviewService.View.pending, null, "", 0, 20).rows().getFirst();
        assertThat(row.actionable()).isFalse(); assertThat(row.quantity()).isNull();
    }

    @Test void propertyFilterCannotEscapeTheTenant() {
        assertThatThrownBy(() -> service.list(1L, ConsumablesOverviewService.View.stock, 8L, "", 0, 20))
                .isInstanceOf(AccessDeniedException.class);
    }
}
