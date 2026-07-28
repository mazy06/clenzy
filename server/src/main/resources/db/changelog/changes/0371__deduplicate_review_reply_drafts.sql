-- Brouillons de réponse d'avis écrits en double.
--
-- ReviewReplyDraftService accumulait à la fois les fragments du flux LLM
-- (TextDelta) ET le fullText final de l'évènement Done — or fullText EST la
-- concaténation de ces fragments. Tout brouillon généré valait donc « X + X »,
-- recollé sans séparateur : « …prochain séjour !Merci beaucoup Sophie… ».
--
-- Le code est corrigé ; ce changeset répare ce qui a déjà été écrit, sans
-- repasser par le modèle (aucun crédit consommé, résultat déterministe).
--
-- Détection : avec n = moitié arrondie au supérieur, un texte dupliqué vérifie
-- « texte = première_moitié || rtrim(première_moitié) ». Le rtrim couvre le cas
-- où le .strip() appliqué à la concaténation a mangé le blanc final de la
-- seconde moitié (« ABC\nABC » et « ABCABC » sont tous deux reconnus).
--
-- Un texte légitime dont la première moitié égale la seconde n'existe pas en
-- pratique pour une réponse d'avis ; la condition reste volontairement stricte
-- plutôt que d'approximer. Les brouillons déjà publiés (host_response non nul)
-- sont laissés intacts : ils ne sont plus modifiables.

UPDATE guest_reviews
SET host_response_draft = rtrim(left(host_response_draft, (length(host_response_draft) + 1) / 2))
WHERE host_response_draft IS NOT NULL
  AND length(host_response_draft) > 1
  AND host_response IS NULL
  AND host_response_draft =
      left(host_response_draft, (length(host_response_draft) + 1) / 2)
      || rtrim(left(host_response_draft, (length(host_response_draft) + 1) / 2));
