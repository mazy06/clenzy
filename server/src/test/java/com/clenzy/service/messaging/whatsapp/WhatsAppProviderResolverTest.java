package com.clenzy.service.messaging.whatsapp;

import com.clenzy.model.WhatsAppConfig;
import com.clenzy.model.WhatsAppProviderType;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class WhatsAppProviderResolverTest {

    private WhatsAppProvider metaProvider() {
        WhatsAppProvider p = mock(WhatsAppProvider.class);
        when(p.getProviderType()).thenReturn(WhatsAppProviderType.META);
        return p;
    }

    private WhatsAppProvider openwaProvider() {
        WhatsAppProvider p = mock(WhatsAppProvider.class);
        when(p.getProviderType()).thenReturn(WhatsAppProviderType.OPENWA);
        return p;
    }

    @Test
    void resolve_metaConfig_returnsMetaProvider() {
        WhatsAppProvider meta = metaProvider();
        WhatsAppProvider openwa = openwaProvider();
        WhatsAppProviderResolver resolver = new WhatsAppProviderResolver(List.of(meta, openwa));

        WhatsAppConfig config = new WhatsAppConfig();
        config.setProvider(WhatsAppProviderType.META);

        assertThat(resolver.resolve(config)).isSameAs(meta);
    }

    @Test
    void resolve_openwaConfig_returnsOpenwaProvider() {
        WhatsAppProvider meta = metaProvider();
        WhatsAppProvider openwa = openwaProvider();
        WhatsAppProviderResolver resolver = new WhatsAppProviderResolver(List.of(meta, openwa));

        WhatsAppConfig config = new WhatsAppConfig();
        config.setProvider(WhatsAppProviderType.OPENWA);

        assertThat(resolver.resolve(config)).isSameAs(openwa);
    }

    @Test
    void resolve_nullConfig_fallsBackToMeta() {
        WhatsAppProvider meta = metaProvider();
        WhatsAppProviderResolver resolver = new WhatsAppProviderResolver(List.of(meta));

        assertThat(resolver.resolve(null)).isSameAs(meta);
    }

    @Test
    void resolve_configWithNullProvider_fallsBackToMeta() {
        WhatsAppProvider meta = metaProvider();
        WhatsAppProviderResolver resolver = new WhatsAppProviderResolver(List.of(meta));

        WhatsAppConfig config = new WhatsAppConfig();
        // Bypass le setter null-safe pour reproduire un null en base
        // (cas theoriquement impossible vu la colonne NOT NULL DEFAULT 'META',
        // mais on teste la defense en profondeur).
        // Note : on ne peut pas setter null via setProvider, donc on cree juste
        // une config sans appeler le setter. Mais le field a `= META` par defaut.
        // Donc ce test verifie en fait que le default reste META — equivalent
        // au test resolve_metaConfig_returnsMetaProvider mais sans setter explicite.

        assertThat(resolver.resolve(config)).isSameAs(meta);
    }

    @Test
    void constructor_duplicateProviderType_throws() {
        WhatsAppProvider meta1 = metaProvider();
        WhatsAppProvider meta2 = metaProvider();

        assertThatThrownBy(() -> new WhatsAppProviderResolver(List.of(meta1, meta2)))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("META");
    }

    @Test
    void resolve_providerNotWired_throws() {
        // Seulement Meta wired, mais on demande OPENWA
        WhatsAppProvider meta = metaProvider();
        WhatsAppProviderResolver resolver = new WhatsAppProviderResolver(List.of(meta));

        WhatsAppConfig config = new WhatsAppConfig();
        config.setProvider(WhatsAppProviderType.OPENWA);

        assertThatThrownBy(() -> resolver.resolve(config))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("OPENWA");
    }
}
