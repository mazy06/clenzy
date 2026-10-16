import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PagePagination from '../../../components/PagePagination';

describe('pagination compacte Baitly', () => {
  it('garde le compteur sans navigation inactive sur une page', () => {
    render(<PagePagination page={0} onPageChange={vi.fn()} count={11} rowsPerPage={20}
      hideOnSinglePage={false} hideNavigationOnSinglePage />);
    expect(screen.getByText('1-11 sur 11')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('permet toujours de changer de page lorsque plusieurs pages existent', () => {
    const onPageChange = vi.fn();
    render(<PagePagination page={0} onPageChange={onPageChange} count={30} rowsPerPage={20}
      hideOnSinglePage={false} hideNavigationOnSinglePage />);
    fireEvent.click(screen.getByRole('link', { name: '2' }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });
});
