package com.clenzy.marketplace.service;

import com.clenzy.marketplace.dto.ProviderSearchCriteria;
import com.clenzy.marketplace.model.*;
import com.clenzy.marketplace.repository.MarketplaceProviderOfferRepository;
import com.clenzy.marketplace.repository.MarketplaceProviderRepository;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import org.springframework.data.jpa.repository.support.SimpleJpaRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;

/** Exécute Criteria et JPQL sur H2 et, sur demande, PostgreSQL ; hors migrations et RLS. */
class MarketplaceCatalogOfferQueryTest {
    @org.junit.jupiter.api.Test
    @org.junit.jupiter.api.condition.EnabledIfSystemProperty(named = "baitly.test.jdbc", matches = "jdbc:postgresql:.*")
    void effectivePmsWeekFiltersBeforePaginationAndCounting() throws Exception {
        withPostgres(config -> {
            String schema = config.getProperty("hibernate.default_schema");
            config.addAnnotatedClass(MarketplaceProvider.class).addAnnotatedClass(MarketplaceProviderOffer.class).addAnnotatedClass(com.clenzy.model.ProviderTariff.class)
                    .addAnnotatedClass(MarketplaceServiceCategory.class).addAnnotatedClass(MarketplaceServiceItem.class)
                    .addAnnotatedClass(MarketplaceProviderZone.class).addAnnotatedClass(MarketplaceProviderAvailability.class)
                    .setProperty("hibernate.hbm2ddl.auto", "create-drop");
            config.setStatementInspector(sql -> sql.replace("public.baitly_provider_available_on_day", schema + ".baitly_provider_available_on_day"));
            try (var sessions = config.buildSessionFactory(); var em = sessions.createEntityManager()) {
                em.getTransaction().begin();
                em.createNativeQuery("CREATE TABLE " + schema + ".teams (id bigint PRIMARY KEY, personal_user_id bigint)").executeUpdate();
                em.createNativeQuery("CREATE TABLE " + schema + ".team_weekly_availability (team_id bigint, day_of_week smallint, start_time time, end_time time)").executeUpdate();
                em.createNativeQuery("CREATE TABLE " + schema + ".team_absences (team_id bigint, start_date date, end_date date)").executeUpdate();
                for (String file : new String[]{"0444__team_declared_availability.sql", "0445__individual_declared_availability.sql", "0448__marketplace_effective_availability.sql"}) {
                    try {
                        String migration = java.nio.file.Files.readString(java.nio.file.Path.of("src/main/resources/db/changelog/changes", file)).replace("public", schema);
                        em.unwrap(org.hibernate.Session.class).doWork(c -> { try (var sql = c.createStatement()) { sql.execute(migration); } });
                    } catch (java.io.IOException failure) { throw new java.io.UncheckedIOException(failure); }
                }
                var ids = new java.util.ArrayList<Long>();
                for (int index = 0; index < 2; index++) {
                    var provider = new MarketplaceProvider(); provider.setDisplayName("Baitly horaires"); provider.setEmail("anon_week_" + index);
                    if (index == 0) provider.setUserId(11L);
                    em.persist(provider); ids.add(provider.getId());
                    var slot = new MarketplaceProviderAvailability(); slot.setProvider(provider); slot.setDayOfWeek((short) 1);
                    slot.setStartTime(java.time.LocalTime.of(9, 0)); slot.setEndTime(java.time.LocalTime.of(17, 0)); em.persist(slot);
                }
                em.createNativeQuery("INSERT INTO " + schema + ".teams VALUES (1,11)").executeUpdate();
                em.createNativeQuery("INSERT INTO " + schema + ".team_weekly_availability VALUES (1,2,'09:00','17:00')").executeUpdate();
                em.createNativeQuery("CREATE TABLE " + schema + ".team_members(team_id bigint, user_id bigint)").executeUpdate();
                em.createNativeQuery("CREATE TABLE " + schema + ".users (id bigint PRIMARY KEY)").executeUpdate();
                em.createNativeQuery("INSERT INTO " + schema + ".users VALUES (11)").executeUpdate();
                em.createNativeQuery("ALTER TABLE " + schema + ".team_absences ADD COLUMN reason varchar(200)").executeUpdate();
                try {
                    String migration = java.nio.file.Files.readString(java.nio.file.Path.of(
                        "src/main/resources/db/changelog/changes/0449__canonical_individual_calendar.sql")).replace("public", schema);
                    em.unwrap(org.hibernate.Session.class).doWork(c -> { try (var sql = c.createStatement()) { sql.execute(migration); } });
                } catch (java.io.IOException failure) { throw new java.io.UncheckedIOException(failure); }
                em.getTransaction().commit(); em.clear();
                var repository = new SimpleJpaRepository<MarketplaceProvider, Long>(MarketplaceProvider.class, em);
                for (short day = 1; day <= 2; day++) {
                    var criteria = new ProviderSearchCriteria(null, null, null, null, null, null, null, null,
                            null, false, null, false, null, null, day, "recent", 0, 1);
                    var result = repository.findAll(MarketplaceProviderSpecifications.from(criteria, LocalDate.now()), PageRequest.of(0, 1));
                    assertThat(result.getTotalElements()).isEqualTo(1);
                    assertThat(result.getContent().getFirst().getId()).isEqualTo(ids.get(day == 1 ? 1 : 0));
                }
            }
        });
    }
    @ParameterizedTest
    @ValueSource(strings = {"valid", "free-label", "inactive-offer", "inactive-category", "inactive-item", "inconsistent", "split-filters"})
    void filtersAndDisplayedOffersFollowCommercialEligibility(String scenario) {
        verifyQueries(new Configuration().setProperty("hibernate.connection.url", "jdbc:h2:mem:" + UUID.randomUUID()), scenario);
    }

