package com.clenzy.tenant;

import org.junit.jupiter.api.extension.AfterEachCallback;
import org.junit.jupiter.api.extension.BeforeEachCallback;
import org.junit.jupiter.api.extension.ExtensionContext;

/**
 * JUnit 5 Extension qui clear le {@link TenantContext} ThreadLocal avant ET
 * apres chaque test, pour eliminer les fuites cross-tests via le pool de
 * threads surefire.
 *
 * <h2>Pourquoi cette extension est necessaire</h2>
 * <p>Depuis le commit {@code d1e14acc} (refactor {@link TenantContext} de
 * {@code @RequestScope} bean vers {@code ThreadLocal} static), l'etat
 * tenant (organizationId, superAdmin, systemOrg, etc.) survit entre les
 * tests si le test precedent ne fait pas {@code clear()} en tearDown.
 * Sur un pool de threads surefire, le meme thread est reutilise pour
 * plusieurs tests successifs.</p>
 *
 * <p>Symptome concret (PR #159) : un test qui appelait
 * {@code setSuperAdmin(true)} sans clear() final a fait echouer le test
 * suivant {@code CheckInInstructionsControllerTest#whenGet_notOwner_thenAccessDenied}
 * en CI uniquement (en local en isolation, le thread JUnit etait propre).</p>
 *
 * <h2>Comment l'utiliser</h2>
 * <p>Deux options :</p>
 *
 * <h3>Option A — Annotation explicite par classe de test</h3>
 * <pre>{@code
 * @ExtendWith({MockitoExtension.class, TenantContextExtension.class})
 * class MyServiceTest {
 *     // ...
 * }
 * }</pre>
 *
 * <h3>Option B — Activation globale via META-INF/services (auto-detected)</h3>
 * <p>Cette extension est aussi exposee via le SPI JUnit 5
 * {@code org.junit.jupiter.api.extension.Extension} dans
 * {@code src/test/resources/META-INF/services/}. Si {@code junit.jupiter.extensions.autodetection.enabled=true}
 * est dans {@code src/test/resources/junit-platform.properties}, elle
 * s'applique automatiquement a TOUS les tests sans annotation explicite.</p>
 *
 * <p><b>Choix par defaut</b> : Option B (auto-detection globale) pour ne
 * jamais oublier l'extension sur un nouveau test. Cf. {@code junit-platform.properties}.</p>
 *
 * <h2>Pourquoi pas un {@code @BeforeAll}/{@code @AfterAll}</h2>
 * <p>{@code @BeforeAll}/{@code @AfterAll} sont par classe, pas par methode.
 * On a besoin d'un reset par-test pour vraiment isoler chaque cas.</p>
 */
public class TenantContextExtension implements BeforeEachCallback, AfterEachCallback {

    /**
     * Instance partagee — TenantContext n'a pas d'etat d'instance (juste un
     * accesseur au ThreadLocal static), donc une seule instance suffit.
     */
    private static final TenantContext SHARED = new TenantContext();

    @Override
    public void beforeEach(ExtensionContext context) {
        SHARED.clear();
    }

    @Override
    public void afterEach(ExtensionContext context) {
        SHARED.clear();
    }
}
