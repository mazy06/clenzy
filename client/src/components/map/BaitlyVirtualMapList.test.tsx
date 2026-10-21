import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import BaitlyVirtualMapList from './BaitlyVirtualMapList';
afterEach(()=>{cleanup();vi.restoreAllMocks();delete (HTMLElement.prototype as {scrollTo?:unknown}).scrollTo;});
it('keeps the DOM bounded for two thousand rows and scrolls only the sheet to a distant selection',async()=>{
 const scroll=vi.fn();
 Object.defineProperty(HTMLElement.prototype,'scrollTo',{configurable:true,value:scroll});
 const items=Array.from({length:2000},(_,id)=>({id}));
 const row=(item:{id:number})=><button data-testid="virtual-row">Entreprise {item.id}</button>;
 const view=render(<div data-map-list-scroll><BaitlyVirtualMapList items={items} getItemKey={item=>item.id} renderItem={row}/></div>);
 await screen.findByText('Entreprise 0');expect(screen.getAllByTestId('virtual-row').length).toBeLessThan(30);
 expect(screen.queryByText('Entreprise 1500')).not.toBeInTheDocument();
 view.rerender(<div data-map-list-scroll><BaitlyVirtualMapList items={items} getItemKey={item=>item.id} renderItem={row} activeIndex={1500}/></div>);
 await waitFor(()=>expect(scroll).toHaveBeenCalled());expect(screen.getAllByTestId('virtual-row').length).toBeLessThan(30);
});
it('preserves the keyboard-focused row while the list is virtualized',async()=>{
 const items=Array.from({length:200},(_,id)=>id);
 const row=(id:number)=><button>Entreprise {id}</button>;
 const view=render(<div data-map-list-scroll><BaitlyVirtualMapList items={items} getItemKey={id=>id} renderItem={row}/></div>);
 const first=await screen.findByText('Entreprise 0');fireEvent.focus(first);
 view.rerender(<div data-map-list-scroll><BaitlyVirtualMapList items={[...items].reverse()} getItemKey={id=>id} renderItem={row}/></div>);
 expect(first).toBeInTheDocument();expect(screen.getAllByRole('listitem').length).toBeLessThan(30);
});
