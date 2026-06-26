// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScopeSwitch } from '../components/ScopeSwitch';

describe('<ScopeSwitch>', () => {
  it('notifie le changement de portée', () => {
    const onChange = vi.fn();
    render(<ScopeSwitch value="property" onChange={onChange} />);
    fireEvent.click(screen.getByText("Vue d'ensemble"));
    expect(onChange).toHaveBeenCalledWith('portfolio');
  });

  it('marque la portée active via aria-pressed', () => {
    render(<ScopeSwitch value="property" onChange={() => {}} />);
    const active = screen.getByText('Par logement').closest('button');
    expect(active?.getAttribute('aria-pressed')).toBe('true');
  });
});
