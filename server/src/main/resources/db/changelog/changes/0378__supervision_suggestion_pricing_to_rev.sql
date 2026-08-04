-- Reprise des cartes yield émises sous le module orphelin « pricing » :
-- YieldRuleEngine écrivait ses suggestions HITL sous module_key = 'pricing',
-- hors du catalogue des agents (com/rev/ops/fin/rep) — agentId invalide côté
-- front et cartes absentes des rollups portefeuille. Le moteur émet désormais
-- sous 'rev' (agent Revenue) ; on aligne l'historique.
UPDATE supervision_suggestion SET module_key = 'rev' WHERE module_key = 'pricing';
