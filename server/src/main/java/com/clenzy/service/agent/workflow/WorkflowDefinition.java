package com.clenzy.service.agent.workflow;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;
import java.util.Map;

/**
 * Definition d'un workflow chargee depuis un fichier YAML.
 *
 * <p>Mini-DSL : un workflow est une suite ordonnee de {@link Step}, chaque step
 * affiche un prompt a l'user et collecte une reponse. Optionnellement un step
 * peut :
 * <ul>
 *   <li>Suggerer un tool tiers a appeler en cours d'etape ({@link Step#suggestTool}).</li>
 *   <li>Declarer une {@link Step#action} : nom d'un tool a invoquer en fin d'etape
 *       (le {@link WorkflowEngine} le retourne au LLM comme suggestion structuree).</li>
 * </ul>
 *
 * <p>Les classes utilisent Jackson YAML — champs publics + setters par defaut.
 * {@link JsonIgnoreProperties} sur chaque pour tolerer d'eventuelles cles
 * non-modelisees dans les YAML (forward-compatibility).</p>
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class WorkflowDefinition {

    /** Identifiant stable, doit matcher le nom du fichier (sans .yaml). */
    public String id;
    public String title;
    public String description;
    /** Duree estimee en minutes (purement informatif, expose au frontend). */
    public Integer estimatedDuration;
    public List<Step> steps;

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Step {
        public String id;
        public String title;
        /**
         * Prompt par defaut (legacy / fallback). Cf. {@link #prompts} pour la
         * version multilingue. Si les deux sont presents, {@link #prompts}
         * prend le pas dans la langue courante ; sinon, fallback sur ce champ.
         */
        public String prompt;
        /**
         * Prompts par code langue ISO ("fr", "en", "ar", ...). Si la langue de
         * l'AgentContext est presente, ce prompt est utilise. Sinon, fallback
         * "fr" puis {@link #prompt} legacy.
         */
        public Map<String, String> prompts;
        /**
         * Map nom-de-champ → type attendu. Types supportes :
         * {@code "string", "number", "boolean", "string[]"}.
         * Sert maintenant a la validation stricte des reponses utilisateur via
         * {@link WorkflowValidator}.
         */
        public Map<String, Object> expectsData;
        /** Tool a suggerer en cours d'etape (navigation, lookup, etc.). */
        public ToolReference suggestTool;
        /** Nom d'un tool a invoquer en fin d'etape (suggere au LLM via le payload). */
        public String action;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ToolReference {
        public String name;
        public Map<String, Object> args;
    }
}
