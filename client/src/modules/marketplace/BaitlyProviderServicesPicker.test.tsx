import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import BaitlyProviderServicesPicker from './BaitlyProviderServicesPicker';
import { marketplaceKeys } from '../../hooks/useMarketplaceProviders';
import { marketplaceProvidersApi } from '../../services/api/marketplaceProvidersApi';
vi.mock('../../services/api/marketplaceProvidersApi',()=>({marketplaceProvidersApi:{getCategories:vi.fn()}}));
const categories=[{code:'CLEANING',labelFr:'Ménage',labelEn:'Cleaning',items:[
  {code:'cleaning-turnover',labelFr:'Ménage entre deux séjours',labelEn:'Turnover cleaning'},
  {code:'cleaning-windows',labelFr:'Nettoyage des vitres',labelEn:'Window cleaning'},
]},{code:'CULINARY',labelFr:'Cuisine',labelEn:'Cooking',items:[{code:'culinary-breakfast',labelFr:'Petit-déjeuner',labelEn:'Breakfast'}]}];
const changed=vi.fn();
afterEach(()=>{cleanup();vi.clearAllMocks();});
async function mount(){
  const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
  client.setQueryData(marketplaceKeys.categories(),categories);
  vi.mocked(marketplaceProvidersApi.getCategories).mockResolvedValue(categories as never);
  function Draft(){const [value,setValue]=useState(['cleaning-turnover']);return <BaitlyProviderServicesPicker value={value} onChange={codes=>{changed(codes);setValue(codes);}}/>;}
  render(<QueryClientProvider client={client}><Draft/></QueryClientProvider>);
  await screen.findByLabelText('Petit-déjeuner');
}
it('selects services across several trades in the draft',async()=>{
  await mount();expect(screen.getByLabelText('Ménage entre deux séjours')).toBeChecked();
  fireEvent.click(screen.getByLabelText('Nettoyage des vitres'));fireEvent.click(screen.getByLabelText('Petit-déjeuner'));
  expect(changed).toHaveBeenLastCalledWith(['cleaning-turnover','cleaning-windows','culinary-breakfast']);
});
it('keeps choices when searching',async()=>{
  await mount();fireEvent.click(screen.getByLabelText('Petit-déjeuner'));
  fireEvent.change(screen.getByLabelText('Rechercher une prestation ou un métier'),{target:{value:'vitres'}});
  expect(screen.queryByLabelText('Petit-déjeuner')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('2 prestation');
  fireEvent.change(screen.getByLabelText('Rechercher une prestation ou un métier'),{target:{value:''}});
  expect(screen.getByLabelText('Petit-déjeuner')).toBeChecked();
});
it('allows removing a service',async()=>{
  await mount();fireEvent.click(screen.getByLabelText('Ménage entre deux séjours'));
  expect(changed).toHaveBeenLastCalledWith([]);
  expect(screen.getByLabelText('Ménage entre deux séjours')).not.toBeChecked();
});
it('selects the entire trade even when search hides some of its services',async()=>{
  await mount();
  fireEvent.change(screen.getByLabelText('Rechercher une prestation ou un métier'),{target:{value:'vitres'}});
  fireEvent.click(screen.getByRole('checkbox',{name:'Tout cocher dans ce métier: Ménage'}));
  expect(changed).toHaveBeenLastCalledWith(['cleaning-turnover','cleaning-windows']);
});