    @org.junit.jupiter.api.condition.EnabledIfSystemProperty(named = "baitly.test.jdbc", matches = "jdbc:postgresql:.*")
    @ParameterizedTest
    @ValueSource(strings = {"valid", "free-label", "inactive-offer", "inactive-category", "inactive-item", "inconsistent", "split-filters"})
    void postgresFiltersAndCountsMatchCommercialEligibility(String scenario) throws Exception {
        withPostgres(config -> verifyQueries(config, scenario));
    }

    private void withPostgres(java.util.function.Consumer<Configuration> verification) throws Exception {
        String url = System.getProperty("baitly.test.jdbc");
        String user = System.getProperty("baitly.test.user", "postgres");
        String schema = "baitly_catalog_" + UUID.randomUUID().toString().replace("-", "");
        try (var connection = java.sql.DriverManager.getConnection(url, user, ""); var statement = connection.createStatement()) {
            statement.execute("CREATE SCHEMA " + schema);
            try {
                verification.accept(new Configuration().setProperty("hibernate.connection.url", url)
                    .setProperty("hibernate.connection.username", user)
                    .setProperty("hibernate.default_schema", schema));
            } finally {
                statement.execute("DROP SCHEMA " + schema + " CASCADE");
            }
        }
    }

    @org.junit.jupiter.api.Test
    void ratingSortKeepsUnratedProvidersLastAndPaginationStable() {
        verifyRatingSort(new Configuration().setProperty("hibernate.connection.url", "jdbc:h2:mem:" + UUID.randomUUID()));
    }

    @org.junit.jupiter.api.Test
    @org.junit.jupiter.api.condition.EnabledIfSystemProperty(named = "baitly.test.jdbc", matches = "jdbc:postgresql:.*")
    void postgresRatingSortKeepsUnratedProvidersLastAndPaginationStable() throws Exception {
        withPostgres(this::verifyRatingSort);
    }

