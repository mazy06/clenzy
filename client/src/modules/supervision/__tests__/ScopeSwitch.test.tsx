// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScopeSwitch } from '../components/ScopeSwitch';

describe('<ScopeSwitch>', () => {
  it('notifie le changement de portée', () => {
    const onChange = vi.fn();
    render(<ScopeSwitch value="property" onChange={onChange} />);
    // Boutons icône-seule : le libellé est porté par aria-label / title.
    fireEvent.click(screen.getByRole('button', { name: "Vue d'ensemble" }));
    expect(onChange).toHaveBeenCalledWith('portfolio');
  });

  it('marque la portée active via aria-pressed', () => {
    render(<ScopeSwitch value="property" onChange={() => {}} />);
    const active = screen.getByRole('button', { name: 'Par logement' });
    expect(active.getAttribute('aria-pressed')).toBe('true');
  });
});
