package com.clenzy.model;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Resolution du canal de vente depuis un nom libre — nom de flux iCal saisi par
 * l'hote, ou OTA renvoyee par un channel manager.
 *
 * <p><b>Reference unique.</b> Cette resolution existait en trois exemplaires :
 * {@code ICalImportService.detectSource}, la table de mots-cles de
 * {@code BillingOverviewService}, et le repli d'affichage du tableau de bord.
 * Les trois connaissaient des canaux differents — d'ou du chiffre d'affaires
 * Vrbo range dans « Autre ».</p>
 *
 * <p>Le vocabulaire est volontairement restreint aux canaux qui ont un libelle,
 * une couleur et un logo de bout en bout. Ajouter une cle ici sans l'ajouter a
 * la couche d'affichage ferait apparaitre une valeur brute a l'ecran.</p>
 */
public final class ChannelSources {

    /** Repli : un canal non reconnu reste un canal, il n'est simplement pas nomme. */
    public static final String OTHER = "other";

    /**
     * Mots-cles reconnus dans un nom libre, dans l'ordre d'evaluation. Un flux
     * « Abritel » est un flux Vrbo : c'est la meme plateforme selon le pays.
     */
    private static final Map<String, String> KEYWORDS = new LinkedHashMap<>();
    static {
        KEYWORDS.put("airbnb", "airbnb");
        KEYWORDS.put("booking", "booking");
        KEYWORDS.put("vrbo", "vrbo");
        KEYWORDS.put("abritel", "vrbo");
        KEYWORDS.put("homeaway", "vrbo");
        KEYWORDS.put("expedia", "expedia");
        // Longue traine : ces canaux n'ont pas d'adapter dedie, ils arrivent par
        // un flux iCal que l'hote nomme lui-meme. Les nommer suffit a ce que leur
        // chiffre d'affaires cesse de tomber dans « Autre ».
        KEYWORDS.put("agoda", "agoda");
        KEYWORDS.put("hotels.com", "hotels_com");
        KEYWORDS.put("hotels com", "hotels_com");
        KEYWORDS.put("hometogo", "hometogo");
        KEYWORDS.put("mabeet", "mabeet");
        KEYWORDS.put("rentelly", "rentelly");
        KEYWORDS.put("gathern", "gathern");
        KEYWORDS.put("direct", "direct");
    }

    private ChannelSources() {
    }

    /**
     * Cle de canal deduite d'un nom libre, {@link #OTHER} si rien ne correspond.
     * Ne renvoie jamais {@code null} : une reservation vient toujours de quelque
     * part, meme innommable.
     */
    public static String fromName(String name) {
        if (name == null || name.isBlank()) {
            return OTHER;
        }
        final String lower = name.toLowerCase(Locale.ROOT);
        for (Map.Entry<String, String> keyword : KEYWORDS.entrySet()) {
            if (lower.contains(keyword.getKey())) {
                return keyword.getValue();
            }
        }
        return OTHER;
    }

    /**
     * Canaux qui masquent l'adresse du voyageur derriere un relais.
     *
     * <p>Propriete DISTINCTE de l'encaissement, meme si les deux ensembles
     * coincident aujourd'hui : un canal pourrait encaisser sans anonymiser, ou
     * l'inverse. Les confondre serait refaire l'erreur que ce chantier corrige —
     * deduire une information d'une autre parce qu'elles se ressemblent.</p>
     */
    private static final Set<String> ANONYMIZING = Set.of(
        "airbnb", "booking", "vrbo", "expedia",
        "agoda", "hotels_com", "hometogo", "mabeet", "rentelly", "gathern",
        "other", "channex");

    /**
     * Le canal masque-t-il l'email du voyageur ?
     *
     * <p>Determine le conseil donne a l'hote quand l'envoi automatique echoue :
     * « le canal ne l'expose pas, saisis-le » plutot que « tu as oublie de le
     * renseigner ». Vrbo et Expedia anonymisent aussi — l'interface promettait a
     * tort que la messagerie automatique fonctionnerait sur ces sejours.</p>
     */
    public static boolean anonymizesGuestEmail(String source) {
        if (source == null) {
            return false;
        }
        final String lower = source.toLowerCase(Locale.ROOT);
        // Un flux iCal, quel que soit son nom, passe par un relais.
        return ANONYMIZING.contains(lower) || lower.contains("ical");
    }
}
