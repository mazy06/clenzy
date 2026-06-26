import { describe, it, expect } from 'vitest';
import { aggregatePortfolio } from '../aggregate';
import { buildPropertySnapshot } from '../../provider/mockData';

describe('aggregatePortfolio', () => {
  const a = buildPropertySnapshot('A'); // showcase : com act, rev wait, ops think, fin/rep veille, 1 pending
  const b = buildPropertySnapshot('B', 'calm'); // ops act, reste veille, 0 pending
  const portfolio = aggregatePortfolio([a, b], { A: 'Alpha', B: 'Beta' });

  it('produit un snapshot portefeuille', () => {
    expect(portfolio.scope).toBe('portfolio');
    expect(portfolio.propertyCount).toBe(2);
  });

  it('status du rollup = max-priorité (think + act → act)', () => {
    const ops = portfolio.agents.find((x) => x.id === 'ops')!;
    expect(ops.status).toBe('act');
    expect(ops.propertyCount).toBe(2);
    expect(ops.items).toHaveLength(2);
  });

  it('wait conservé, comptage par logement non-veille', () => {
    const rev = portfolio.agents.find((x) => x.id === 'rev')!;
    expect(rev.status).toBe('wait');
    expect(rev.propertyCount).toBe(1);
    const fin = portfolio.agents.find((x) => x.id === 'fin')!;
    expect(fin.propertyCount).toBe(0);
    expect(fin.items).toHaveLength(0);
  });

  it('file concaténée, chaque action taguée du logement', () => {
    expect(portfolio.pending).toHaveLength(1);
    expect(portfolio.pending[0].propertyName).toBe('Alpha');
    expect(portfolio.dayMetrics.awaiting).toBe(1);
  });

  it('journal concaténé et trié chrono inversé', () => {
    expect(portfolio.feed).toHaveLength(a.feed.length + b.feed.length);
    for (let i = 1; i < portfolio.feed.length; i += 1) {
      expect(portfolio.feed[i - 1].at >= portfolio.feed[i].at).toBe(true);
    }
  });
});
