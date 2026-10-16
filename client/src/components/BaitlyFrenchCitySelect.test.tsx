import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import BaitlyFrenchCitySelect from './BaitlyFrenchCitySelect';

vi.mock('../hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
afterEach(() => vi.unstubAllGlobals());
const setup = (department = '92', value = '', onChange = vi.fn()) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><BaitlyFrenchCitySelect department={department} value={value} onChange={onChange} /></QueryClientProvider>);
  return onChange;
};

it('loads only the selected department and allows returning to the whole department', async () => {
  const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>['Courbevoie','Neuilly-sur-Seine']});vi.stubGlobal('fetch',fetcher);
  const onChange=setup('92','Courbevoie');
  await screen.findByRole('option',{name:'Neuilly-sur-Seine'});
  expect(fetcher).toHaveBeenCalledWith('/geo/baitly-communes/92.json',expect.objectContaining({signal:expect.any(AbortSignal)}));
  fireEvent.change(screen.getByRole('combobox'),{target:{value:''}});
  expect(onChange).toHaveBeenCalledWith(undefined);
});

it('preserves a saved city when the list cannot load and offers a retry', async () => {
  const fetcher=vi.fn().mockResolvedValueOnce({ok:false}).mockResolvedValueOnce({ok:true,json:async()=>['Courbevoie']});vi.stubGlobal('fetch',fetcher);
  const onChange=setup('92','Courbevoie');
  await screen.findByRole('alert');expect(screen.getByRole('combobox')).toHaveValue('Courbevoie');
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'providerCoverage.retryCities'}));
  await waitFor(()=>expect(screen.getByRole('combobox')).toBeEnabled());
});
