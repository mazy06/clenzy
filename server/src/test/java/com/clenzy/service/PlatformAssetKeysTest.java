package com.clenzy.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Cles des binaires sans organisation proprietaire.
 *
 * <p>La forme de la cle n'est pas cosmetique : c'est elle qui fait echouer
 * {@code assertReadableInCurrentOrg} sur un binaire plateforme presente par un
 * client. Un espace de noms libre permettrait de la contrefaire.</p>
 */
class PlatformAssetKeysTest {

    @Test
    void whenNamespaceIsValid_thenKeyIsPlatformScoped() {
        String key = PlatformAssetKeys.build("marketplace-applications");

        assertThat(key).startsWith("platform/marketplace-applications/");
        assertThat(key).doesNotStartWith("org/");
    }

    @Test
    void twoKeysNeverCollide() {
        assertThat(PlatformAssetKeys.build("marketplace-applications"))
            .isNotEqualTo(PlatformAssetKeys.build("marketplace-applications"));
    }

    @Test
    void whenNamespaceCouldForgeAnotherPrefix_thenItIsRefused() {
        // « org/1/photos » comme espace de noms produirait une cle relue comme
        // celle d'une organisation.
        assertThatThrownBy(() -> PlatformAssetKeys.build("org/1/photos"))
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> PlatformAssetKeys.build("../org/1"))
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> PlatformAssetKeys.build("Marketplace"))
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> PlatformAssetKeys.build(null))
            .isInstanceOf(IllegalArgumentException.class);
    }
}