    @org.junit.jupiter.api.Test
    void missingDocumentDatesRemainInTheNoAlertFilter() {
        var today = LocalDate.of(2026, 9, 16);
        var config = new Configuration().setProperty("hibernate.connection.url", "jdbc:h2:mem:" + UUID.randomUUID())
            .addAnnotatedClass(MarketplaceProvider.class).addAnnotatedClass(MarketplaceProviderOffer.class)
            .addAnnotatedClass(com.clenzy.model.ProviderTariff.class)
            .addAnnotatedClass(MarketplaceServiceCategory.class).addAnnotatedClass(MarketplaceServiceItem.class)
            .addAnnotatedClass(MarketplaceProviderZone.class).addAnnotatedClass(MarketplaceProviderAvailability.class)
            .setProperty("hibernate.hbm2ddl.auto", "create-drop");
        try (var sessions = config.buildSessionFactory(); var em = sessions.createEntityManager()) {
            em.getTransaction().begin();
            LocalDate[][] dates = {
                {null, null}, {today.minusDays(1), null}, {null, today.plusDays(1)},
                {today.plusDays(30), null}, {null, today.plusDays(31)},
                {today.plusDays(40), today.plusDays(50)}
            };
            for (int i = 0; i < dates.length; i++) {
                var provider = new MarketplaceProvider();
                provider.setDisplayName("Baitly document " + i); provider.setEmail("anon_document_" + i);
                provider.setInsuranceExpiresAt(dates[i][0]); provider.setVigilanceExpiresAt(dates[i][1]);
                em.persist(provider);
            }
            em.getTransaction().commit(); em.clear();
            var repository = new SimpleJpaRepository<MarketplaceProvider, Long>(MarketplaceProvider.class, em);
            for (boolean alert : List.of(false, true)) {
                var criteria = new ProviderSearchCriteria(null, null, null, null, null, null, null, null,
                    null, false, alert, false, null, null, null, "recent", 0, 1);
                var page = repository.findAll(MarketplaceProviderSpecifications.from(criteria, today), PageRequest.of(0, 1));
                assertThat(page.getTotalElements()).isEqualTo(alert ? 2 : 4);
                assertThat(page.getContent()).hasSize(1);
            }
        }
    }

    private void verifyRatingSort(Configuration config) {
        config.addAnnotatedClass(MarketplaceProvider.class).addAnnotatedClass(MarketplaceProviderOffer.class).addAnnotatedClass(com.clenzy.model.ProviderTariff.class)
            .addAnnotatedClass(MarketplaceServiceCategory.class).addAnnotatedClass(MarketplaceServiceItem.class)
            .addAnnotatedClass(MarketplaceProviderZone.class).addAnnotatedClass(MarketplaceProviderAvailability.class)
            .setProperty("hibernate.hbm2ddl.auto", "create-drop");
        try (var sessions = config.buildSessionFactory(); var em = sessions.createEntityManager()) {
            em.getTransaction().begin();
            var ids = new java.util.ArrayList<Long>();
            for (int index = 0; index < 3; index++) {
                var provider = new MarketplaceProvider(); provider.setDisplayName("Baitly tri");
                provider.setEmail("anon_sort_" + index);
                if (index > 0) provider.setRatingAvg(new java.math.BigDecimal("4.5"));
                em.persist(provider); ids.add(provider.getId());
            }
            em.getTransaction().commit(); em.clear();
            var criteria = new ProviderSearchCriteria(null, null, null, null, null, null, null, null,
                    null, false, null, false, null, null, null, "rating", 0, 1);
            var repository = new SimpleJpaRepository<MarketplaceProvider, Long>(MarketplaceProvider.class, em);
            var actual = new java.util.ArrayList<Long>();
            for (int page = 0; page < 3; page++) {
                var result = repository.findAll(MarketplaceProviderSpecifications.from(criteria, LocalDate.now()),
                        PageRequest.of(page, 1, MarketplaceCatalogService.sortOf("rating")));
                assertThat(result.getTotalElements()).isEqualTo(3);
                actual.add(result.getContent().getFirst().getId());
            }
            assertThat(actual).containsExactly(ids.get(2), ids.get(1), ids.get(0));
        }
    }

