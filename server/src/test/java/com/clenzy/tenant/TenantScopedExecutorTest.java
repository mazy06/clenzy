package com.clenzy.tenant;

import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.Filter;
import org.hibernate.Session;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.orm.jpa.EntityManagerHolder;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Tests for {@link TenantScopedExecutor} (Z2-EFFETS-02).
 *
 * Verifie que l'execution hors HTTP (schedulers, consumers) active bien le
 * filtre Hibernate organizationFilter sur la Session liee au thread, pose le
 * TenantContext, et nettoie TOUT (ThreadLocal + EntityManager) en finally.
 */
@ExtendWith(MockitoExtension.class)
class TenantScopedExecutorTest {

    private static final Long ORG_ID = 42L;

    @Mock
    private EntityManagerFactory entityManagerFactory;
    @Mock
    private EntityManager entityManager;
    @Mock
    private Session session;
    @Mock
    private Filter hibernateFilter;

    private TenantContext tenantContext;
    private TenantScopedExecutor executor;

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        executor = new TenantScopedExecutor(tenantContext, entityManagerFactory);

        lenient().when(entityManagerFactory.createEntityManager()).thenReturn(entityManager);
        lenient().when(entityManager.unwrap(Session.class)).thenReturn(session);
        lenient().when(entityManager.isOpen()).thenReturn(true);
        lenient().when(session.enableFilter(TenantScopedExecutor.ORGANIZATION_FILTER))
                .thenReturn(hibernateFilter);
        lenient().when(hibernateFilter.setParameter(anyString(), any())).thenReturn(hibernateFilter);
    }

    @AfterEach
    void tearDown() {
        // Securite test : purge le ThreadLocal et les resources liees au thread
        // (les threads JUnit sont reutilises entre tests).
        tenantContext.clear();
        if (TransactionSynchronizationManager.hasResource(entityManagerFactory)) {
            TransactionSynchronizationManager.unbindResource(entityManagerFactory);
        }
    }

    @Test
    void whenRunAsOrganization_thenHibernateFilterEnabledDuringAction() {
        // Arrange
        boolean[] filterEnabledDuringAction = {false};
        Long[] orgIdDuringAction = {null};

        // Act
        executor.runAsOrganization(ORG_ID, () -> {
            orgIdDuringAction[0] = tenantContext.getOrganizationId();
            // L'EntityManager doit etre lie au thread pour que les methodes
            // @Transactional reutilisent la MEME Session (et donc le filtre).
            filterEnabledDuringAction[0] =
                    TransactionSynchronizationManager.hasResource(entityManagerFactory);
        });

        // Assert
        assertEquals(ORG_ID, orgIdDuringAction[0]);
        assertTrue(filterEnabledDuringAction[0],
                "L'EntityManager doit etre lie au thread pendant l'action");
        verify(session).enableFilter(TenantScopedExecutor.ORGANIZATION_FILTER);
        verify(hibernateFilter).setParameter(TenantScopedExecutor.ORG_ID_PARAM, ORG_ID);
    }

    @Test
    void whenActionCompletes_thenContextAndEntityManagerCleanedUp() {
        // Act
        executor.runAsOrganization(ORG_ID, () -> { });

        // Assert : plus de contexte tenant ni de resource liee au thread
        assertNull(tenantContext.getOrganizationId());
        assertFalse(TransactionSynchronizationManager.hasResource(entityManagerFactory));
        verify(entityManager).close();
    }

    @Test
    void whenActionThrows_thenContextAndEntityManagerStillCleanedUp() {
        // Act
        RuntimeException thrown = assertThrows(RuntimeException.class, () ->
                executor.runAsOrganization(ORG_ID, () -> {
                    throw new RuntimeException("boom");
                }));

        // Assert : l'exception remonte ET le nettoyage a eu lieu (finally)
        assertEquals("boom", thrown.getMessage());
        assertNull(tenantContext.getOrganizationId());
        assertFalse(TransactionSynchronizationManager.hasResource(entityManagerFactory));
        verify(entityManager).close();
    }

    @Test
    void whenCallAsOrganization_thenReturnsActionValue() {
        // Act
        String result = executor.callAsOrganization(ORG_ID, () -> "ok");

        // Assert
        assertEquals("ok", result);
    }

    @Test
    void whenOrganizationIdIsNull_thenThrowsIllegalArgument() {
        assertThrows(IllegalArgumentException.class,
                () -> executor.runAsOrganization(null, () -> { }));
        verify(entityManagerFactory, never()).createEntityManager();
    }

    @Test
    void whenTenantContextAlreadySet_thenThrowsIllegalState() {
        // Arrange : un contexte tenant est deja pose sur le thread (appel imbrique)
        tenantContext.setOrganizationId(7L);

        // Act + Assert : fail-loud plutot que fuite silencieuse cross-tenant
        assertThrows(IllegalStateException.class,
                () -> executor.runAsOrganization(ORG_ID, () -> { }));
        verify(entityManagerFactory, never()).createEntityManager();
        // Le contexte preexistant n'est pas ecrase
        assertEquals(7L, tenantContext.getOrganizationId());
    }

    @Test
    void whenEntityManagerAlreadyBound_thenReusedAndFilterDisabledAfter() {
        // Arrange : un EntityManager est deja lie au thread (ex: transaction en cours)
        TransactionSynchronizationManager.bindResource(
                entityManagerFactory, new EntityManagerHolder(entityManager));
        try {
            // Act
            executor.runAsOrganization(ORG_ID, () -> { });

            // Assert : pas de nouvel EntityManager, filtre active puis desactive,
            // l'EntityManager preexistant n'est NI ferme NI delie.
            verify(entityManagerFactory, never()).createEntityManager();
            verify(session).enableFilter(TenantScopedExecutor.ORGANIZATION_FILTER);
            verify(session).disableFilter(TenantScopedExecutor.ORGANIZATION_FILTER);
            verify(entityManager, never()).close();
            assertTrue(TransactionSynchronizationManager.hasResource(entityManagerFactory));
        } finally {
            TransactionSynchronizationManager.unbindResource(entityManagerFactory);
        }
    }
}
