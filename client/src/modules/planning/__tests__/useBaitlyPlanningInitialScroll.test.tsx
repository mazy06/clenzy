import { StrictMode, useRef } from 'react';
import { render, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useBaitlyPlanningInitialScroll } from '../hooks/useBaitlyPlanningInitialScroll';

afterEach(cleanup);

function Surface({ mounted, enabled, position }: { mounted: boolean; enabled: boolean; position: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useBaitlyPlanningInitialScroll(ref, position, enabled);
  return mounted ? <div ref={ref} /> : <div>Chargement</div>;
}

describe('position initiale du planning', () => {
  it('attend la grille même si la liste des logements est déjà chargée', () => {
    const position = vi.fn();
    const view = render(<Surface mounted={false} enabled position={position} />);
    view.rerender(<Surface mounted={false} enabled position={position} />);
    expect(position).not.toHaveBeenCalled();
    view.rerender(<Surface mounted enabled position={position} />);
    expect(position).toHaveBeenCalledOnce();
    view.rerender(<Surface mounted enabled position={position} />);
    expect(position).toHaveBeenCalledOnce();
  });

  it('respecte le chargement et ne recentre plus après un rafraîchissement', () => {
    const position = vi.fn();
    const view = render(<Surface mounted enabled={false} position={position} />);
    expect(position).not.toHaveBeenCalled();
    view.rerender(<Surface mounted enabled position={position} />);
    view.rerender(<Surface mounted={false} enabled={false} position={position} />);
    view.rerender(<Surface mounted enabled position={position} />);
    expect(position).toHaveBeenCalledOnce();
  });

  it('ne double pas le positionnement en StrictMode', () => {
    const position = vi.fn();
    render(<StrictMode><Surface mounted enabled position={position} /></StrictMode>);
    expect(position).toHaveBeenCalledOnce();
  });
});
