package com.clenzy.service;

import com.clenzy.config.RestTemplateConfig;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class BaitlyPdfEngineContextTest {
    @Test
    void startsWithPartnerClientsAndUsesTheGeneralHttpClient() {
        new ApplicationContextRunner()
                .withUserConfiguration(RestTemplateConfig.class, BaitlyPdfEngine.class)
                .withBean(RestTemplateBuilder.class, RestTemplateBuilder::new)
                .withBean("channexRestTemplate", RestTemplate.class, RestTemplate::new)
                .withBean("cloudflareRestTemplate", RestTemplate.class, RestTemplate::new)
                .withPropertyValues("clenzy.libreoffice.url=http://pdf.test")
                .run(context -> {
                    assertThat(context).hasNotFailed().hasSingleBean(BaitlyPdfEngine.class);
                    var server = MockRestServiceServer.bindTo(
                            context.getBean("restTemplate", RestTemplate.class)).build();
                    server.expect(requestTo("http://pdf.test/health"))
                            .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));

                    assertThat(context.getBean(BaitlyPdfEngine.class).available()).isTrue();
                    server.verify();
                });
    }
}
