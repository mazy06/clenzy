-- Campagne multi-agent (X6, architecture de contexte B) : rolling summary.
-- Au-dela de la fenetre glissante (ContextBudget.MAX_HISTORY_MESSAGES), au lieu
-- d'elaguer sec les vieux messages, on injecte un resume structure compact du
-- debut de conversation. Il est persiste sur la conversation et regenere
-- paresseusement (petit modele) quand assez de messages sont sortis de la
-- fenetre — pas un appel LLM a chaque tour.

ALTER TABLE assistant_conversation
    ADD COLUMN rolling_summary TEXT,
    -- Nombre de messages (les plus anciens) couverts par le resume : sert de
    -- borne pour ne resumer QUE le nouveau hors-fenetre au prochain refresh.
    ADD COLUMN summary_covers_count INT NOT NULL DEFAULT 0;
