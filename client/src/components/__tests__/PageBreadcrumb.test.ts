import { describe, it, expect } from 'vitest';
import { pruneRedundantSegments, type BreadcrumbSegment } from '../PageBreadcrumb';

const hub = (label: string): BreadcrumbSegment => ({
  label,
  siblings: [{ label, path: '/documents' }],
});
const screen = (label: string, href = '/documents'): BreadcrumbSegment => ({ label, href });
const plain = (label: string): BreadcrumbSegment => ({ label });

describe('pruneRedundantSegments', () => {
  it('collapses a hub and its screen when they share the same label', () => {
    const result = pruneRedundantSegments(
      [hub('Documents & Communications'), screen('Documents & Communications'), plain('Catalogue')],
      'Documents & Communications',
    );
    expect(result.map((segment) => segment.label)).toEqual([
      'Documents & Communications',
      'Catalogue',
    ]);
  });

  it('keeps the segment carrying the sibling menu when collapsing', () => {
    const result = pruneRedundantSegments([hub('Finances'), screen('Finances')], undefined);
    expect(result).toHaveLength(1);
    expect(result[0].siblings).toBeDefined();
  });

  it('drops the last segment when it repeats the page title', () => {
    const result = pruneRedundantSegments(
      [hub('Exploitation'), screen('Propriétés', '/properties')],
      'Propriétés',
    );
    expect(result.map((segment) => segment.label)).toEqual(['Exploitation']);
  });

  it('never drops the sibling menu, even if it matches the title', () => {
    const result = pruneRedundantSegments([hub('Exploitation')], 'Exploitation');
    expect(result).toHaveLength(1);
  });

  it('keeps a detail path intact', () => {
    const result = pruneRedundantSegments(
      [hub('Exploitation'), screen('Propriétés', '/properties'), plain('Villa Amal')],
      'Villa Amal',
    );
    expect(result.map((segment) => segment.label)).toEqual(['Exploitation', 'Propriétés']);
  });

  it('leaves distinct labels untouched', () => {
    const segments = [hub('Exploitation'), screen('Réservations'), plain('Calendrier')];
    expect(pruneRedundantSegments(segments, 'Réservations')).toHaveLength(3);
  });
});
