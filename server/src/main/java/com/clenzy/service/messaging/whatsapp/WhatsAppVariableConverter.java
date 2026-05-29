package com.clenzy.service.messaging.whatsapp;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Convertit le format de variables editable {@code {guestFirstName}} (lisible
 * cote UI) vers le format positionnel Meta {@code {{1}}} requis pour l'envoi
 * via Cloud API, et reciproquement.
 *
 * <h3>Pourquoi cette conversion</h3>
 * <ul>
 *   <li><b>UI editable</b> : l'utilisateur edite "Bonjour {guestFirstName}, code
 *       {accessCode}" — c'est explicite et auto-documente.</li>
 *   <li><b>Meta Cloud API</b> : exige {@code {{1}}, {{2}}, ...} dans le template
 *       enregistre + une liste ordonnee de parametres a l'envoi. C'est imposé
 *       par leur format de validation des template_components.</li>
 *   <li><b>OpenWA / SMS</b> : envoi en texte brut, donc on interpole directement
 *       le format nomme sans passer par positionnel (geres par
 *       {@code TemplateInterpolationService}).</li>
 * </ul>
 *
 * <h3>Regles de conversion</h3>
 * <ol>
 *   <li>Pattern de variable : {@code \{[a-zA-Z][a-zA-Z0-9_]*\}} — commence par
 *       une lettre, contient lettres/chiffres/underscore. Pas d'espaces ni
 *       caracteres speciaux (refuse les {placeholder bizarre}).</li>
 *   <li>Premier scan : extrait l'ordre d'apparition des variables uniques.
 *       Chaque variable nommee se voit attribuer une position {@code N} a partir
 *       de 1, dans l'ordre de premiere apparition.</li>
 *   <li>Substitution : remplace TOUTES les occurrences de {@code {nomVar}} (y compris
 *       repetitions) par {@code {{N}}} ou N est la position assignee.</li>
 * </ol>
 *
 * <h3>Exemple</h3>
 * <pre>
 * Input  : "Bonjour {guestFirstName}, voici votre code : {accessCode}. {guestFirstName}, bon sejour !"
 * Output : ConversionResult(
 *     metaBody    = "Bonjour {{1}}, voici votre code : {{2}}. {{1}}, bon sejour !",
 *     orderedVars = ["guestFirstName", "accessCode"]
 * )
 * </pre>
 *
 * <h3>Cas d'erreur</h3>
 * <ul>
 *   <li>Nom de variable invalide ({@code {bad name}}, {@code {1var}}) : ignore — laisse
 *       le texte brut tel quel. Pas d'exception (l'utilisateur peut avoir tape
 *       un litteral entre accolades intentionnellement).</li>
 *   <li>Body null ou vide : retourne {@code ConversionResult("", [])}.</li>
 * </ul>
 *
 * <h3>Reversibilite</h3>
 * {@link #fromPositional} fait l'inverse : a partir d'un body positionnel +
 * mapping, reconstruit la version nommee. Utile pour migrer un template Meta
 * existant vers l'UI editable.
 */
@Component
public class WhatsAppVariableConverter {

    /**
     * Pattern pour une variable nommee : {@code {nomVar}} ou nomVar commence par
     * une lettre, contient lettres/chiffres/underscore. La group 1 capture le
     * nom de variable sans les accolades.
     */
    private static final Pattern NAMED_VAR_PATTERN = Pattern.compile("\\{([a-zA-Z][a-zA-Z0-9_]*)\\}");

    /**
     * Pattern pour une variable positionnelle : {@code {{1}}, {{42}}, ...}.
     * Capture la position en groupe 1.
     */
    private static final Pattern POSITIONAL_VAR_PATTERN = Pattern.compile("\\{\\{(\\d+)\\}\\}");

    /**
     * Convertit le body nomme vers le format positionnel Meta + retourne la liste
     * ordonnee des variables (= mapping position → nom).
     *
     * @param bodyNamed body au format {@code {nomVar}}. Peut etre null ou vide.
     * @return resultat de conversion (metaBody + orderedVars)
     */
    public ConversionResult toPositional(String bodyNamed) {
        if (bodyNamed == null || bodyNamed.isEmpty()) {
            return new ConversionResult("", List.of());
        }

        // Premier passage : detecte l'ordre d'apparition unique. LinkedHashMap
        // preserve l'ordre d'insertion (= ordre de premiere apparition de chaque
        // variable distincte). La valeur stocke la position 1-based assignee.
        Map<String, Integer> orderedVars = new LinkedHashMap<>();
        Matcher scan = NAMED_VAR_PATTERN.matcher(bodyNamed);
        while (scan.find()) {
            String varName = scan.group(1);
            orderedVars.computeIfAbsent(varName, k -> orderedVars.size() + 1);
        }

        // Deuxieme passage : substitue chaque occurrence. On reutilise le matcher
        // avec appendReplacement pour gerer correctement les caracteres speciaux
        // ($, \) que Matcher interprete dans replacement. Matcher.quoteReplacement
        // les neutralise.
        Matcher replacer = NAMED_VAR_PATTERN.matcher(bodyNamed);
        StringBuilder out = new StringBuilder(bodyNamed.length());
        while (replacer.find()) {
            String varName = replacer.group(1);
            Integer position = orderedVars.get(varName);
            String replacement = "{{" + position + "}}";
            replacer.appendReplacement(out, Matcher.quoteReplacement(replacement));
        }
        replacer.appendTail(out);

        return new ConversionResult(out.toString(), new ArrayList<>(orderedVars.keySet()));
    }

    /**
     * Conversion inverse : a partir d'un body positionnel ({@code "Hi {{1}}"}) et
     * d'une liste ordonnee de noms ({@code ["guestFirstName"]}), reconstruit la
     * version editable nommee ({@code "Hi {guestFirstName}"}).
     *
     * <p>Si une position dans le body n'a pas de correspondant dans la liste
     * (incoherence), elle est laissee telle quelle ({@code {{42}}}). Utile pour
     * que l'UI mette en evidence les references cassees plutot que de planter.</p>
     *
     * @param metaBody    body au format positionnel Meta
     * @param orderedVars liste ordonnee des noms de variables (index 0 = position 1)
     * @return body au format nomme
     */
    public String fromPositional(String metaBody, List<String> orderedVars) {
        if (metaBody == null || metaBody.isEmpty()) return "";
        if (orderedVars == null || orderedVars.isEmpty()) return metaBody;

        Matcher matcher = POSITIONAL_VAR_PATTERN.matcher(metaBody);
        StringBuilder out = new StringBuilder(metaBody.length());
        while (matcher.find()) {
            int position = Integer.parseInt(matcher.group(1));
            // positions 1-based, indexed 0-based
            int idx = position - 1;
            if (idx >= 0 && idx < orderedVars.size()) {
                String varName = orderedVars.get(idx);
                matcher.appendReplacement(out, Matcher.quoteReplacement("{" + varName + "}"));
            } else {
                // Position hors plage → garde le placeholder positionnel tel quel
                // (l'UI peut detecter et signaler "reference cassee").
                matcher.appendReplacement(out, Matcher.quoteReplacement(matcher.group(0)));
            }
        }
        matcher.appendTail(out);
        return out.toString();
    }

    /**
     * Extrait juste la liste ordonnee des variables nommees d'un body (sans faire
     * la conversion). Utile pour la preview cote frontend qui veut juste afficher
     * "Ce template utilise : guestFirstName, accessCode".
     *
     * @param bodyNamed body au format nomme
     * @return liste ordonnee (= ordre de premiere apparition) des variables uniques
     */
    public List<String> extractVariables(String bodyNamed) {
        if (bodyNamed == null || bodyNamed.isEmpty()) return List.of();
        Map<String, Integer> ordered = new LinkedHashMap<>();
        Matcher matcher = NAMED_VAR_PATTERN.matcher(bodyNamed);
        while (matcher.find()) {
            ordered.computeIfAbsent(matcher.group(1), k -> ordered.size() + 1);
        }
        return new ArrayList<>(ordered.keySet());
    }

    /**
     * Resultat de la conversion {@code {nom}} → {@code {{N}}}.
     *
     * @param metaBody    body au format positionnel Meta (pret a soumettre/envoyer)
     * @param orderedVars liste ordonnee des noms de variables (index 0 = position 1).
     *                    Necessaire pour la liste de parametres au moment de l'envoi
     *                    Meta : il faut envoyer les valeurs dans cet ordre.
     */
    public record ConversionResult(String metaBody, List<String> orderedVars) {}
}
