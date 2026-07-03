package com.clenzy.service;

import com.clenzy.AbstractIntegrationTest;
import com.clenzy.exception.CalendarConflictException;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests de concurrence du CalendarEngine.
 *
 * PAS de @Transactional au niveau classe : chaque thread doit gerer
 * sa propre transaction pour tester le comportement reel du pg_advisory_xact_lock.
 *
 * Les donnees sont creees dans des transactions committees via TransactionTemplate,
 * et nettoyees en @AfterEach.
 */
class CalendarEngineConcurrencyTest extends AbstractIntegrationTest {

    @Autowired
    private CalendarEngine calendarEngine;

    @Autowired
    private CalendarDayRepository calendarDayRepository;

    @Autowired
    private CalendarCommandRepository calendarCommandRepository;

    @Autowired
    private OutboxEventRepository outboxEventRepository;

    @Autowired
    private PropertyRepository propertyRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PlatformTransactionManager txManager;

    private TransactionTemplate txTemplate;

    private Organization org;
    private User owner;
    private Long orgId;

    // On stocke les IDs pour le nettoyage
    private final List<Long> propertyIds = new ArrayList<>();

    @BeforeEach
    void setUp() {
        txTemplate = new TransactionTemplate(txManager);
        setupTenantContext(null, true); // superAdmin

        // Creer org et owner dans une transaction committee
        txTemplate.executeWithoutResult(status -> {
            org = new Organization("Concurrency Org", OrganizationType.INDIVIDUAL, "concurrency-org");
            organizationRepository.save(org);
            orgId = org.getId();

            owner = new User("Marie", "Martin", "marie.conc@test.com", "password123");
            owner.setOrganizationId(orgId);
            owner.setKeycloakId("kc-conc-test");
            userRepository.save(owner);
        });

        setupTenantContext(orgId, true);
    }

    @AfterEach
    void cleanup() {
        txTemplate.executeWithoutResult(status -> {
            // Nettoyer dans l'ordre inverse des FK
            for (Long propId : propertyIds) {
                outboxEventRepository.findPendingEvents().stream()
                        .filter(e -> String.valueOf(propId).equals(e.getAggregateId()))
                        .forEach(e -> outboxEventRepository.deleteById(e.getId()));
                calendarCommandRepository.findByPropertyIdOrderByExecutedAtDesc(propId)
                        .forEach(c -> calendarCommandRepository.deleteById(c.getId()));
                calendarDayRepository.findByPropertyAndDateRange(
                                propId, LocalDate.of(2026, 1, 1), LocalDate.of(2028, 12, 31), orgId)
                        .forEach(d -> calendarDayRepository.deleteById(d.getId()));
                propertyRepository.deleteById(propId);
            }
            propertyIds.clear();
            userRepository.delete(owner);
            organizationRepository.delete(org);
        });
    }

    /**
     * Cree une propriete dans une transaction committee et l'ajoute a la liste de nettoyage.
     */
    private Property createPropertyCommitted(String name) {
        return txTemplate.execute(status -> {
            Property p = new Property(name, "42 rue Concurrent", 2, 1, owner);
            p.setOrganizationId(orgId);
            p.setNightlyPrice(new BigDecimal("80.00"));
            propertyRepository.save(p);
            propertyIds.add(p.getId());
            return p;
        });
    }

    // ----------------------------------------------------------------
    // 1. 10 threads tentent de book les memes dates → 1 seul reussit
    // ----------------------------------------------------------------

    @Test
    void concurrentBook_sameDates_onlyOneSucceeds() throws Exception {
        Property prop = createPropertyCommitted("Concurrent Same Dates");

        LocalDate checkIn = LocalDate.of(2027, 3, 1);
        LocalDate checkOut = LocalDate.of(2027, 3, 4);
        int threadCount = 10;

        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch latch = new CountDownLatch(1);
        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger conflictCount = new AtomicInteger(0);

        List<Future<?>> futures = new ArrayList<>();

        for (int i = 0; i < threadCount; i++) {
            final int threadIdx = i;
            futures.add(executor.submit(() -> {
                try {
                    latch.await(); // Attendre que tous les threads soient prets
                    setupTenantContext(orgId, true);

                    txTemplate.executeWithoutResult(status -> {
                        calendarEngine.book(prop.getId(), checkIn, checkOut, null,
                                orgId, "MANUAL", "thread-" + threadIdx);
                    });
                    successCount.incrementAndGet();
                } catch (CalendarConflictException e) {
                    conflictCount.incrementAndGet();
                } catch (Exception e) {
                    // Autres exceptions (lock, etc.) comptees comme conflits
                    conflictCount.incrementAndGet();
                }
            }));
        }

        latch.countDown(); // Lancer tous les threads simultanement
        executor.shutdown();
        assertTrue(executor.awaitTermination(30, TimeUnit.SECONDS));

        // Exactement 1 thread reussit, les autres echouent
        assertEquals(1, successCount.get(), "Exactement 1 reservation doit reussir");
        assertEquals(threadCount - 1, conflictCount.get(), "Tous les autres doivent echouer");
    }

