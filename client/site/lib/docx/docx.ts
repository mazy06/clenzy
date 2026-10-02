import { createZip } from './zip';

/**
 * Générateur Word (.docx, WordprocessingML) minimal, côté navigateur.
 *
 * <p>Assez pour des documents éditoriaux de la landing : titres, paragraphes,
 * liens, listes à cases, tableaux clé/valeur, pied de page numéroté, et le
 * sens de lecture de droite à gauche pour l'arabe. Aucune donnée ne quitte le
 * navigateur.</p>
 */

export interface DocxRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  /** Couleur hexadécimale sans « # ». */
  color?: string;
  /** Taille en points. */
  size?: number;
  /** Lien externe : le run devient cliquable. */
  link?: string;
}

export type DocxBlock =
  | { kind: 'title'; text: string }
  | { kind: 'kicker'; text: string }
  | { kind: 'heading'; level: 1 | 2; runs: DocxRun[] }
  | { kind: 'paragraph'; runs: DocxRun[]; style?: 'muted' | 'note' | 'lead' }
  | { kind: 'check'; checked: boolean; runs: DocxRun[] }
  | { kind: 'numbered'; index: number; runs: DocxRun[] }
  | { kind: 'facts'; rows: readonly (readonly [string, string])[] }
  | { kind: 'rule' }
  | { kind: 'pageBreak' };

export interface DocxDocument {
  title: string;
  language: 'fr' | 'en' | 'ar';
  blocks: DocxBlock[];
  /** Texte du pied de page, suivi du numéro de page. */
  footer: string;
  pageLabel: string;
}

/** Teintes Baitly : bleu nuit, encre, gris d'accompagnement. */
const NAVY = '264672';
const INK = '15242D';
const MUTED = '5E6E78';
const LINE = 'D5DFE8';
const SOFT = 'EEF3F7';

/* Cases sans variante emoji. ☑ (U+2611) en a une : LibreOffice le dessine
   alors avec la police emoji couleur et l'étend au texte arabe qui suit (rendu
   en carrés vides), même avec le sélecteur de forme texte. ☒ et ☐ n'en ont pas. */
