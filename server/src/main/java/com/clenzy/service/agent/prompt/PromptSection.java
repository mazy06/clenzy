package com.clenzy.service.agent.prompt;

import java.util.Optional;

/**
 * Section atomique du system prompt.
 *
 * <p>Une section sait :
 * <ol>
 *   <li>se decider applicable ou non pour un {@link PromptContext} donne ({@link #appliesTo})</li>
 *   <li>se rendre en texte XML-tagged ({@link #render})</li>
 *   <li>declarer son {@link #order} (les sections sont composees triees ascendant)</li>
 * </ol>
 * </p>
 *
 * <p><b>SRP</b> : chaque section porte UNE responsabilite. Ajouter une section
 * = creer un nouveau {@code @Component} dans {@code prompt.sections}. Aucun
 * fichier existant ne doit etre modifie ({@code OCP}).</p>
 *
 * <p><b>Stateless mandatory</b> : les sections sont des singletons Spring partagés
 * entre threads. Aucune mutation interne, aucune dépendance vers des services
 * stateful (utiliser {@link PromptContext} pour les donnees).</p>
 *
 * <h3>Convention de rendu</h3>
 * <pre>
 * &lt;section_name&gt;
 * contenu en français, &eacute;chappe les &lt;tags&gt; XML utilisateur si necessaire
 * &lt;/section_name&gt;
 * </pre>
 *
 * <p>Le {@link SystemPromptComposer} insere une ligne vide entre chaque section
 * rendue (ne pas l'inclure soi-meme).</p>
 */
public interface PromptSection {

    /**
     * Identifiant stable pour le tracking / debug / metrics.
     * Format : {@code snake_case_short} (ex: "role", "memory", "anti_hallucination").
     */
    String name();

    /**
     * Ordre d'apparition dans le prompt final. Plus petit = plus haut.
     *
     * <p>Convention :</p>
     * <ul>
     *   <li>0-99 : identite (role, context)</li>
     *   <li>100-199 : regles globales (communication, output_format, anti_hallu)</li>
     *   <li>200-299 : contexte dynamique (memory, rag)</li>
     *   <li>300-399 : guides metier (tools_usage, examples, intent_detection)</li>
     *   <li>400+ : tasks specifiques (briefing_daily_task, etc.)</li>
     * </ul>
     */
    int order();

    /**
     * Decide si cette section doit etre rendue pour ce contexte. Defaut : true.
     *
     * <p>Sections statiques retournent typiquement {@code true} sans condition.
     * Sections dynamiques (memory, rag) verifient la presence de donnees.
     * Sections preset-specifiques verifient {@link PromptContext#preset()}.</p>
     */
    default boolean appliesTo(PromptContext context) {
        return true;
    }

    /**
     * Indique si le contenu de cette section est stable d'un tour a l'autre
     * (donc cacheable cote provider). Defaut : {@code true}.
     *
     * <p>Les sections dont le rendu depend de la requete courante (memoire,
     * RAG, contexte UI/date) retournent {@code false} : le composer les regroupe
     * en SUFFIXE volatil, place apres le prefixe stable, pour que seul ce dernier
     * porte le marqueur de cache Anthropic. Voir {@link ComposedSystemPrompt}.</p>
     */
    default boolean cacheable() {
        return true;
    }

    /**
     * Rend le contenu textuel de la section. Retourne {@link Optional#empty()}
     * si la section est techniquement applicable mais n'a rien a dire (ex:
     * memory section avec 0 entries → mieux vaut rien render que une section vide).
     *
     * <p>Le composer skip silencieusement les Optional.empty.</p>
     */
    Optional<String> render(PromptContext context);
}
