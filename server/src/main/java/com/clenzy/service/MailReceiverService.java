package com.clenzy.service;

import jakarta.mail.*;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMultipart;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Service de réception des emails via IMAP.
 * Lit les emails de la boîte info@clenzy.fr pour les afficher dans le PMS.
 *
 * Configuration via variables d'environnement :
 *   IMAP_HOST, IMAP_PORT, IMAP_USERNAME, IMAP_PASSWORD
 */
@Service
public class MailReceiverService {

    private static final Logger log = LoggerFactory.getLogger(MailReceiverService.class);

    @Value("${clenzy.imap.host:${IMAP_HOST:mail.clenzy.fr}}")
    private String imapHost;

    @Value("${clenzy.imap.port:${IMAP_PORT:993}}")
    private int imapPort;

    @Value("${clenzy.imap.username:${IMAP_USERNAME:info@clenzy.fr}}")
    private String imapUsername;

    @Value("${clenzy.imap.password:${IMAP_PASSWORD:}}")
    private String imapPassword;

    @Value("${clenzy.imap.enabled:${IMAP_ENABLED:false}}")
    private boolean imapEnabled;

    /**
     * Teste la connexion IMAP.
     */
    public boolean testConnection() {
        if (!imapEnabled || imapPassword == null || imapPassword.isBlank()) {
            return false;
        }
        try (Store store = connectStore()) {
            return store.isConnected();
        } catch (Exception e) {
            log.warn("Test connexion IMAP échoué : {}", e.getMessage());
            return false;
        }
    }

    /**
     * Liste les emails d'un dossier (INBOX par défaut), avec pagination.
     *
     * @param folderName nom du dossier (INBOX, Sent, etc.)
     * @param page       numéro de page (0-indexed)
     * @param size       nombre d'emails par page
     * @return map avec les emails et les métadonnées de pagination
     */
    public Map<String, Object> listEmails(String folderName, int page, int size) {
        if (!imapEnabled || imapPassword == null || imapPassword.isBlank()) {
            log.debug("IMAP désactivé ou non configuré");
            return Map.of("emails", List.of(), "total", 0, "page", page, "size", size);
        }

        Store store = null;
        Folder folder = null;
        try {
            store = connectStore();
            folder = store.getFolder(folderName != null ? folderName : "INBOX");
            folder.open(Folder.READ_ONLY);

            int totalMessages = folder.getMessageCount();
            if (totalMessages == 0) {
                return Map.of("emails", List.of(), "total", 0, "page", page, "size", size);
            }

            // IMAP numérote de 1 à N, les plus récents sont les derniers
            int end = totalMessages - (page * size);
            int start = Math.max(1, end - size + 1);

            if (end < 1) {
                return Map.of("emails", List.of(), "total", totalMessages, "page", page, "size", size);
            }

            Message[] messages = folder.getMessages(start, end);

            // Prefetch pour performance
            FetchProfile fp = new FetchProfile();
            fp.add(FetchProfile.Item.ENVELOPE);
            fp.add(FetchProfile.Item.FLAGS);
            folder.fetch(messages, fp);

            List<Map<String, Object>> emailList = new ArrayList<>();
            // Parcours inversé (plus récent en premier)
            for (int i = messages.length - 1; i >= 0; i--) {
                Message msg = messages[i];
                emailList.add(messageToMap(msg, false));
            }

            return Map.of(
                    "emails", emailList,
                    "total", totalMessages,
                    "page", page,
                    "size", size,
                    "totalPages", (int) Math.ceil((double) totalMessages / size)
            );
        } catch (Exception e) {
            log.error("Erreur lecture emails IMAP ({}): {}", folderName, e.getMessage());
            return Map.of("emails", List.of(), "total", 0, "page", page, "size", size, "error", e.getMessage());
        } finally {
            closeQuietly(folder, store);
        }
    }

    /**
     * Lit un email spécifique par son numéro de message.
     *
     * @param folderName nom du dossier
     * @param messageNum numéro du message (1-indexed)
     * @return détails de l'email avec le body
     */
    public Map<String, Object> getEmail(String folderName, int messageNum) {
        if (!imapEnabled || imapPassword == null || imapPassword.isBlank()) {
            return Map.of("error", "IMAP non configuré");
        }

        Store store = null;
        Folder folder = null;
        try {
            store = connectStore();
            folder = store.getFolder(folderName != null ? folderName : "INBOX");
            folder.open(Folder.READ_ONLY);

            if (messageNum < 1 || messageNum > folder.getMessageCount()) {
                return Map.of("error", "Message introuvable");
            }

            Message msg = folder.getMessage(messageNum);
            return messageToMap(msg, true);
        } catch (Exception e) {
            log.error("Erreur lecture email IMAP #{} ({}): {}", messageNum, folderName, e.getMessage());
            return Map.of("error", e.getMessage());
        } finally {
            closeQuietly(folder, store);
        }
    }

