package com.clenzy.tenant;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.EnableAspectJAutoProxy;
import org.springframework.stereotype.Service;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.junit.jupiter.SpringExtension;
import org.springframework.transaction.annotation.Transactional;


import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Verifie que {@link RlsTenantGucAspect} pose bien les GUC de tenant sur <b>toutes</b> les
 * methodes transactionnelles du code applicatif — y compris celles dont seule la
 * <b>classe</b> porte {@code @Transactional}.
 *
 * <h2>Pourquoi ce test existe</h2>
 * <p>Audit 2026-07, defaut R1 : le pointcut d'origine etait
 * {@code @annotation(Transactional) && within(com.clenzy..*)}. Or {@code @annotation()} ne
 * matche que les annotations portees par la <b>methode</b>. Le projet compte
 * <b>97 classes</b> annotees au niveau <b>classe</b> ({@code PublicBookingService},
 * {@code KpiService}, {@code ChannelConnectionService}…) : aucune de leurs methodes ne posait
 * de GUC.</p>
 *
 * <p>La consequence n'aurait pas ete une fuite mais un <b>outage</b> : sous RLS active, une
 * requete sans {@code app.current_org} renvoie 0 ligne (fail-closed). Le defaut serait donc
 * apparu au premier deploiement avec {@code clenzy.security.rls.enabled=true}, sur une part
 * majeure du produit d'un coup.</p>
 *
 * <p>Le test s'execute <b>sans base ni Docker</b> : l'{@link EntityManager} est mocke et on
 * verifie l'emission des {@code set_config}. Il tourne donc dans le build standard, et non
 * derriere le gate {@code CLENZY_IT} — c'est une protection permanente, pas une verification
 * ponctuelle avant activation.</p>
 */
@ExtendWith(SpringExtension.class)
@ContextConfiguration(classes = {
        RlsTenantGucAspect.class,
        TenantContext.class,
        RlsTenantGucAspectTest.MethodAnnotatedService.class,
        RlsTenantGucAspectTest.ClassAnnotatedService.class,
        RlsTenantGucAspectTest.PlainService.class})
@EnableAspectJAutoProxy
@TestPropertySource(properties = "clenzy.security.rls.enabled=true")
class RlsTenantGucAspectTest {

    private static final long ORG_ID = 4242L;

    @MockBean
    private EntityManager entityManager;

    @Autowired private TenantContext tenantContext;
    @Autowired private MethodAnnotatedService methodAnnotated;
    @Autowired private ClassAnnotatedService classAnnotated;
    @Autowired private PlainService plain;

    private void givenTenant() {
        // Le stub de Query doit etre entierement construit AVANT d'etre passe a when(...) :
        // un when() imbrique dans un when() corrompt l'etat de Mockito.
        Query query = org.mockito.Mockito.mock(Query.class);
        when(query.setParameter(anyString(), org.mockito.ArgumentMatchers.any())).thenReturn(query);
        when(query.getSingleResult()).thenReturn(1);

        when(entityManager.createNativeQuery(anyString())).thenReturn(query);
        tenantContext.setOrganizationId(ORG_ID);
    }

    @Test
    @DisplayName("@Transactional sur la METHODE : la GUC est posee")
    void methodLevelTransactional_appliesGuc() {
        givenTenant();

        methodAnnotated.doWork();

        verify(entityManager, atLeastOnce())
                .createNativeQuery(eq("select set_config('app.current_org', :org, true)"));
    }

    /**
     * Le cas qui echouait : 97 classes du projet sont dans cette configuration.
     */
    @Test
    @DisplayName("@Transactional sur la CLASSE : la GUC est posee aussi (defaut R1)")
    void classLevelTransactional_appliesGuc() {
        givenTenant();

        classAnnotated.doWork();

        verify(entityManager, atLeastOnce())
                .createNativeQuery(eq("select set_config('app.current_org', :org, true)"));
    }

    @Test
    @DisplayName("methode non transactionnelle : aucune GUC (pas d'overhead hors transaction)")
    void nonTransactionalMethod_appliesNoGuc() {
        givenTenant();

        plain.doWork();

        verify(entityManager, never()).createNativeQuery(anyString());
    }

    // ── Beans de test ────────────────────────────────────────────────────────

    /** Style « annotation sur la methode » — couvert par le pointcut d'origine. */
    @Service
    static class MethodAnnotatedService {
        @Transactional
        public void doWork() {
            // no-op : seule l'interception compte
        }
    }

    /** Style « annotation sur la classe » — 97 occurrences dans com.clenzy. */
    @Service
    @Transactional
    static class ClassAnnotatedService {
        public void doWork() {
            // no-op
        }
    }

    /** Ni l'un ni l'autre : ne doit declencher aucune GUC. */
    @Service
    static class PlainService {
        public void doWork() {
            // no-op
        }
    }
}
