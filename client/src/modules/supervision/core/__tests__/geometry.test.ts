import { describe, it, expect } from 'vitest';
import { computeConstellationLayout, type LayoutAgentInput } from '../geometry';
import { RAD } from '../../constants';

const AGENTS: LayoutAgentInput[] = [
  { id: 'com', status: 'act', autonomy: 'notify' },
  { id: 'rev', status: 'wait', autonomy: 'notify' },
  { id: 'ops', status: 'think', autonomy: 'full' },
  { id: 'fin', status: 'veille', autonomy: 'suggest' },
  { id: 'rep', status: 'veille', autonomy: 'suggest' },
];

const SIZE = { width: 600, height: 560 };
const dist = (p: { x: number; y: number }, cx: number, cy: number) => Math.hypot(p.x - cx, p.y - cy);

describe('computeConstellationLayout', () => {
  const layout = computeConstellationLayout(AGENTS, SIZE);
  // R est désormais dimensionné pour que l'anneau extérieur tienne dans la boîte
  // (empreinte du satellite incluse) → on le lit depuis la sortie, et on vérifie
  // les relations r = R·RAD + l'invariant anti-clip ci-dessous.
  const R = layout.radius;

  it('centre horizontal au milieu ; centre vertical remonté (empreintes asymétriques)', () => {
    expect(layout.cx).toBe(300);
    // cy est REMONTÉ de (BELOW-ABOVE)/2 = (75-34)/2 = 20.5 vs le milieu (280) :
    // la pastille de nom sous l'avatar impose plus de réserve en bas qu'en haut,
    // donc on remonte le centre pour équilibrer les portées et exploiter le haut.
    expect(layout.cy).toBeCloseTo(280 - (75 - 34) / 2);
    expect(layout.cy).toBeLessThan(280);
    expect(R).toBeGreaterThan(0);
    // R est une ÉCHELLE normalisée (rayon réel = R·RAD). C'est le rayon RÉEL de
    // l'anneau extérieur qui doit tenir dans la demi-boîte, pas R lui-même.
    expect(R * RAD.suggest).toBeLessThan(Math.min(SIZE.width, SIZE.height) / 2);
  });

  it('anti-clip : l\'agent extérieur (rotation incluse) garde une marge sous la boîte', () => {
    // .cst__spin tourne → un satellite de l'anneau le plus loin atteint le point
    // le plus bas (cy + R·RAD.suggest). + ~55px de pastille de nom sous l'avatar.
    const lowestLabelBottom = layout.cy + R * RAD.suggest + 55;
    expect(lowestLabelBottom).toBeLessThanOrEqual(SIZE.height - 20);
    // et l'agent ne dépasse pas non plus en haut (avatar)
    expect(layout.cy - R * RAD.suggest - 25).toBeGreaterThanOrEqual(0);
  });

  it('3 anneaux aux rayons R·RAD', () => {
    const byAuto = Object.fromEntries(layout.rings.map((r) => [r.autonomy, r.radius]));
    expect(byAuto.full).toBeCloseTo(R * RAD.full);
    expect(byAuto.notify).toBeCloseTo(R * RAD.notify);
    expect(byAuto.suggest).toBeCloseTo(R * RAD.suggest);
  });

  it('rayon satellite = R·RAD[autonomie]', () => {
    const com = layout.satellites.find((s) => s.id === 'com')!; // notify
    const ops = layout.satellites.find((s) => s.id === 'ops')!; // full
    const fin = layout.satellites.find((s) => s.id === 'fin')!; // suggest
    expect(dist(com, layout.cx, layout.cy)).toBeCloseTo(R * RAD.notify);
    expect(dist(ops, layout.cx, layout.cy)).toBeCloseTo(R * RAD.full);
    expect(dist(fin, layout.cx, layout.cy)).toBeCloseTo(R * RAD.suggest);
  });

  it('wait ne déplace PAS l\'agent : l\'orbite reste celle de son autonomie (notify)', () => {
    const rev = layout.satellites.find((s) => s.id === 'rev')!; // wait, autonomy notify
    expect(dist(rev, layout.cx, layout.cy)).toBeCloseTo(R * RAD.notify);
  });

  it('premier satellite au-dessus du centre (angle -π/2 + offset)', () => {
    const com = layout.satellites.find((s) => s.id === 'com')!;
    expect(com.y).toBeLessThan(layout.cy);
  });

  it('faisceaux : actifs reliés (act/think/wait), veille = idle', () => {
    expect(layout.beams.find((b) => b.id === 'com')!.active).toBe(true);
    expect(layout.beams.find((b) => b.id === 'ops')!.active).toBe(true);
    expect(layout.beams.find((b) => b.id === 'rev')!.active).toBe(true);
    expect(layout.beams.find((b) => b.id === 'fin')!.active).toBe(false);
  });

  it('faisceau démarre à 34px du centre, finit à 28px du satellite', () => {
    const com = layout.satellites.find((s) => s.id === 'com')!;
    const beam = layout.beams.find((b) => b.id === 'com')!;
    expect(Math.hypot(beam.x1 - layout.cx, beam.y1 - layout.cy)).toBeCloseTo(34);
    expect(Math.hypot(beam.x2 - com.x, beam.y2 - com.y)).toBeCloseTo(28);
  });

  it('reste fini quand la taille est 0 (jsdom non layouté)', () => {
    const l0 = computeConstellationLayout(AGENTS, { width: 0, height: 0 });
    for (const s of l0.satellites) {
      expect(Number.isFinite(s.x)).toBe(true);
      expect(Number.isFinite(s.y)).toBe(true);
    }
  });
});
