package com.clenzy.config.ai;

/**
 * Evenement publie par les providers IA quand un modele configure renvoie
 * 410 Gone (modele EOL chez le provider). Recu par
 * {@code AiModelDeprecationListener} qui notifie les SUPER_ADMIN.
 *
 * <p><b>Dedup</b> : le listener maintient un Set en memoire des modeles deja
 * notifies pour eviter de spammer les admins si 1000 users tapent l'erreur
 * simultanement. Le Set est reinitialise au redemarrage du serveur — accepte
 * car la notification est annuelle au pire (cycle de vie modele LLM).</p>
 *
 * @param providerLabel nom du provider qui a refuse le modele (ex: "nvidia")
 * @param modelId       identifiant du modele EOL (ex: "qwen/qwen2.5-coder-32b-instruct")
 * @param providerMessage message brut du provider (souvent contient la date EOL)
 */
public record AiModelDeprecatedEvent(
        String providerLabel,
        String modelId,
        String providerMessage
) {}
