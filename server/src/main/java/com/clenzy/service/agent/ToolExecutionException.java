package com.clenzy.service.agent;

/**
 * Exception levee quand l'execution d'un tool echoue de maniere previsible
 * (argument invalide, ressource introuvable, permission refusee).
 *
 * <p>L'orchestrateur convertit cette exception en {@code tool_result} avec
 * {@code is_error: true} pour que le LLM puisse reagir intelligemment
 * (retry avec d'autres args, ou expliquer l'erreur a l'utilisateur).</p>
 *
 * <p>Les exceptions non previsibles (NullPointerException, etc.) doivent
 * remonter normalement et etre traitees comme des erreurs systeme.</p>
 */
public class ToolExecutionException extends RuntimeException {

    private final String toolName;

    public ToolExecutionException(String toolName, String message) {
        super("[tool:" + toolName + "] " + message);
        this.toolName = toolName;
    }

    public ToolExecutionException(String toolName, String message, Throwable cause) {
        super("[tool:" + toolName + "] " + message, cause);
        this.toolName = toolName;
    }

    public String getToolName() {
        return toolName;
    }
}
