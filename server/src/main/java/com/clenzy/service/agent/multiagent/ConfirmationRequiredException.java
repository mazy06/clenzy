package com.clenzy.service.agent.multiagent;

/**
 * Levée par un {@link AgentSpecialist} quand il tente d'invoquer un tool dont
 * le descripteur a {@code requiresConfirmation=true}.
 *
 * <p><b>Pourquoi</b> : le flow multi-agent (v1) n'implemente pas la pause
 * synchrone "demande de confirmation user → reprise apres confirm/refus" du
 * mono-agent. Plutot que d'executer un write tool sensible (block_calendar,
 * cancel_reservation, send_guest_message, etc.) SANS confirmation, on signale
 * a l'orchestrator d'ouverture que le multi-agent ne peut pas traiter ce tour
 * → fallback automatique sur le mono-agent qui gere correctement la pause.</p>
 *
 * <p><b>Securite</b> : cette exception est un mecanisme de defense — si elle
 * n'etait pas levee, un user pourrait declencher des actions destructives
 * (cancel reservation, archive property) en posant simplement une question
 * au multi-agent qui les invoquerait silencieusement.</p>
 *
 * <p>Cas de re-evaluation : implementer le flow confirmation natif dans le
 * multi-agent (v2) — necessite un protocole SSE bidirectionnel et un mecanisme
 * de pause-resume au niveau OrchestratorAgent.</p>
 */
public class ConfirmationRequiredException extends RuntimeException {

    private final String toolName;

    public ConfirmationRequiredException(String toolName) {
        super("Tool '" + toolName + "' requires user confirmation — fallback to mono-agent");
        this.toolName = toolName;
    }

    public String toolName() {
        return toolName;
    }
}
