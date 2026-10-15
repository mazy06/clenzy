package com.clenzy.marketplace.service;

/** Formats public identity without exposing the last name in public DTOs. */
public final class BaitlyPublicNames {
    private BaitlyPublicNames() {}
    public static String display(String name, boolean hideLastName) {
        if (name == null || !hideLastName) return name;
        String normalized=name.strip().replaceAll("(?U)\\s+", " ");
        int separator=normalized.lastIndexOf(' ');
        if (separator<0) return normalized;
        String last=normalized.substring(separator+1);
        return normalized.substring(0,separator)+" "+new String(Character.toChars(last.codePointAt(0))).toUpperCase(java.util.Locale.ROOT)+".";
    }
}
