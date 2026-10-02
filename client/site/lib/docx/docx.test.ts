import { describe, expect, it } from 'vitest';
import { buildDocx } from './docx';
import { crc32, createZip } from './zip';

/** Relit l'archive « stored » produite par createZip : nom → contenu. */
async function unzip(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer);
  const files = new Map<string, { text: string; crcOk: boolean }>();
  let offset = 0;
  const decoder = new TextDecoder();
  while (view.getUint32(offset, true) === 0x04034b50) {
    const crc = view.getUint32(offset + 14, true);
    const size = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const name = decoder.decode(bytes.subarray(offset + 30, offset + 30 + nameLength));
    const data = bytes.subarray(offset + 30 + nameLength, offset + 30 + nameLength + size);
    files.set(name, { text: decoder.decode(data), crcOk: crc32(data) === crc });
    offset += 30 + nameLength + size;
  }
  return files;
}

describe('Word export', () => {
  it('computes the standard CRC-32', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('writes a valid package with escaped text, external links and a page footer', async () => {
    const blob = buildDocx({
      title: 'Guide <test>',
      language: 'fr',
      footer: 'Baitly',
      pageLabel: 'Page',
      blocks: [
        { kind: 'title', text: 'Maroc & France' },
        { kind: 'paragraph', runs: [{ text: 'Source', link: 'https://example.org/a?b=1&c=2' }] },
        { kind: 'check', checked: true, runs: [{ text: 'Fait' }] },
      ],
    });
    const files = await unzip(blob);
    expect([...files.keys()]).toEqual(
      expect.arrayContaining(['[Content_Types].xml', 'word/document.xml', 'word/styles.xml', 'word/footer1.xml']),
    );
    expect([...files.values()].every((file) => file.crcOk)).toBe(true);
    const document = files.get('word/document.xml')!.text;
    expect(document).toContain('Maroc &amp; France');
    expect(document).not.toContain('<w:bidi/>');
    expect(files.get('word/_rels/document.xml.rels')!.text).toContain(
      'Target="https://example.org/a?b=1&amp;c=2" TargetMode="External"',
    );
    expect(files.get('word/footer1.xml')!.text).toContain(' PAGE ');
    expect(files.get('docProps/core.xml')!.text).toContain('Guide &lt;test&gt;');
  });

  it('lays Arabic out right to left', async () => {
    const files = await unzip(
      buildDocx({
        title: 'دليل',
        language: 'ar',
        footer: 'Baitly',
        pageLabel: 'الصفحة',
        blocks: [{ kind: 'paragraph', runs: [{ text: 'المغرب' }] }],
      }),
    );
    const document = files.get('word/document.xml')!.text;
    expect(document).toContain('<w:bidi/>');
    expect(document).toContain('<w:rtl/>');
  });

  it('keeps an empty archive well formed', () => {
    const zip = createZip([]);
    expect(new DataView(zip.buffer).getUint32(0, true)).toBe(0x06054b50);
  });
});
