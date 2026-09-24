package com.clenzy.config;

import org.junit.jupiter.api.Test;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.lang.reflect.Field;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Nettoyage de la liste d'origines CORS.
 *
 * <p>Chacun des cas couverts ici echoue SILENCIEUSEMENT en production : une
 * origine mal formee ne leve rien, elle ne correspond simplement jamais, et le
 * navigateur bloque sans qu'aucune trace serveur n'apparaisse.</p>
 */
class SecurityConfigProdCorsTest {

    private List<String> originsFor(String raw) throws Exception {
        SecurityConfigProd config = new SecurityConfigProd();
        Field field = SecurityConfigProd.class.getDeclaredField("allowedOrigins");
        field.setAccessible(true);
        field.set(config, raw);

        var source = (UrlBasedCorsConfigurationSource) config.corsConfigurationSource();
        CorsConfiguration cors = source.getCorsConfigurations().get("/**");
        return cors.getAllowedOrigins();
    }

    @Test
    void whenOriginsAreSeparatedBySpaces_thenTrimmedRatherThanSilentlyBroken() throws Exception {
        // Ecrire un espace apres la virgule est le reflexe naturel — et produisait
        // « https://b » precede d'un espace, qui ne vaut aucune origine.
        assertThat(originsFor("https://a.fr, https://b.fr ,  https://c.fr"))
                .containsExactly("https://a.fr", "https://b.fr", "https://c.fr");
    }

    @Test
    void whenAnOriginIsRepeated_thenKeptOnce() throws Exception {
        // La composition du compose peut repeter une origine : sans effet
        // fonctionnel, mais illisible au diagnostic.
        assertThat(originsFor("https://app.baitly.fr,https://baitly.fr,https://app.baitly.fr"))
                .containsExactly("https://app.baitly.fr", "https://baitly.fr");
    }

    @Test
    void whenAnEnvVariableWasNotSubstituted_thenTheEmptyOriginIsDropped() throws Exception {
        // `https://${SITE_DOMAIN}` avec une variable vide donne « https:// ».
        assertThat(originsFor("https://a.fr,https://,https://b.fr"))
                .containsExactly("https://a.fr", "https://b.fr");
        assertThat(originsFor("https://a.fr,,https://b.fr"))
                .containsExactly("https://a.fr", "https://b.fr");
        assertThat(originsFor("https://a.fr,http://,https://b.fr"))
                .containsExactly("https://a.fr", "https://b.fr");
    }

    @Test
    void whenTheListIsClean_thenOrderIsPreserved() throws Exception {
        // L'ordre declare est celui qu'on lit : la liste est parcourue jusqu'a
        // la premiere correspondance.
        assertThat(originsFor("https://app.baitly.fr,https://baitly.fr,https://www.baitly.fr"))
                .containsExactly("https://app.baitly.fr", "https://baitly.fr", "https://www.baitly.fr");
    }

    @Test
    void whenASingleOriginIsDeclared_thenItSurvives() throws Exception {
        assertThat(originsFor("https://app.clenzy.fr")).containsExactly("https://app.clenzy.fr");
    }
}
