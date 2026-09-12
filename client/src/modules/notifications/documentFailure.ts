/** Un tag qui n'a pas pu etre resolu dans un modele de document. */
export interface UnresolvedTag {
  /** Le tag tel qu'il figure dans le modele, ex. `${intervention.titre}`. */
  tag: string;
  /** Le groupe de donnees absent, ex. `intervention`. `null` si non precise. */
  group: string | null;
}

export interface DocumentFailure {
  /** Phrase d'entete, sans l'enumeration des tags. */
  summary: string;
  /** Modele mis en cause, quand le message le nomme. */
  template: string | null;
  tags: UnresolvedTag[];
}

/**
 * Lit un motif d'echec de generation.
 *
 * <p>Le message est NOTRE propre chaine, assemblee par le generateur :
 * « Le template 'X' contient 27 tag(s) non resolus. Tags manquants :
 * ${a} (groupe 'g' absent) | ${b} (groupe 'g' absent) | … ». Ce n'est pas de la
 * prose libre mais une liste construite, avec un separateur et une forme
 * stables — et c'est la seule ou elle existe : la colonne `error_message` ne
 * garde qu'un texte.</p>
 *
 * <p>La lecture est donc TOLERANTE : ce qui ne correspond pas ressort dans
 * `summary` et s'affiche tel quel. Le jour ou le generateur reformule, la fiche
 * perd sa mise en forme — elle ne perd pas l'information.</p>
 */
export function readDocumentFailure(message: string | null | undefined): DocumentFailure | null {
  const text = message?.trim();
  if (!text) return null;

  const template = /template\s+'([^']+)'/i.exec(text)?.[1] ?? null;

  const marker = /tags?\s+manquants?\s*:/i.exec(text);
  if (!marker) return { summary: text, template, tags: [] };

  const summary = text.slice(0, marker.index).trim();
  const listing = text.slice(marker.index + marker[0].length);

  const tags = listing
    .split('|')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const tag = /\$\{[^}]+\}/.exec(entry)?.[0] ?? entry.replace(/\s*\(.*\)\s*$/, '').trim();
      const group = /groupe\s+'([^']+)'/i.exec(entry)?.[1] ?? null;
      return { tag, group };
    })
    // Un listing tronque finit par « … » : ce fragment n'est pas un tag.
    .filter((entry) => entry.tag && entry.tag !== '…' && entry.tag !== '...');

  return { summary: summary || text, template, tags };
}

/** Les tags groupes par donnee absente, dans l'ordre d'apparition. */
export function groupTags(tags: UnresolvedTag[]): { group: string | null; tags: string[] }[] {
  const order: (string | null)[] = [];
  const byGroup = new Map<string | null, string[]>();
  for (const { tag, group } of tags) {
    if (!byGroup.has(group)) {
      byGroup.set(group, []);
      order.push(group);
    }
    byGroup.get(group)!.push(tag);
  }
  return order.map((group) => ({ group, tags: byGroup.get(group)! }));
}
