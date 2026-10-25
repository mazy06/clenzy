package com.clenzy.service;

import com.clenzy.integration.airbnb.service.AirbnbTokenEncryptionService;
import com.clenzy.integration.channel.service.CredentialEncryptionService;
import com.clenzy.util.BaitlySecretDiagnostics;
import org.jasypt.util.text.AES256TextEncryptor;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.util.ReflectionTestUtils;
import java.util.Base64;
import java.util.function.Function;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Uniquement des clés et jetons synthétiques ; aucun secret applicatif réel. */
class BaitlySecretConfidentialityTest {
    static final String KEY="baitly-test-key-only";
    static final String TOKEN="synthetic-secret-canary";

    RuntimeException privateFailure() {
        var failure=new IllegalStateException("token=private-message",new RuntimeException("password=private-cause"));
        failure.addSuppressed(new RuntimeException("email=private-suppressed@example.invalid"));return failure;
    }
    void assertPrivate(Throwable failure) {
        var rendered=new java.io.StringWriter();failure.printStackTrace(new java.io.PrintWriter(rendered));
        assertThat(rendered.toString()).doesNotContain("private-","example.invalid",TOKEN,KEY);
        assertThat(failure).hasNoCause();assertThat(failure.getSuppressed()).isEmpty();
    }

    @ParameterizedTest @EnumSource(BaitlySecretDiagnostics.Operation.class)
    void safeDiagnosticsKeepOnlyTechnicalLocations(BaitlySecretDiagnostics.Operation operation) {
        var original=privateFailure();var safe=BaitlySecretDiagnostics.failure(operation,original);
        assertPrivate(safe);assertThat(safe.getStackTrace()).containsExactly(original.getStackTrace());
    }

    @ParameterizedTest @ValueSource(strings={"GCMvprivate-header:payload","GCMv:payload","GCMv1","GCMv0:payload",
            "GCMv2147483648:payload","GCMv1:private-base64","GCMv1:","GCM:private-base64","private-jasypt-payload"})
    void corruptCiphertextNeverLeaksInputOrNestedLibraryErrors(String ciphertext) {
        var service=new TokenEncryptionService(KEY,1,"");
        assertThatThrownBy(() -> service.decrypt(ciphertext)).satisfies(this::assertPrivate);
    }

    @ParameterizedTest @ValueSource(strings={"tag","truncated","wrong-key"})
    void authenticationFailureNeverReturnsPlaintext(String scenario) {
        var service=new TokenEncryptionService(KEY,1,"");String encrypted=service.encrypt(TOKEN);
        byte[] bytes=Base64.getDecoder().decode(encrypted.substring("GCMv1:".length()));
        if(scenario.equals("tag"))bytes[bytes.length-1]^=1;
        if(scenario.equals("truncated"))bytes=java.util.Arrays.copyOf(bytes,20);
        String tampered="GCMv1:"+Base64.getEncoder().encodeToString(bytes);
        var reader=scenario.equals("wrong-key")?new TokenEncryptionService("other-synthetic-key",1,""):service;
        assertThatThrownBy(() -> reader.decrypt(tampered)).satisfies(this::assertPrivate);
    }

    @ParameterizedTest @ValueSource(strings={"shared-encrypt","shared-decrypt","airbnb-encrypt","airbnb-decrypt","channel-encrypt","channel-decrypt"})
    void privateLibraryFailuresAreAbsentFromLogsAndThrownException(String scenario) {
        Object service;Function<String,String> action;
        var broken=mock(AES256TextEncryptor.class);
        when(broken.encrypt(anyString())).thenThrow(privateFailure());when(broken.decrypt(anyString())).thenThrow(privateFailure());
        var codec=mock(com.clenzy.util.BaitlySecretValueCodec.class);
        when(codec.encrypt(anyString())).thenThrow(privateFailure());when(codec.decrypt(anyString())).thenThrow(privateFailure());
        if(scenario.startsWith("shared")) {
            var shared=new TokenEncryptionService(KEY,1,"");service=shared;
            if(scenario.endsWith("encrypt")) {
                var random=mock(java.security.SecureRandom.class);doThrow(privateFailure()).when(random).nextBytes(any(byte[].class));
                ReflectionTestUtils.setField(shared,"secureRandom",random);action=shared::encrypt;
            } else {ReflectionTestUtils.setField(shared,"legacyEncryptor",broken);action=shared::decrypt;}
        } else if(scenario.startsWith("airbnb")) {
            var airbnb=new AirbnbTokenEncryptionService(KEY);service=airbnb;
            ReflectionTestUtils.setField(airbnb,"encryptor",codec);action=scenario.endsWith("encrypt")?airbnb::encrypt:airbnb::decrypt;
        } else {
            var channel=new CredentialEncryptionService(KEY);service=channel;
            ReflectionTestUtils.setField(channel,"encryptor",codec);action=scenario.endsWith("encrypt")?channel::encrypt:channel::decrypt;
        }
        var logger=(ch.qos.logback.classic.Logger)org.slf4j.LoggerFactory.getLogger(service.getClass());
        var appender=new ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent>();
        appender.start();logger.addAppender(appender);
        try {
            assertThatThrownBy(() -> action.apply(TOKEN)).satisfies(this::assertPrivate);
            assertThat(appender.list).hasSize(1);
            var layout=new ch.qos.logback.classic.PatternLayout();layout.setContext(logger.getLoggerContext());
            layout.setPattern("%msg %ex");layout.start();
            assertThat(layout.doLayout(appender.list.getFirst())).doesNotContain("private-","example.invalid",TOKEN,KEY);layout.stop();
        } finally {logger.detachAppender(appender);appender.stop();}
    }

    @Test void supportedHistoricalFormatsAndReEncryptionRemainReadable() {
        var v1=new TokenEncryptionService(KEY,1,"");String versioned=v1.encrypt(TOKEN);
        String legacyGcm="GCM:"+versioned.substring("GCMv1:".length());
        var jasypt=new AES256TextEncryptor();jasypt.setPassword(KEY);String legacyJasypt=jasypt.encrypt(TOKEN);
        var v2=new TokenEncryptionService("baitly-new-test-key",2,KEY);
        assertThat(v2.decrypt(versioned)).isEqualTo(TOKEN);assertThat(v2.decrypt(legacyGcm)).isEqualTo(TOKEN);
        assertThat(v1.decrypt(legacyJasypt)).isEqualTo(TOKEN);
        assertThat(v2.decrypt(v2.reEncrypt(legacyGcm))).isEqualTo(TOKEN);
        assertThat(v1.decrypt(v1.reEncrypt(legacyJasypt))).isEqualTo(TOKEN);
        assertThat(new AirbnbTokenEncryptionService(KEY).decrypt(legacyJasypt)).isEqualTo(TOKEN);
        assertThat(new CredentialEncryptionService(KEY).decrypt(legacyJasypt)).isEqualTo(TOKEN);
    }

    @org.junit.jupiter.params.provider.ValueSource(ints={0,-1,1,2,Integer.MAX_VALUE})
    @ParameterizedTest void configuredVersionNamespaceIsPreserved(int version) {
        var service=new TokenEncryptionService(KEY,version,"");
        assertThat(service.decrypt(service.encrypt(TOKEN))).isEqualTo(TOKEN);
    }
}
