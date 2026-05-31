package com.clenzy.controller;

import com.clenzy.model.PaymentProviderType;
import com.clenzy.model.PaymentTransaction;
import com.clenzy.payment.provider.CmiHashService;
import com.clenzy.payment.provider.CmiPaymentProvider;
import com.clenzy.payment.provider.CmiPaymentProvider.CmiCredentials;
import com.clenzy.repository.PaymentTransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CmiRedirectControllerTest {

    @Mock private PaymentTransactionRepository transactionRepository;
    @Mock private CmiPaymentProvider cmiProvider;
    @Mock private CmiHashService hashService;

    private CmiRedirectController controller;

    @BeforeEach
    void setUp() {
        controller = new CmiRedirectController(transactionRepository, cmiProvider);
    }

    private PaymentTransaction tx(String ref, PaymentProviderType type) {
        PaymentTransaction t = new PaymentTransaction();
        t.setOrganizationId(1L);
        t.setTransactionRef(ref);
        t.setProviderType(type);
        t.setAmount(new BigDecimal("250.50"));
        t.setCurrency("MAD");
        return t;
    }

    @Test
    void render_whenTxNotFound_404() {
        when(transactionRepository.findByTransactionRef("missing")).thenReturn(Optional.empty());

        ResponseEntity<String> response = controller.renderCmiRedirect("missing");
        assertThat(response.getStatusCode().value()).isEqualTo(404);
        assertThat(response.getBody()).contains("Transaction introuvable");
    }

    @Test
    void render_whenProviderNotCmi_400() {
        PaymentTransaction t = tx("ref-stripe", PaymentProviderType.STRIPE);
        when(transactionRepository.findByTransactionRef("ref-stripe")).thenReturn(Optional.of(t));

        ResponseEntity<String> response = controller.renderCmiRedirect("ref-stripe");
        assertThat(response.getStatusCode().value()).isEqualTo(400);
        assertThat(response.getBody()).contains("Provider invalide");
    }

    @Test
    void render_whenCredentialsLoadFails_500() {
        PaymentTransaction t = tx("ref-cmi", PaymentProviderType.CMI);
        when(transactionRepository.findByTransactionRef("ref-cmi")).thenReturn(Optional.of(t));
        when(cmiProvider.loadCredentials(1L)).thenThrow(new IllegalStateException("config missing"));

        ResponseEntity<String> response = controller.renderCmiRedirect("ref-cmi");
        assertThat(response.getStatusCode().value()).isEqualTo(500);
        assertThat(response.getBody()).contains("Configuration CMI incomplète");
    }

    @Test
    void render_whenSandbox_returnsTestUrl() {
        PaymentTransaction t = tx("ref-sandbox", PaymentProviderType.CMI);
        when(transactionRepository.findByTransactionRef("ref-sandbox")).thenReturn(Optional.of(t));

        CmiCredentials creds = new CmiCredentials("clientid-1", "store-key",
                "https://ok", "https://fail", "https://cb", true);
        when(cmiProvider.loadCredentials(1L)).thenReturn(creds);
        when(cmiProvider.hashService()).thenReturn(hashService);
        when(hashService.computeHash(any(), anyString())).thenReturn("HASH-VALUE");

        ResponseEntity<String> response = controller.renderCmiRedirect("ref-sandbox");

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        String body = response.getBody();
        assertThat(body).contains("testpayment.cmi.co.ma");
        assertThat(body).contains("HASH-VALUE");
        assertThat(body).contains("clientid-1");
        assertThat(body).contains("250.50");
    }

    @Test
    void render_whenProduction_returnsProdUrl() {
        PaymentTransaction t = tx("ref-prod", PaymentProviderType.CMI);
        when(transactionRepository.findByTransactionRef("ref-prod")).thenReturn(Optional.of(t));

        CmiCredentials creds = new CmiCredentials("clientid-2", "store-key",
                "https://ok", "https://fail", "https://cb", false);
        when(cmiProvider.loadCredentials(1L)).thenReturn(creds);
        when(cmiProvider.hashService()).thenReturn(hashService);
        when(hashService.computeHash(any(), anyString())).thenReturn("HASH-P");

        ResponseEntity<String> response = controller.renderCmiRedirect("ref-prod");

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).contains("payment.cmi.co.ma");
        assertThat(response.getBody()).doesNotContain("testpayment");
    }

    @Test
    void render_escapesHtmlInValues() {
        PaymentTransaction t = tx("ref-xss<>", PaymentProviderType.CMI);
        when(transactionRepository.findByTransactionRef("ref-xss<>")).thenReturn(Optional.of(t));

        CmiCredentials creds = new CmiCredentials("client<>id", "key",
                "https://ok", "https://fail", "https://cb", true);
        when(cmiProvider.loadCredentials(1L)).thenReturn(creds);
        when(cmiProvider.hashService()).thenReturn(hashService);
        when(hashService.computeHash(any(), anyString())).thenReturn("HASH");

        ResponseEntity<String> response = controller.renderCmiRedirect("ref-xss<>");
        String body = response.getBody();
        assertThat(body).doesNotContain("client<>id");
        assertThat(body).contains("client&lt;&gt;id");
    }
}
