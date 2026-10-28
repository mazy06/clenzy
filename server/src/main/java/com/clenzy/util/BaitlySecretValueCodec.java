package com.clenzy.util;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Shared rollout gate for converter and legacy secret readers that share database columns. */
@Component
public final class BaitlySecretValueCodec {
    private final BaitlyFieldCipher cipher;
    private final boolean authenticatedWrites;
    public BaitlySecretValueCodec(@Value("${jasypt.encryptor.password}") String password,
            @Value("${baitly.security.field-encryption.key-version:1}") int version,
            @Value("${baitly.security.field-encryption.previous-passwords:}") String previous,
            @Value("${baitly.security.field-encryption.legacy-password:}") String legacy,
            @Value("${baitly.security.field-encryption.authenticated-writes:false}") boolean enabled) {
        cipher=new BaitlyFieldCipher(password,version,previous,legacy);authenticatedWrites=enabled;
    }
    public String encrypt(String value) { return authenticatedWrites?cipher.encrypt(value):cipher.encryptLegacy(value); }
    public String decrypt(String value) { return cipher.decrypt(value); }
    public boolean current(String value) { return cipher.isCurrent(value); }
    /** Rewrap only after exact-source CAS; never interprets decryption failure as plaintext. */
    public String rewrap(String encrypted) {
        if(!authenticatedWrites) throw new IllegalStateException("Baitly authenticated writes disabled");
        String plain=decrypt(encrypted); String next=cipher.encrypt(plain);
        if(!plain.equals(cipher.decrypt(next))) throw new IllegalStateException("Baitly field encryption unavailable");
        return next;
    }
}
