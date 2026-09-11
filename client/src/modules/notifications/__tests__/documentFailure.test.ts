import { describe, it, expect } from 'vitest';
import { readDocumentFailure, groupTags } from '../documentFailure';

/** Le message tel que le generateur l'ecrit, tronque comme en base. */
const REAL = "Le template 'Facture Clenzy' contient 27 tag(s) non resolus. "
  + "Tags manquants : ${intervention.id} (groupe 'intervention' absent) | "
  + "${intervention.titre} (groupe 'intervention' absent) | "
  + "${intervention.description} (groupe 'intervention' absent) | "
  + "${proprietaire.nom} (groupe 'proprietaire' absent)";

describe('readDocumentFailure — rendre lisible un echec de modele', () => {
  it('whenTheMessageListsTags_thenEachOneIsReadWithItsGroup', () => {
    const failure = readDocumentFailure(REAL)!;

    expect(failure.template).toBe('Facture Clenzy');
    expect(failure.summary).toBe("Le template 'Facture Clenzy' contient 27 tag(s) non resolus.");
    expect(failure.tags).toHaveLength(4);
    expect(failure.tags[0]).toEqual({ tag: '${intervention.id}', group: 'intervention' });
    expect(failure.tags[3]).toEqual({ tag: '${proprietaire.nom}', group: 'proprietaire' });
  });

  it('whenTagsShareAGroup_thenTheyAreGatheredUnderIt', () => {
    // Vingt-sept tags manquants ne sont presque jamais vingt-sept problemes.
    const groups = groupTags(readDocumentFailure(REAL)!.tags);

    expect(groups).toHaveLength(2);
    expect(groups[0].group).toBe('intervention');
    expect(groups[0].tags).toHaveLength(3);
    expect(groups[1].group).toBe('proprietaire');
  });

  it('whenTheListingIsTruncated_thenTheEllipsisIsNotReadAsATag', () => {
    // La colonne s'arrete a 500 caracteres et finit sur « … ».
    const failure = readDocumentFailure(
      "Tags manquants : ${a.b} (groupe 'a' absent) | ${a.c} (groupe 'a' absent) | …")!;

    expect(failure.tags.map((entry) => entry.tag)).toEqual(['${a.b}', '${a.c}']);
  });

  it('whenTheMessageIsNotAListing_thenItSurvivesWhole', () => {
    // Le jour ou le generateur reformule, la fiche perd sa mise en forme — pas
    // l'information.
    const failure = readDocumentFailure('Query requires transaction to be present')!;

    expect(failure.summary).toBe('Query requires transaction to be present');
    expect(failure.tags).toEqual([]);
    expect(failure.template).toBeNull();
  });

  it('whenThereIsNoMessage_thenNothingIsInvented', () => {
    expect(readDocumentFailure(null)).toBeNull();
    expect(readDocumentFailure('   ')).toBeNull();
  });
});
