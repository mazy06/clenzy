package com.clenzy.service.storage;

import com.clenzy.repository.PropertyPhotoRepository;
import com.clenzy.service.LocalPhotoStorageService;
import com.clenzy.service.PhotoStorageService;
import com.clenzy.service.access.OrganizationAccessGuard;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/**
 * Verifie le <b>cablage par flag</b> du {@link PhotoStorageService} — le point que le plan
 * d'offload exigeait et qui n'etait couvert par aucun test : les impls etaient testees
 * unitairement, mais rien ne garantissait <i>laquelle</i> Spring instancie selon
 * {@code clenzy.storage.photos}.
 *
 * <p>Enjeu concret : les deux impls sont {@code @Primary}. Si les conditions cessaient d'etre
 * mutuellement exclusives, le contexte leverait un {@code NoUniqueBeanDefinitionException} au
 * demarrage — en production, pas en CI. Et si la condition {@code object} etait mal ecrite, la
 * bascule serait silencieusement sans effet : on croirait ecrire sur S3 en continuant d'ecrire
 * en base.</p>
 *
 * <p>On utilise {@link ApplicationContextRunner} plutot qu'un {@code @SpringBootTest} : il evalue
 * reellement les {@code @ConditionalOnProperty} sans demarrer l'application.</p>
 */
class PhotoStorageWiringTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withUserConfiguration(StubDependencies.class, StorageImplementations.class);

    @Test
    @DisplayName("Sans flag : l'impl BYTEA est active, l'impl objet est absente")
    void byDefault_byteaImplementationIsActive() {
        runner.run(context -> {
            assertThat(context).hasSingleBean(PhotoStorageService.class);
            assertThat(context).hasSingleBean(LocalPhotoStorageService.class);
            assertThat(context).doesNotHaveBean(ObjectStoragePhotoService.class);
        });
    }

    @Test
    @DisplayName("clenzy.storage.photos=bytea : impl BYTEA active")
    void explicitBytea_byteaImplementationIsActive() {
        runner.withPropertyValues("clenzy.storage.photos=bytea").run(context -> {
            assertThat(context).hasSingleBean(PhotoStorageService.class);
            assertThat(context.getBean(PhotoStorageService.class))
                    .isInstanceOf(LocalPhotoStorageService.class);
        });
    }

    @Test
    @DisplayName("clenzy.storage.photos=object : impl objet active, BYTEA absente")
    void object_objectImplementationIsActive() {
        runner.withPropertyValues("clenzy.storage.photos=object").run(context -> {
            assertThat(context).hasSingleBean(PhotoStorageService.class);
            assertThat(context).hasSingleBean(ObjectStoragePhotoService.class);
            assertThat(context).doesNotHaveBean(LocalPhotoStorageService.class);
            assertThat(context.getBean(PhotoStorageService.class))
                    .isInstanceOf(ObjectStoragePhotoService.class);
        });
    }

    @Test
    @DisplayName("Les deux impls ne sont JAMAIS actives ensemble (deux @Primary = contexte casse)")
    void bothImplementationsAreNeverActiveTogether() {
        for (String value : new String[] {"bytea", "object", "BYTEA", "Object"}) {
            runner.withPropertyValues("clenzy.storage.photos=" + value).run(context ->
                    assertThat(context.getBeansOfType(PhotoStorageService.class)).hasSize(1));
        }
    }

    /**
     * Comportement <b>constate</b>, pas souhaite : une valeur de flag inconnue ne laisse AUCUNE
     * impl active. {@code matchIfMissing = true} ne couvre que l'absence de propriete, pas une
     * valeur explicite erronee.
     *
     * <p>En production, cela se traduit par un echec de demarrage (aucun candidat pour injecter
     * {@code PhotoStorageService}) — un echec bruyant, donc acceptable, mais tardif. Le piege est
     * reel : l'ancienne documentation mentionnait {@code clenzy.storage.type=s3}, et poser
     * {@code STORAGE_PHOTOS=s3} par mimetisme empeche le boot.</p>
     */
    @Test
    @DisplayName("Valeur inconnue : aucune impl active (le boot echouera, ce test documente le piege)")
    void unknownValue_yieldsNoImplementation() {
        runner.withPropertyValues("clenzy.storage.photos=s3").run(context ->
                assertThat(context.getBeansOfType(PhotoStorageService.class)).isEmpty());
    }

    @Configuration(proxyBeanMethods = false)
    @Import({LocalPhotoStorageService.class, ObjectStoragePhotoService.class})
    static class StorageImplementations {
    }

    @Configuration(proxyBeanMethods = false)
    static class StubDependencies {

        @Bean
        PropertyPhotoRepository propertyPhotoRepository() {
            return mock(PropertyPhotoRepository.class);
        }

        @Bean
        BinaryAssetStorage binaryAssetStorage() {
            return mock(BinaryAssetStorage.class);
        }

        @Bean
        ObjectStorageClient objectStorageClient() {
            return mock(ObjectStorageClient.class);
        }

        @Bean
        TenantContext tenantContext() {
            return new TenantContext();
        }

        @Bean
        OrganizationAccessGuard organizationAccessGuard(TenantContext tenantContext) {
            return new OrganizationAccessGuard(tenantContext);
        }
    }
}
