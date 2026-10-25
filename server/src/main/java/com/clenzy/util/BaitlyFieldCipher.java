package com.clenzy.util;

import javax.crypto.Cipher;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.*;
import org.jasypt.encryption.pbe.PooledPBEStringEncryptor;
import org.jasypt.iv.RandomIvGenerator;

/** Versioned authenticated field encryption; legacy CBC is read with one pinned key only. */
public final class BaitlyFieldCipher {
    public static final String PREFIX="BTF1:";
    private final int version;
    private final Map<Integer,SecretKeySpec> keys;
    private final PooledPBEStringEncryptor legacy;
    private final SecureRandom random=new SecureRandom();
    public BaitlyFieldCipher(String password,int version,String previousPasswords,String legacyPassword) {
        if(password==null || password.isBlank() || version<1) throw unavailable();
        this.version=version;
        var ring=new HashMap<Integer,SecretKeySpec>(); ring.put(version,derive(password));
        if(previousPasswords!=null && !previousPasswords.isBlank()) {
            String[] previous=previousPasswords.split(",",-1);
            if(previous.length>=version) throw unavailable();
            for(int i=0;i<previous.length;i++) {
                if(previous[i].isBlank()) throw unavailable();
                ring.put(version-i-1,derive(previous[i].trim()));
            }
        }
        keys=Map.copyOf(ring);
        legacy=new PooledPBEStringEncryptor(); legacy.setAlgorithm("PBEWithHMACSHA512AndAES_256");
        legacy.setIvGenerator(new RandomIvGenerator());
        legacy.setPassword(legacyPassword==null || legacyPassword.isBlank()?password:legacyPassword);
        legacy.setPoolSize(Math.max(1,Math.min(4,Runtime.getRuntime().availableProcessors())));
    }
    public String encrypt(String value) {
        try {
            byte[] iv=new byte[12]; random.nextBytes(iv);
            String header=PREFIX+version+":";
            var cipher=Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE,keys.get(version),new GCMParameterSpec(128,iv));
            cipher.updateAAD(header.getBytes(StandardCharsets.US_ASCII));
            byte[] encrypted=cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
            byte[] result=Arrays.copyOf(iv,iv.length+encrypted.length);
            System.arraycopy(encrypted,0,result,iv.length,encrypted.length);
            return header+Base64.getEncoder().encodeToString(result);
        } catch(Exception failure) { throw unavailable(); }
    }
    public String decrypt(String value) {
        try {
            if(!isAuthenticated(value)) return legacy.decrypt(value);
            String[] parts=value.split(":",-1);
            if(parts.length!=3 || !"BTF1".equals(parts[0]) || !parts[1].matches("[1-9][0-9]{0,8}") || value.length()>1_048_576) throw unavailable();
            var key=keys.get(Integer.parseInt(parts[1])); if(key==null) throw unavailable();
            byte[] combined=Base64.getDecoder().decode(parts[2]); if(combined.length<28) throw unavailable();
            var cipher=Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE,key,new GCMParameterSpec(128,Arrays.copyOf(combined,12)));
            cipher.updateAAD((PREFIX+parts[1]+":").getBytes(StandardCharsets.US_ASCII));
            return new String(cipher.doFinal(combined,12,combined.length-12),StandardCharsets.UTF_8);
        } catch(Exception failure) { throw unavailable(); }
    }
    public static boolean isAuthenticated(String value) { return value!=null && value.startsWith("BTF"); }
    public boolean isCurrent(String value) { return value!=null && value.startsWith(PREFIX+version+":"); }
    public String encryptLegacy(String value) { try { return legacy.encrypt(value); } catch(Exception failure) { throw unavailable(); } }
    private static SecretKeySpec derive(String password) {
        var spec=new PBEKeySpec(password.toCharArray(),"Baitly/field-key/v1".getBytes(StandardCharsets.US_ASCII),210_000,256);
        try { return new SecretKeySpec(SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded(),"AES"); }
        catch(Exception failure) { throw unavailable(); } finally { spec.clearPassword(); }
    }
    private static IllegalStateException unavailable() { return new IllegalStateException("Baitly field encryption unavailable"); }
}
