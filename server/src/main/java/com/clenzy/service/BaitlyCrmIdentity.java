package com.clenzy.service;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Locale;

/** Conservative matching, without provider aliases or guessed country codes. */
public final class BaitlyCrmIdentity {
    private BaitlyCrmIdentity() {}
    public static String email(String value) {
        String v=text(value,255);
        if(v==null) return null;
        if(!org.apache.commons.validator.routines.EmailValidator.getInstance().isValid(v)) throw new IllegalArgumentException("Adresse email invalide");
        return v.toLowerCase(Locale.ROOT);
    }
    public static String phone(String value) {
        String v=text(value,40);
        if(v==null) return null;
        if(!v.matches("[+0-9(). /-]+")) throw new IllegalArgumentException("Téléphone invalide");
        v=v.replaceAll("[^0-9]","");
        if(v.startsWith("00")) v=v.substring(2);
        if(v.length()<7 || v.length()>15) throw new IllegalArgumentException("Téléphone invalide");
        return v;
    }
    public static String text(String value,int max) {
        if(value==null || value.isBlank()) return null;
        String v=value.trim();
        if(v.length()>max) throw new IllegalArgumentException("Champ trop long (maximum "+max+")");
        return v;
    }
    public static String hash(String value) {
        if(value==null) return null;
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch(java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
}
