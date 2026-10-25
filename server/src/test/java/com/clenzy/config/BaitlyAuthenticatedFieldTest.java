package com.clenzy.config;

import com.clenzy.util.BaitlyFieldCipher;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class BaitlyAuthenticatedFieldTest {
    private static final String KEY="synthetic-current-field-key";
    @Test void springWiresTheSameCodecAndTheExplicitBaitlyRolloutProperty() {
        try(var context=new org.springframework.context.annotation.AnnotationConfigApplicationContext()) {
            org.springframework.test.context.support.TestPropertySourceUtils.addInlinedPropertiesToEnvironment(context,
                "jasypt.encryptor.password="+KEY,"baitly.security.field-encryption.authenticated-writes=true");
            context.register(com.clenzy.util.BaitlySecretValueCodec.class,EncryptedFieldConverter.class,
                com.clenzy.integration.external.service.ApiKeyEncryptionService.class);
            context.refresh();
            var converter=context.getBean(EncryptedFieldConverter.class);
            var api=context.getBean(com.clenzy.integration.external.service.ApiKeyEncryptionService.class);
            String value=api.encrypt("synthetic-secret");assertThat(value).startsWith("BTF1:1:");
            assertThat(converter.convertToEntityAttribute(value)).isEqualTo("synthetic-secret");
            assertThat(converter.convertToDatabaseColumn("synthetic-secret")).startsWith("BTF1:1:");
        } finally { new EncryptedFieldConverter().setEncryptorPassword("test-encryption-password-for-unit-tests"); }
    }
    @Test void sharedColumnReadersAllAcceptAuthenticatedValuesAndLegacyValuesDuringRollout() {
        var codec=new com.clenzy.util.BaitlySecretValueCodec(KEY,1,"","",true);
        var api=new com.clenzy.integration.external.service.ApiKeyEncryptionService(codec);
        var channel=new com.clenzy.integration.channel.service.CredentialEncryptionService(codec);
        var airbnb=new com.clenzy.integration.airbnb.service.AirbnbTokenEncryptionService(codec);
        var tokens=new com.clenzy.service.TokenEncryptionService(KEY,1,"");tokens.configureFieldReader(codec);
        String encrypted=api.encrypt("synthetic-secret");
        assertThat(encrypted).startsWith("BTF1:1:");
        assertThat(channel.decrypt(encrypted)).isEqualTo("synthetic-secret");
        assertThat(airbnb.decrypt(encrypted)).isEqualTo("synthetic-secret");
        assertThat(tokens.decrypt(encrypted)).isEqualTo("synthetic-secret");
        assertThat(api.decrypt(channel.encrypt("synthetic-secret"))).isEqualTo("synthetic-secret");
        assertThat(channel.decrypt(new BaitlyFieldCipher(KEY,1,"","").encryptLegacy("synthetic-old"))).isEqualTo("synthetic-old");
    }
    @Test void authenticatedWritesHaveRandomNoncesAndReadLegacyWithoutChangingTheKey() {
        var reader=new BaitlyFieldCipher(KEY,1,"","");
        var legacy=new org.jasypt.util.text.AES256TextEncryptor(); legacy.setPassword(KEY);
        assertThat(reader.decrypt(legacy.encrypt("synthetic-private-value"))).isEqualTo("synthetic-private-value");
        String a=reader.encrypt("synthetic-private-value"),b=reader.encrypt("synthetic-private-value");
        assertThat(a).startsWith("BTF1:1:").isNotEqualTo(b).doesNotContain("synthetic-private");
        assertThat(reader.decrypt(a)).isEqualTo("synthetic-private-value");
    }
    @Test void wrongKeyTamperedHeaderNonceCipherAndTagAlwaysFailWithoutAPlaintextFallback() {
        var reader=new BaitlyFieldCipher(KEY,1,"",""); String value=reader.encrypt("synthetic-private");
        var wrong=new BaitlyFieldCipher("synthetic-wrong",1,"","");
        assertThatThrownBy(()->wrong.decrypt(value)).hasMessage("Baitly field encryption unavailable").hasNoCause();
        for(String invalid:new String[]{value.replace("BTF1:","BTF2:"),value.replace(":1:",":2:"),"BTF1:01:AA==","BTF1:1:AA=="})
            assertThatThrownBy(()->reader.decrypt(invalid)).hasMessage("Baitly field encryption unavailable").hasNoCause();
        for(int index:new int[]{0,12,27}) {
            var bytes=java.util.Base64.getDecoder().decode(value.split(":")[2]); bytes[index]^=1;
            String invalid="BTF1:1:"+java.util.Base64.getEncoder().encodeToString(bytes);
            assertThatThrownBy(()->reader.decrypt(invalid)).hasMessage("Baitly field encryption unavailable").hasNoCause();
        }
    }
    @Test void rotatedReaderUsesExactVersionAndPinnedLegacyKeyInsteadOfTryingCbcKeys() {
        var old=new BaitlyFieldCipher(KEY,1,"","");
        var rotated=new BaitlyFieldCipher("synthetic-new-key",2,KEY,KEY);
        assertThat(rotated.decrypt(old.encrypt("synthetic"))).isEqualTo("synthetic");
        assertThat(rotated.decrypt(old.encryptLegacy("synthetic"))).isEqualTo("synthetic");
        assertThat(rotated.encrypt("synthetic")).startsWith("BTF1:2:");
        assertThatThrownBy(()->old.decrypt(rotated.encrypt("synthetic"))).hasNoCause();
    }
    @Test void rolloutReadersRemainCompatibleThenExplicitFlagSwitchesWritesAndNeverToleratesBrokenGcm() {
        var converter=new EncryptedFieldConverter();
        try {
            converter.configure(KEY,1,"","",false);
            String legacy=converter.convertToDatabaseColumn("synthetic");
            converter.configure(KEY,1,"","",true);
            assertThat(converter.convertToEntityAttribute(legacy)).isEqualTo("synthetic");
            String authenticated=converter.convertToDatabaseColumn("synthetic");
            assertThat(authenticated).startsWith("BTF1:1:");
            converter.configure(KEY,1,"","",false); // Reader-only rollback still reads the new format.
            assertThat(converter.convertToEntityAttribute(authenticated)).isEqualTo("synthetic");
            converter.setFailOnDecryptError(false);
            assertThatThrownBy(()->converter.convertToEntityAttribute("BTF1:1:broken"))
                .isInstanceOf(com.clenzy.exception.FieldDecryptionException.class).hasNoCause();
        } finally { converter.setFailOnDecryptError(true); converter.setEncryptorPassword("test-encryption-password-for-unit-tests"); }
    }
}
