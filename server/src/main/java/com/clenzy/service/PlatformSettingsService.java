package com.clenzy.service;

import com.clenzy.model.PlatformSettings;
import com.clenzy.repository.PlatformSettingsRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.regex.Pattern;

/**
 * Accès aux réglages plateforme Baitly (singleton, id = 1).
 *
 * La ligne est seedée par la migration 0166. {@link #getOrDefault()} reste
 * défensif (retourne des valeurs par défaut si la ligne manque) pour ne jamais
 * casser un flux public comme la demande de devis.
 */
@Service
public class PlatformSettingsService {

    private final PlatformSettingsRepository repository;

    public PlatformSettingsService(PlatformSettingsRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public PlatformSettings getOrDefault() {
        return repository.findById(PlatformSettings.SINGLETON_ID)
                .orElseGet(PlatformSettings::new);
    }

    /** Les emails de devis aux prospects sont-ils activés ? (défaut : true). */
    @Transactional(readOnly = true)
    public boolean isSendProspectDevisEmails() {
        return getOrDefault().isSendProspectDevisEmails();
    }

    /** Les demandes de devis sont-elles versées dans la waitlist ? (défaut : true). */
    @Transactional(readOnly = true)
    public boolean isAddDevisLeadsToWaitlist() {
        return getOrDefault().isAddDevisLeadsToWaitlist();
    }

    /** Validation basique d'une adresse email. */
    private static final Pattern EMAIL =
            Pattern.compile("^[A-Za-z0-9._%+\\-]+@[A-Za-z0-9.\\-]+\\.[A-Za-z]{2,}$");

    /**
     * Destinataires des notifications internes (lead devis, copie devis, waitlist,
     * maintenance), liste nettoyée. L'expéditeur reste toujours info@clenzy.fr ;
     * c'est uniquement le(s) destinataire(s) qui est/sont paramétrable(s) ici.
     */
    @Transactional(readOnly = true)
    public List<String> getInternalNotificationEmails() {
        return parseCsv(getOrDefault().getInternalNotificationEmails());
    }

    @Transactional
    public PlatformSettings updateInternalNotificationEmails(List<String> emails, String updatedBy) {
        String csv = String.join(",", cleanEmails(emails));
        return update(s -> s.setInternalNotificationEmails(csv), updatedBy);
    }

    /** Découpe la valeur CSV stockée en liste d'emails trimés non vides et distincts. */
    private static List<String> parseCsv(String csv) {
        if (csv == null || csv.isBlank()) return List.of();
        return Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .distinct()
                .toList();
    }

    /**
     * Normalise une liste d'emails saisis : trim, suppression des vides, validation
     * du format, dédoublonnage. Les adresses invalides sont ignorées. Helper public
     * pour permettre au controller de rejeter une saisie sans aucun email valide.
     */
    public static List<String> cleanEmails(List<String> emails) {
        if (emails == null) return List.of();
        return emails.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .filter(s -> EMAIL.matcher(s).matches())
                .distinct()
                .toList();
    }

    /** Validation d'une adresse email isolée (helper public pour le controller). */
    public static boolean isValidEmail(String email) {
        return email != null && EMAIL.matcher(email.trim()).matches();
    }

    /**
     * Adresse d'expédition (From) configurée pour la plateforme. Niveau plateforme
     * uniquement. {@code null} si non renseignée (l'appelant retombe sur l'env).
     */
    @Transactional(readOnly = true)
    public String getSenderEmail() {
        String v = getOrDefault().getSenderEmail();
        return (v != null && !v.isBlank()) ? v.trim() : null;
    }

    /** Nom d'affichage du From. {@code null} si non renseigné. */
    @Transactional(readOnly = true)
    public String getSenderName() {
        String v = getOrDefault().getSenderName();
        return (v != null && !v.isBlank()) ? v.trim() : null;
    }

    /**
     * Met à jour l'adresse d'expédition plateforme (From) + son nom d'affichage.
     * L'email doit être valide (vérifié côté controller). Le nom vide retombe sur
     * « Baitly ».
     */
    @Transactional
    public PlatformSettings updateSender(String email, String name, String updatedBy) {
        String cleanEmail = email == null ? null : email.trim();
        String cleanName = (name == null || name.isBlank()) ? "Baitly" : name.trim();
        return update(s -> {
            s.setSenderEmail(cleanEmail);
            s.setSenderName(cleanName);
        }, updatedBy);
    }

    @Transactional
    public PlatformSettings updateSendProspectDevisEmails(boolean enabled, String updatedBy) {
        return update(s -> s.setSendProspectDevisEmails(enabled), updatedBy);
    }

    @Transactional
    public PlatformSettings updateAddDevisLeadsToWaitlist(boolean enabled, String updatedBy) {
        return update(s -> s.setAddDevisLeadsToWaitlist(enabled), updatedBy);
    }

    /**
     * Bibliothèque GLOBALE de widgets composites (JSON sérialisé, même format que
     * {@code booking_engine_configs.composite_widgets}). Lisible par tout utilisateur authentifié
     * (s'affiche dans chaque Studio) ; alimentée par les SUPER_ADMIN / SUPER_MANAGER.
     */
    @Transactional(readOnly = true)
    public String getGlobalCompositeWidgets() {
        String v = getOrDefault().getGlobalCompositeWidgets();
        return (v != null && !v.isBlank()) ? v : null;
    }

    @Transactional
    public PlatformSettings updateGlobalCompositeWidgets(String json, String updatedBy) {
        return update(s -> s.setGlobalCompositeWidgets(json), updatedBy);
    }

    // ── Concierge IA (masters plateforme, pilotés en base — hot-reload) ──────

    /** Le concierge IA rédige-t-il des brouillons ? (master plateforme, défaut false). */
    @Transactional(readOnly = true)
    public boolean isConciergeDraftEnabled() {
        return getOrDefault().isConciergeDraftEnabled();
    }

    /** L'auto-envoi concierge est-il ouvert au niveau plateforme ? (défaut false). */
    @Transactional(readOnly = true)
    public boolean isConciergeAutosendEnabled() {
        return getOrDefault().isConciergeAutosendEnabled();
    }

    /** Palier minimal (forfait) requis pour l'auto-envoi concierge — défaut « premium ». */
    @Transactional(readOnly = true)
    public String getConciergeAutosendMinForfait() {
        String v = getOrDefault().getConciergeAutosendMinForfait();
        return (v != null && !v.isBlank()) ? v.trim() : "premium";
    }

    /**
     * Met à jour les masters concierge (brouillon + auto-envoi + palier premium).
     * Un palier vide retombe sur « premium ». Piloté en base pour éviter tout redéploiement.
     */
    @Transactional
    public PlatformSettings updateConcierge(boolean draftEnabled, boolean autosendEnabled,
                                            String minForfait, String updatedBy) {
        final String forfait = (minForfait == null || minForfait.isBlank())
                ? "premium" : minForfait.trim().toLowerCase(Locale.ROOT);
        return update(s -> {
            s.setConciergeDraftEnabled(draftEnabled);
            s.setConciergeAutosendEnabled(autosendEnabled);
            s.setConciergeAutosendMinForfait(forfait);
        }, updatedBy);
    }

    private PlatformSettings update(java.util.function.Consumer<PlatformSettings> mutation, String updatedBy) {
        PlatformSettings settings = repository.findById(PlatformSettings.SINGLETON_ID)
                .orElseGet(() -> {
                    PlatformSettings fresh = new PlatformSettings();
                    fresh.setId(PlatformSettings.SINGLETON_ID);
                    return fresh;
                });
        mutation.accept(settings);
        settings.setUpdatedAt(LocalDateTime.now());
        settings.setUpdatedBy(updatedBy);
        return repository.save(settings);
    }
}
