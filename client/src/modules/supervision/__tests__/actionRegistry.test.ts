import { describe, expect, it } from 'vitest';
import { ACTION_REGISTRY, consequencesOf, entryOf, familyOf, opensModal, type ModalFamily } from '../components/actionRegistry';

/**
 * Le registre décide seul quelle modale s'ouvre. Une entrée mal formée n'échoue
 * nulle part à l'exécution : la modale s'ouvrirait vide, ou une action
 * engageante garderait son geste direct sans que personne le voie.
 *
 * L'ancienne organisation — cinq prédicats sur trois listes et deux catalogues —
 * autorisait qu'un type appartienne à deux familles ; c'est arrivé. Ici, la
 * famille est un champ unique : l'ambiguïté n'est plus exprimable, et ces tests
 * ne portent plus que sur la complétude des entrées.
 */
describe('registre des actions', () => {
  it('couvre les 45 types : 43 d’origine, plus les 2 ajoutes', () => {
    expect(Object.keys(ACTION_REGISTRY)).toHaveLength(45);
  });

  it('declare les types a editeur SANS les router vers une modale generique', () => {
    // Leur entree existe pour le TEXTE — titre, verbe, consequences — que deux
    // emplacements feraient diverger. L'aiguillage, lui, les laisse a leur ecran.
    for (const type of ['PRICE_DROP', 'REVIEW_DRAFT_REPLY']) {
      expect(entryOf(type), type).not.toBeNull();
      expect(entryOf(type)!.editor, type).toBe(true);
      expect(opensModal(type), type).toBe(false);
    }
  });

  it('donne aux editeurs les consequences que les modales generiques affichent', () => {
    // L'ecran tarifaire montrait sa prevision de revenu, jamais la portee de
    // l'acte : quelles nuits changent, ce qui ne bouge pas, par ou revenir.
    expect(consequencesOf('PRICE_DROP').length).toBeGreaterThan(0);
    expect(consequencesOf('REVIEW_DRAFT_REPLY').length).toBeGreaterThan(0);
  });

  it('ignore un type inconnu plutôt que d’ouvrir une modale vide', () => {
    expect(familyOf('TYPE_INEXISTANT')).toBeNull();
    expect(familyOf(undefined)).toBeNull();
    expect(opensModal('')).toBe(false);
  });

  it('donne à chaque entrée un titre et un verbe', () => {
    for (const [type, entry] of Object.entries(ACTION_REGISTRY)) {
      expect(entry.titleFallback.trim(), type).not.toBe('');
      expect(entry.ctaFallback.trim(), type).not.toBe('');
    }
  });

  it('n’emploie jamais un verbe vague comme libellé d’engagement', () => {
    // « Confirmer » ne dit pas ce qui va se passer : le bouton nomme l'acte.
    for (const [type, entry] of Object.entries(ACTION_REGISTRY)) {
      expect(entry.ctaFallback.toLowerCase(), type).not.toBe('confirmer');
      expect(entry.ctaFallback.toLowerCase(), type).not.toBe('appliquer');
    }
  });

  it('associe à chaque famille les données dont sa modale a besoin', () => {
    for (const [type, entry] of Object.entries(ACTION_REGISTRY)) {
      // Les types à éditeur portent leurs champs dans leur propre écran : leur
      // entrée n'existe que pour le texte, elle n'a rien à décrire de plus.
      if (entry.editor) continue;
      if (entry.family === 'confirm') {
        expect(entry.confirm, `${type} : confirmation sans conséquences`).toBeDefined();
        expect(entry.confirm!.consequences.length, type).toBeGreaterThan(0);
      }
      if (entry.family === 'params') {
        expect(entry.params, `${type} : saisie sans champs`).toBeDefined();
        expect(entry.params!.fields.length, type).toBeGreaterThan(0);
      }
      // Choix et relecture tirent leur contenu du serveur : rien à déclarer ici.
    }
  });

  it('réserve le garde-fou saisi à ce qui ne se rattrape pas', () => {
    const irreversibles = Object.entries(ACTION_REGISTRY)
      .filter(([, e]) => e.confirm?.severity === 'irreversible')
      .map(([type]) => type)
      .sort();

    expect(irreversibles).toEqual(['FRAUD_BLOCK', 'GDPR_ERASE']);
  });

  it('n’annonce un montant recalculé que là où de l’argent bouge', () => {
    const recomputed = Object.entries(ACTION_REGISTRY)
      .filter(([, e]) => e.confirm?.amountIsRecomputed)
      .map(([type]) => type)
      .sort();

    expect(recomputed).toEqual([
      'CLEANING_PAYOUT',
      'DEPOSIT_REFUND',
      'DEPOSIT_RELEASE',
      'DEPOSIT_WITHHOLD',
      'OWNER_PAYOUT',
    ]);
  });

  it('répartit les types sur les familles attendues', () => {
    const counts = Object.values(ACTION_REGISTRY).reduce<Record<string, number>>((acc, e) => {
      acc[e.family] = (acc[e.family] ?? 0) + 1;
      return acc;
    }, {});

    const expected: Record<ModalFamily, number> = {
      schedule: 2, choice: 4, params: 11, review: 12, confirm: 15, informative: 1,
    };
    for (const [family, n] of Object.entries(expected)) {
      expect(counts[family] ?? 0, family).toBe(n);
    }
  });
});
