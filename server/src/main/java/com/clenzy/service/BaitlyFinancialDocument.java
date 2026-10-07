package com.clenzy.service;

import java.security.MessageDigest;
import java.util.HexFormat;
import org.springframework.web.multipart.MultipartFile;

/** Justificatif figé ; jamais exécuté ni interprété comme une confirmation PSP. */
public record BaitlyFinancialDocument(byte[] bytes, String mime, String sha256) {
    public static BaitlyFinancialDocument read(MultipartFile file) {
        if (file == null || file.isEmpty() || file.getSize() > 5 * 1024 * 1024)
            throw new IllegalArgumentException("Un justificatif PDF, PNG ou JPEG de 5 Mo maximum est requis.");
        try { return checked(file.getBytes()); }
        catch (java.io.IOException e) { throw new IllegalArgumentException("Justificatif illisible.", e); }
    }
    public static BaitlyFinancialDocument checked(byte[] bytes) {
        if (bytes == null || bytes.length < 8 || bytes.length > 5 * 1024 * 1024)
            throw new IllegalArgumentException("Taille de justificatif invalide.");
        String mime = bytes[0]=='%' && bytes[1]=='P' && bytes[2]=='D' && bytes[3]=='F' && bytes[4]=='-' ? "application/pdf"
                : (bytes[0]&255)==137 && bytes[1]==80 && bytes[2]==78 && bytes[3]==71 && bytes[4]==13 && bytes[5]==10 && bytes[6]==26 && bytes[7]==10 ? "image/png"
                : (bytes[0]&255)==255 && (bytes[1]&255)==216 && (bytes[2]&255)==255 ? "image/jpeg" : null;
        if (mime == null) throw new IllegalArgumentException("Seuls les justificatifs PDF, PNG ou JPEG sont acceptés.");
        try { return new BaitlyFinancialDocument(bytes.clone(), mime, HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes))); }
        catch (java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
}