    // ----------------------------------------------------------------
    // 2. 10 threads sur 10 proprietes differentes → tous reussissent
    // ----------------------------------------------------------------

    @Test
    void concurrentBook_differentProperties_allSucceed() throws Exception {
        int threadCount = 10;
        List<Property> properties = new ArrayList<>();
        for (int i = 0; i < threadCount; i++) {
            properties.add(createPropertyCommitted("Prop Concurrent " + i));
        }

        LocalDate checkIn = LocalDate.of(2027, 4, 1);
        LocalDate checkOut = LocalDate.of(2027, 4, 3);

        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch latch = new CountDownLatch(1);
        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger failureCount = new AtomicInteger(0);

        for (int i = 0; i < threadCount; i++) {
            final Property prop = properties.get(i);
            final int threadIdx = i;
            executor.submit(() -> {
                try {
                    latch.await();
                    setupTenantContext(orgId, true);

                    txTemplate.executeWithoutResult(status -> {
                        calendarEngine.book(prop.getId(), checkIn, checkOut, null,
                                orgId, "MANUAL", "thread-" + threadIdx);
                    });
                    successCount.incrementAndGet();
                } catch (Exception e) {
                    failureCount.incrementAndGet();
                }
            });
        }

        latch.countDown();
        executor.shutdown();
        assertTrue(executor.awaitTermination(30, TimeUnit.SECONDS));

        // Toutes les reservations sur des proprietes differentes doivent reussir
        assertEquals(threadCount, successCount.get(), "Tous les threads doivent reussir");
        assertEquals(0, failureCount.get(), "Aucun echec attendu");
    }

    // ----------------------------------------------------------------
    // 3. 5 book + 5 block sur les memes dates → exclusion mutuelle, pas de corruption
    // ----------------------------------------------------------------

    @Test
    void concurrentBookAndBlock_sameDates_mutualExclusion() throws Exception {
        Property prop = createPropertyCommitted("Concurrent Book+Block");

        LocalDate from = LocalDate.of(2027, 5, 1);
        LocalDate to = LocalDate.of(2027, 5, 4);
        int bookThreads = 5;
        int blockThreads = 5;
        int totalThreads = bookThreads + blockThreads;

        ExecutorService executor = Executors.newFixedThreadPool(totalThreads);
        CountDownLatch latch = new CountDownLatch(1);
        AtomicInteger bookSuccess = new AtomicInteger(0);
        AtomicInteger blockSuccess = new AtomicInteger(0);

        // 5 threads de booking
        for (int i = 0; i < bookThreads; i++) {
            final int idx = i;
            executor.submit(() -> {
                try {
                    latch.await();
                    setupTenantContext(orgId, true);
                    txTemplate.executeWithoutResult(status -> {
                        calendarEngine.book(prop.getId(), from, to, null,
                                orgId, "MANUAL", "book-" + idx);
                    });
                    bookSuccess.incrementAndGet();
                } catch (Exception ignored) {
                }
            });
        }

        // 5 threads de blocage
        for (int i = 0; i < blockThreads; i++) {
            final int idx = i;
            executor.submit(() -> {
                try {
                    latch.await();
                    setupTenantContext(orgId, true);
                    txTemplate.executeWithoutResult(status -> {
                        calendarEngine.block(prop.getId(), from, to, orgId,
                                "MANUAL", null, "block-" + idx);
                    });
                    blockSuccess.incrementAndGet();
                } catch (Exception ignored) {
                }
            });
        }

        latch.countDown();
        executor.shutdown();
        assertTrue(executor.awaitTermination(30, TimeUnit.SECONDS));

        // Exactement 1 operation reussit (soit book soit block)
        int totalSuccess = bookSuccess.get() + blockSuccess.get();
        assertEquals(1, totalSuccess,
                "Exactement 1 operation doit reussir (book=" + bookSuccess.get()
                        + ", block=" + blockSuccess.get() + ")");

        // Verifier qu'il n'y a pas de corruption : tous les jours ont le meme statut
        List<CalendarDay> days = txTemplate.execute(status ->
                calendarDayRepository.findByPropertyAndDateRange(
                        prop.getId(), from, to.minusDays(1), orgId));

        assertNotNull(days);
        assertEquals(3, days.size());

        CalendarDayStatus expectedStatus = bookSuccess.get() == 1
                ? CalendarDayStatus.BOOKED
                : CalendarDayStatus.BLOCKED;

        for (CalendarDay day : days) {
            assertEquals(expectedStatus, day.getStatus(),
                    "Tous les jours doivent avoir le meme statut : " + expectedStatus);
        }
    }
}