    private void verifyQueries(Configuration config, String scenario) {
        config.addAnnotatedClass(MarketplaceProvider.class).addAnnotatedClass(MarketplaceProviderOffer.class).addAnnotatedClass(com.clenzy.model.ProviderTariff.class)
            .addAnnotatedClass(MarketplaceServiceCategory.class).addAnnotatedClass(MarketplaceServiceItem.class)
            .addAnnotatedClass(MarketplaceProviderZone.class).addAnnotatedClass(MarketplaceProviderAvailability.class)
            .setProperty("hibernate.hbm2ddl.auto", "create-drop");
        try (var sessions = config.buildSessionFactory(); var em = sessions.createEntityManager()) {
            em.getTransaction().begin();
            var cleaning = category("CLEANING"); var maintenance = category("MAINTENANCE");
            em.persist(cleaning); em.persist(maintenance);
            var item = new MarketplaceServiceItem(); item.setCode("cleaning-turnover");
            item.setCategory(scenario.equals("inconsistent") ? maintenance : cleaning);
            item.setLabelFr("Ménage"); item.setLabelEn("Cleaning");
            if (scenario.equals("inactive-item")) item.setActive(false);
            em.persist(item);
            var provider = new MarketplaceProvider(); provider.setDisplayName("Baitly test");
            provider.setEmail("anon_catalog_test");
            var offer = offer(provider, cleaning, scenario.equals("free-label") ? null : item);
            if (scenario.equals("inactive-offer")) offer.setActive(false);
            if (scenario.equals("inactive-category")) cleaning.setActive(false);
            provider.getOffers().add(offer);
            if (scenario.equals("valid")) provider.getOffers().add(offer(provider, cleaning, item));
            if (scenario.equals("split-filters")) provider.getOffers().add(offer(provider, maintenance, null));
            em.persist(provider); em.getTransaction().commit(); em.clear();

            var providers = new SimpleJpaRepository<MarketplaceProvider, Long>(MarketplaceProvider.class, em);
            var offers = new JpaRepositoryFactory(em).getRepository(MarketplaceProviderOfferRepository.class);
            var facets = new JpaRepositoryFactory(em).getRepository(MarketplaceProviderRepository.class);
            String requestedCategory = scenario.equals("split-filters") ? "MAINTENANCE" : "CLEANING";
            var services = scenario.equals("free-label") ? List.<String>of() : List.of("cleaning-turnover");
            var criteria = new ProviderSearchCriteria(null, null, null, List.of(requestedCategory), services,
                null, null, null, null, false, null, false, null, null, null, null, 0, 1);
            var page = providers.findAll(MarketplaceProviderSpecifications.from(criteria, LocalDate.now()), PageRequest.of(0, 1));
            boolean eligible = scenario.equals("valid") || scenario.equals("free-label");
            assertThat(page.getTotalElements()).isEqualTo(eligible ? 1 : 0);
            assertThat(page.getContent()).hasSize(eligible ? 1 : 0);
            var displayed = offers.findActiveByProviderIds(List.of(provider.getId()));
            assertThat(displayed).hasSize(scenario.equals("split-filters") || scenario.equals("valid") ? 2 : eligible ? 1 : 0);
            // L'administration conserve les offres retirées pour diagnostic et correction.
            assertThat(offers.findAllByProviderIdWithCategory(provider.getId()))
                .hasSize(scenario.equals("split-filters") || scenario.equals("valid") ? 2 : 1);
            var categories = counts(facets.countProvidersByCategory());
            var servicesCounts = counts(facets.countProvidersByServiceItem());
            if (scenario.equals("split-filters")) {
                assertThat(categories).containsExactlyInAnyOrderEntriesOf(java.util.Map.of("CLEANING", 1L, "MAINTENANCE", 1L));
                assertThat(servicesCounts).containsExactlyInAnyOrderEntriesOf(java.util.Map.of("cleaning-turnover", 1L));
            } else if (eligible) {
                assertThat(categories).containsExactlyInAnyOrderEntriesOf(java.util.Map.of("CLEANING", 1L));
                assertThat(servicesCounts).containsExactlyInAnyOrderEntriesOf(scenario.equals("free-label")
                    ? java.util.Map.of() : java.util.Map.of("cleaning-turnover", 1L));
            } else {
                assertThat(categories).isEmpty();
                assertThat(servicesCounts).isEmpty();
            }
        }
    }

    private MarketplaceServiceCategory category(String code) {
        var category = new MarketplaceServiceCategory(); category.setCode(code);
        category.setLabelFr(code); category.setLabelEn(code); return category;
    }