export const CHECKED = '\u2612';
export const UNCHECKED = '\u2610';

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export function buildDocx(doc: DocxDocument): Blob {
  const rtl = doc.language === 'ar';
  const links: string[] = [];
  const linkId = (url: string) => {
    let index = links.indexOf(url);
    if (index < 0) {
      links.push(url);
      index = links.length - 1;
    }
    return `rIdLink${index + 1}`;
  };

  const runProps = (run: Omit<DocxRun, 'text'>, extra = '') => {
    const props = [
      run.bold ? '<w:b/><w:bCs/>' : '',
      run.italic ? '<w:i/><w:iCs/>' : '',
      run.color ? `<w:color w:val="${run.color}"/>` : '',
      run.size ? `<w:sz w:val="${run.size * 2}"/><w:szCs w:val="${run.size * 2}"/>` : '',
      run.link ? '<w:u w:val="single"/>' : '',
      rtl ? '<w:rtl/>' : '',
      extra,
    ].join('');
    return props ? `<w:rPr>${props}</w:rPr>` : '';
  };
  const textRun = (run: DocxRun) =>
    `<w:r>${runProps({ ...run, color: run.link ? NAVY : run.color })}<w:t xml:space="preserve">${escapeXml(run.text)}</w:t></w:r>`;
  const runs = (list: DocxRun[]) =>
    list
      .map((run) =>
        run.link
          ? `<w:hyperlink r:id="${linkId(run.link)}" w:history="1">${textRun(run)}</w:hyperlink>`
          : textRun(run),
      )
      .join('');
  const paragraph = (content: string, props = '') =>
    `<w:p><w:pPr>${props}${rtl ? '<w:bidi/>' : ''}</w:pPr>${content}</w:p>`;

  const body = doc.blocks
    .map((block) => {
      switch (block.kind) {
        case 'title':
          return paragraph(runs([{ text: block.text }]), '<w:pStyle w:val="Title"/>');
        case 'kicker':
          return paragraph(runs([{ text: block.text }]), '<w:pStyle w:val="Kicker"/>');
        case 'heading':
          return paragraph(runs(block.runs), `<w:pStyle w:val="Heading${block.level}"/>`);
        case 'paragraph': {
          const style = block.style
            ? `<w:pStyle w:val="${block.style === 'muted' ? 'Muted' : block.style === 'note' ? 'Note' : 'Lead'}"/>`
            : '';
          return paragraph(runs(block.runs), style);
        }
        case 'check':
          return paragraph(
            runs([
              { text: block.checked ? `${CHECKED}  ` : `${UNCHECKED}  `, color: NAVY },
              ...block.runs,
            ]),
            '<w:pStyle w:val="CheckItem"/>',
          );
        case 'numbered':
          return paragraph(
            runs([{ text: `${block.index}.  `, color: NAVY, bold: true }, ...block.runs]),
            '<w:pStyle w:val="CheckItem"/>',
          );
        case 'facts':
          return factsTable(block.rows);
        case 'rule':
          return paragraph(
            '',
            `<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="${LINE}"/></w:pBdr><w:spacing w:before="120" w:after="240"/>`,
          );
        case 'pageBreak':
          return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
      }
    })
    .join('');

  function factsTable(rows: readonly (readonly [string, string])[]) {
    const cell = (text: string, bold: boolean, width: number, fill?: string) =>
      `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : ''}</w:tcPr>${paragraph(
        runs([{ text, bold, color: bold ? INK : MUTED, size: 9.5 }]),
        '<w:spacing w:before="40" w:after="40"/>',
      )}</w:tc>`;
    const border = `w:val="single" w:sz="4" w:color="${LINE}"`;
    return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/>${rtl ? '<w:bidiVisual/>' : ''}<w:tblBorders><w:top ${border}/><w:bottom ${border}/><w:insideH ${border}/></w:tblBorders><w:tblCellMar><w:left w:w="120" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="3000"/><w:gridCol w:w="6000"/></w:tblGrid>${rows
      .map(
        ([label, value]) =>
          `<w:tr>${cell(label, false, 3000, SOFT)}${cell(value, true, 6000)}</w:tr>`,
      )
      .join('')}</w:tbl>${paragraph('', '<w:spacing w:after="120"/>')}`;
  }

  const ns =
    'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  const page =
    '<w:sectPr><w:footerReference w:type="default" r:id="rIdFooter"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1300" w:right="1250" w:bottom="1300" w:left="1250" w:header="700" w:footer="600" w:gutter="0"/></w:sectPr>';
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${ns}><w:body>${body}${page}</w:body></w:document>`;

  const footerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ${ns}>${paragraph(
    `${runs([{ text: `${doc.footer}  ·  ${doc.pageLabel} `, color: MUTED, size: 8 }])}<w:r>${runProps({ color: MUTED, size: 8 })}<w:fldChar w:fldCharType="begin"/></w:r><w:r>${runProps({ color: MUTED, size: 8 })}<w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r>${runProps({ color: MUTED, size: 8 })}<w:fldChar w:fldCharType="separate"/></w:r><w:r>${runProps({ color: MUTED, size: 8 })}<w:t>1</w:t></w:r><w:r>${runProps({ color: MUTED, size: 8 })}<w:fldChar w:fldCharType="end"/></w:r>`,
    `<w:pBdr><w:top w:val="single" w:sz="4" w:space="6" w:color="${LINE}"/></w:pBdr>`,
  )}</w:ftr>`;

  const font = rtl ? 'Arial' : 'Calibri';
  const lang = { fr: 'fr-FR', en: 'en-GB', ar: 'ar-SA' }[doc.language];
  // Police explicite sur chaque style, écritures complexes comprises : les
  // styles de titre intégrés des traitements de texte portent leur propre
  // police CTL, parfois sans glyphes arabes (titres rendus en carrés vides).
  const fonts = `<w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="Arial" w:eastAsia="${font}"/>`;
  const style = (id: string, name: string, pPr: string, rPr: string) =>
    `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr>${pPr}</w:pPr><w:rPr>${fonts}${rPr}</w:rPr></w:style>`;
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${ns}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="Arial" w:eastAsia="${font}"/><w:sz w:val="21"/><w:szCs w:val="21"/><w:color w:val="${INK}"/><w:lang w:val="${lang}" w:bidi="ar-SA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="288" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>${style(
    'Title',
    'Title',
    '<w:spacing w:before="0" w:after="160"/>',
    `<w:b/><w:bCs/><w:sz w:val="56"/><w:szCs w:val="56"/><w:color w:val="${INK}"/>`,
  )}${style(
    'Kicker',
    'Kicker',
    '<w:spacing w:after="80"/>',
    `<w:b/><w:bCs/><w:caps/><w:spacing w:val="20"/><w:sz w:val="18"/><w:szCs w:val="18"/><w:color w:val="${NAVY}"/>`,
  )}${style(
    'Heading1',
    'heading 1',
    `<w:keepNext/><w:spacing w:before="360" w:after="120"/><w:pBdr><w:bottom w:val="single" w:sz="8" w:space="4" w:color="${NAVY}"/></w:pBdr><w:outlineLvl w:val="0"/>`,
    `<w:b/><w:bCs/><w:sz w:val="32"/><w:szCs w:val="32"/><w:color w:val="${NAVY}"/>`,
  )}${style(
    'Heading2',
    'heading 2',
    '<w:keepNext/><w:spacing w:before="280" w:after="80"/><w:outlineLvl w:val="1"/>',
    `<w:b/><w:bCs/><w:sz w:val="25"/><w:szCs w:val="25"/><w:color w:val="${INK}"/>`,
  )}${style(
    'Lead',
    'Lead',
    '<w:spacing w:after="200"/>',
    `<w:sz w:val="24"/><w:szCs w:val="24"/><w:color w:val="${MUTED}"/>`,
  )}${style('Muted', 'Muted', '', `<w:sz w:val="19"/><w:szCs w:val="19"/><w:color w:val="${MUTED}"/>`)}${style(
    'Note',
    'Note',
    `<w:spacing w:before="240"/><w:shd w:val="clear" w:color="auto" w:fill="${SOFT}"/><w:ind w:left="160" w:right="160"/>`,
    `<w:i/><w:iCs/><w:sz w:val="18"/><w:szCs w:val="18"/><w:color w:val="${MUTED}"/>`,
  )}${style(
    'CheckItem',
    'Check item',
    `<w:spacing w:after="60"/><w:ind w:${rtl ? 'right' : 'left'}="360" w:hanging="360"/>`,
    '',
  )}</w:styles>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>${links
    .map(
      (url, i) =>
        `<Relationship Id="rIdLink${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escapeXml(url)}" TargetMode="External"/>`,
    )
    .join('')}</Relationships>`;

  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const entries = [
    {
      name: '[Content_Types].xml',
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>',
    },
    {
      name: '_rels/.rels',
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>',
    },
    {
      name: 'docProps/core.xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${escapeXml(doc.title)}</dc:title><dc:creator>Baitly</dc:creator><dc:language>${lang}</dc:language><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created></cp:coreProperties>`,
    },
    { name: 'word/document.xml', content: documentXml },
    { name: 'word/styles.xml', content: stylesXml },
    { name: 'word/footer1.xml', content: footerXml },
    { name: 'word/_rels/document.xml.rels', content: relsXml },
  ];
  return new Blob([createZip(entries)], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}
