// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScopeSwitch, ScopeToggle } from '../components/ScopeSwitch';

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

describe('<ScopeToggle>', () => {
  it("montre la portee COURANTE et bascule vers l'autre", () => {
    const onChange = vi.fn();
    render(<ScopeToggle value="property" onChange={onChange} />);
    // Le libellé dit l'ACTION ; l'icône, elle, dit où l'on est.
    fireEvent.click(screen.getByRole('button', { name: "Basculer en vue d'ensemble" }));
    expect(onChange).toHaveBeenCalledWith('portfolio');
  });

  it('bascule en sens inverse depuis la vue d\'ensemble', () => {
    const onChange = vi.fn();
    render(<ScopeToggle value="portfolio" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Basculer par logement' }));
    expect(onChange).toHaveBeenCalledWith('property');
  });
});
