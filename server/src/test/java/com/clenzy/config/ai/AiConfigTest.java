package com.clenzy.config.ai;

import com.clenzy.config.AiProperties;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifie le conditional behavior de {@link AiConfig} :
 * - Les beans RestClient sont crees quand {@code clenzy.ai.enabled=true}
 * - Les beans ne sont PAS crees quand {@code clenzy.ai.enabled=false}
 */
class AiConfigTest {

    @Test
    void restClientBeans_createdWhenAiEnabled() {
        new ApplicationContextRunner()
                .withUserConfiguration(AiConfig.class)
                .withBean(AiProperties.class, () -> {
                    AiProperties props = new AiProperties();
                    props.getOpenai().setApiKey("test-key");
                    props.getOpenai().setBaseUrl("https://api.openai.com/v1");
                    props.getAnthropic().setApiKey("test-key");
                    props.getAnthropic().setBaseUrl("https://api.anthropic.com/v1");
                    return props;
                })
                .withPropertyValues("clenzy.ai.enabled=true")
                .run(context -> {
                    assertThat(context).hasBean("openAiRestClient");
                    assertThat(context).hasBean("anthropicRestClient");
                    assertThat(context.getBean("openAiRestClient")).isInstanceOf(RestClient.class);
                    assertThat(context.getBean("anthropicRestClient")).isInstanceOf(RestClient.class);
                });
    }

    @Test
    void restClientBeans_notCreatedWhenAiDisabled() {
        new ApplicationContextRunner()
                .withUserConfiguration(AiConfig.class)
                .withBean(AiProperties.class, AiProperties::new)
                .withPropertyValues("clenzy.ai.enabled=false")
                .run(context -> {
                    assertThat(context).doesNotHaveBean("openAiRestClient");
                    assertThat(context).doesNotHaveBean("anthropicRestClient");
                });
    }

    @Test
    void restClientBeans_notCreatedWhenPropertyMissing() {
        new ApplicationContextRunner()
                .withUserConfiguration(AiConfig.class)
                .withBean(AiProperties.class, AiProperties::new)
                .run(context -> {
                    assertThat(context).doesNotHaveBean("openAiRestClient");
                    assertThat(context).doesNotHaveBean("anthropicRestClient");
                });
    }
}