    @ParameterizedTest
    @ValueSource(strings = {"base", "foreign-zone", "country-only", "split-zones", "wrong-country", "base-bypasses-department", "matching-department", "wrong-department"})
    void geographicFiltersMustMatchOneLocation(String scenario) {
        verifyGeography(new Configuration().setProperty("hibernate.connection.url", "jdbc:h2:mem:" + UUID.randomUUID()), scenario);
    }

    @org.junit.jupiter.api.condition.EnabledIfSystemProperty(named = "baitly.test.jdbc", matches = "jdbc:postgresql:.*")
    @ParameterizedTest
    @ValueSource(strings = {"base", "foreign-zone", "country-only", "split-zones", "wrong-country", "base-bypasses-department", "matching-department", "wrong-department"})
    void postgresGeographicFiltersMustMatchOneLocation(String scenario) throws Exception {
        withPostgres(config -> verifyGeography(config, scenario));
    }

    private void verifyGeography(Configuration config, String scenario) {
        config
            .addAnnotatedClass(MarketplaceProvider.class).addAnnotatedClass(MarketplaceProviderOffer.class).addAnnotatedClass(com.clenzy.model.ProviderTariff.class)
            .addAnnotatedClass(MarketplaceServiceCategory.class).addAnnotatedClass(MarketplaceServiceItem.class)
            .addAnnotatedClass(MarketplaceProviderZone.class).addAnnotatedClass(MarketplaceProviderAvailability.class)
            .setProperty("hibernate.hbm2ddl.auto", "create-drop");
        try (var sessions = config.buildSessionFactory(); var em = sessions.createEntityManager()) {
            em.getTransaction().begin();
            var provider = new MarketplaceProvider(); provider.setDisplayName("Baitly zones");
            provider.setEmail("anon_geo_test"); provider.setBaseCountryCode("MA"); provider.setBaseCity("Paris");
            String department = null;
            boolean expected = false;
            switch (scenario) {
                case "base" -> provider.setBaseCountryCode("FR");
                case "foreign-zone", "country-only" -> { zone(provider, "FR", "Paris", "75"); expected = true; }
                case "split-zones" -> { zone(provider, "FR", "Lyon", "69"); zone(provider, "MA", "Paris", null); }
                case "wrong-country" -> zone(provider, "MA", "Paris", "75");
                case "base-bypasses-department" -> { provider.setBaseCountryCode("FR"); department = "69"; }
                case "matching-department" -> { zone(provider, "FR", "Paris", "75"); department = "75"; expected = true; }
                case "wrong-department" -> { zone(provider, "FR", "Paris", "75"); department = "69"; }
            }
            em.persist(provider); em.getTransaction().commit(); em.clear();
            var criteria = new ProviderSearchCriteria(null, null, null, null, null,
                " fr ", department, scenario.equals("country-only") ? null : " PARIS ",
                null, false, null, false, null, null, null, null, 0, 1);
            var repository = new SimpleJpaRepository<MarketplaceProvider, Long>(MarketplaceProvider.class, em);
            var result = repository.findAll(MarketplaceProviderSpecifications.from(criteria, LocalDate.now()), PageRequest.of(0, 1));
            assertThat(result.getTotalElements()).isEqualTo(expected ? 1 : 0);
            assertThat(result.getContent()).hasSize(expected ? 1 : 0);
        }
    }

    private void zone(MarketplaceProvider provider, String country, String city, String department) {
        var zone = new MarketplaceProviderZone(); zone.setProvider(provider); zone.setCountryCode(country);
        zone.setCity(city); zone.setDepartment(department); provider.getZones().add(zone);
    }

    private java.util.Map<String, Long> counts(List<Object[]> rows) {
        return rows.stream().collect(java.util.stream.Collectors.toMap(
            row -> (String) row[0], row -> ((Number) row[1]).longValue()));
    }

    private MarketplaceProviderOffer offer(MarketplaceProvider provider, MarketplaceServiceCategory category, MarketplaceServiceItem item) {
        var offer = new MarketplaceProviderOffer(); offer.setProvider(provider); offer.setCategory(category);
        offer.setServiceItem(item); offer.setLabel("Prestation Baitly"); return offer;
    }
}
