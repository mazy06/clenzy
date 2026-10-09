import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import BaitlyMarkLogo from '../BaitlyMarkLogo';

afterEach(cleanup);

describe('Logo Baitly approuvé', () => {
  it.each([{ disableAnimation: true }, { idleAnimation: false }])('ne rend aucun flux dans une version statique %j', props => {
    const { container } = render(<BaitlyMarkLogo {...props} />);
    expect(container.querySelectorAll('path')).toHaveLength(1);
    expect(container.querySelector('.baitly-logo-flow')).toBeNull();
    expect(container.textContent).toContain('baitly.');
  });

  it('anime un flux de la même couleur que la maison', () => {
    const { container } = render(<BaitlyMarkLogo variant="mark" />);
    const paths = container.querySelectorAll('path');
    expect(paths).toHaveLength(2);
    expect(paths[0].getAttribute('d')).toBe(paths[1].getAttribute('d'));
    expect(paths[1].getAttribute('stroke')).toBe('currentColor');
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 160 160');
  });

  it('conserve la couleur imposée par un menu sombre', () => {
    const { getByRole } = render(<BaitlyMarkLogo colorMode="inherit" />);
    expect(getByRole('img').style.color).toBe('inherit');
  });
});
