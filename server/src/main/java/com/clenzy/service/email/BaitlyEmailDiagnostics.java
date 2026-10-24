package com.clenzy.service.email;

/** Diagnostics bornes : aucun message, cause ou contenu fourni par le relais SMTP. */
public final class BaitlyEmailDiagnostics {
    private BaitlyEmailDiagnostics() { }

    public static String category(Throwable failure) {
        if (failure instanceof org.springframework.mail.MailAuthenticationException) return "SMTP_AUTHENTICATION";
        if (failure instanceof org.springframework.mail.MailSendException) return "SMTP_SEND";
        if (failure instanceof jakarta.mail.MessagingException) return "MESSAGE_PREPARATION";
        if (failure instanceof IllegalArgumentException) return "EMAIL_VALIDATION";
        if (failure instanceof IllegalStateException) return "EMAIL_CONFIGURATION";
        return "EMAIL_DELIVERY";
    }

    /** Conserve la categorie locale utile, sans transporter la chaine d'exception privee. */
    public static RuntimeException safeCause(Throwable failure) {
        String category = category(failure);
        if (failure instanceof IllegalArgumentException) return new IllegalArgumentException(category);
        if (failure instanceof IllegalStateException) return new IllegalStateException(category);
        return new RuntimeException(category);
    }
}