    /**
     * Liste les dossiers disponibles sur le serveur IMAP.
     */
    public List<Map<String, Object>> listFolders() {
        if (!imapEnabled || imapPassword == null || imapPassword.isBlank()) {
            return List.of();
        }

        Store store = null;
        try {
            store = connectStore();
            Folder[] folders = store.getDefaultFolder().list("*");
            List<Map<String, Object>> result = new ArrayList<>();
            for (Folder f : folders) {
                try {
                    Map<String, Object> folderInfo = new HashMap<>();
                    folderInfo.put("name", f.getFullName());
                    if ((f.getType() & Folder.HOLDS_MESSAGES) != 0) {
                        f.open(Folder.READ_ONLY);
                        folderInfo.put("messageCount", f.getMessageCount());
                        folderInfo.put("unreadCount", f.getUnreadMessageCount());
                        f.close(false);
                    }
                    result.add(folderInfo);
                } catch (Exception e) {
                    // Ignorer les dossiers inaccessibles
                }
            }
            return result;
        } catch (Exception e) {
            log.error("Erreur listing dossiers IMAP : {}", e.getMessage());
            return List.of();
        } finally {
            if (store != null) {
                try { store.close(); } catch (Exception ignored) {}
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // Helpers
    // ═══════════════════════════════════════════════════════════════

    private Store connectStore() throws MessagingException {
        Properties props = new Properties();
        props.put("mail.store.protocol", "imaps");
        props.put("mail.imaps.host", imapHost);
        props.put("mail.imaps.port", String.valueOf(imapPort));
        props.put("mail.imaps.ssl.enable", "true");
        props.put("mail.imaps.ssl.trust", imapHost);
        props.put("mail.imaps.timeout", "10000");
        props.put("mail.imaps.connectiontimeout", "10000");

        Session session = Session.getInstance(props);
        Store store = session.getStore("imaps");
        store.connect(imapHost, imapPort, imapUsername, imapPassword);
        return store;
    }

    private Map<String, Object> messageToMap(Message msg, boolean includeBody) {
        Map<String, Object> map = new HashMap<>();
        try {
            map.put("messageNumber", msg.getMessageNumber());
            map.put("subject", msg.getSubject());
            map.put("sentDate", msg.getSentDate() != null
                    ? msg.getSentDate().toInstant().atZone(ZoneId.of("Europe/Paris"))
                    .format(DateTimeFormatter.ISO_OFFSET_DATE_TIME)
                    : null);
            map.put("receivedDate", msg.getReceivedDate() != null
                    ? msg.getReceivedDate().toInstant().atZone(ZoneId.of("Europe/Paris"))
                    .format(DateTimeFormatter.ISO_OFFSET_DATE_TIME)
                    : null);

            // From
            Address[] from = msg.getFrom();
            if (from != null && from.length > 0) {
                InternetAddress addr = (InternetAddress) from[0];
                map.put("from", Map.of(
                        "email", addr.getAddress() != null ? addr.getAddress() : "",
                        "name", addr.getPersonal() != null ? addr.getPersonal() : ""
                ));
            }

            // To
            Address[] to = msg.getRecipients(Message.RecipientType.TO);
            if (to != null) {
                List<Map<String, String>> toList = new ArrayList<>();
                for (Address a : to) {
                    InternetAddress ia = (InternetAddress) a;
                    toList.add(Map.of(
                            "email", ia.getAddress() != null ? ia.getAddress() : "",
                            "name", ia.getPersonal() != null ? ia.getPersonal() : ""
                    ));
                }
                map.put("to", toList);
            }

            // Flags
            Flags flags = msg.getFlags();
            map.put("seen", flags.contains(Flags.Flag.SEEN));
            map.put("flagged", flags.contains(Flags.Flag.FLAGGED));
            map.put("answered", flags.contains(Flags.Flag.ANSWERED));

            // Body (si demandé)
            if (includeBody) {
                map.put("body", extractBody(msg));
                map.put("contentType", msg.getContentType());
            }
        } catch (Exception e) {
            map.put("error", "Erreur lecture message: " + e.getMessage());
        }
        return map;
    }

    private String extractBody(Message msg) throws MessagingException, IOException {
        Object content = msg.getContent();

        if (content instanceof String) {
            return (String) content;
        }

        if (content instanceof MimeMultipart multipart) {
            return extractFromMultipart(multipart);
        }

        return content != null ? content.toString() : "";
    }

    private String extractFromMultipart(MimeMultipart multipart) throws MessagingException, IOException {
        String htmlContent = null;
        String textContent = null;

        for (int i = 0; i < multipart.getCount(); i++) {
            BodyPart part = multipart.getBodyPart(i);
            String contentType = part.getContentType().toLowerCase();

            if (part.getContent() instanceof MimeMultipart nested) {
                String nestedResult = extractFromMultipart(nested);
                if (nestedResult != null && !nestedResult.isBlank()) {
                    if (contentType.contains("html")) {
                        htmlContent = nestedResult;
                    } else {
                        textContent = nestedResult;
                    }
                }
            } else if (contentType.contains("text/html")) {
                htmlContent = part.getContent().toString();
            } else if (contentType.contains("text/plain")) {
                textContent = part.getContent().toString();
            }
        }

        // Préférer HTML, sinon texte
        return htmlContent != null ? htmlContent : (textContent != null ? textContent : "");
    }

    private void closeQuietly(Folder folder, Store store) {
        if (folder != null && folder.isOpen()) {
            try { folder.close(false); } catch (Exception ignored) {}
        }
        if (store != null) {
            try { store.close(); } catch (Exception ignored) {}
        }
    }
}
