import {useState} from 'react';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {afterEach,expect,it} from 'vitest';
import {List,LayoutGrid} from '../../icons/glyphs';
import {PageHeaderActionsProvider,PageHeaderFilterControls,usePageHeaderActionsSlot,usePageHeaderFiltersSlot} from '../PageHeaderActionsContext';
import PageHeaderViewControls from '../PageHeaderViewControls';

afterEach(cleanup);
function Controls(){
 const [city,setCity]=useState('all');const [view,setView]=useState('list');
 return <section aria-label="Résultats">
  <PageHeaderFilterControls><select aria-label="Ville" value={city} onChange={e=>setCity(e.target.value)}><option value="all">Toutes</option><option value="Nantes">Nantes</option></select></PageHeaderFilterControls>
  <PageHeaderViewControls label="Affichage" value={view} onChange={setView} options={[{value:'list',label:'Liste',icon:<List/>},{value:'grid',label:'Grille',icon:<LayoutGrid/>}]}/>
  <output>{city} / {view}</output>
 </section>;
}
function Host(){
 const {slot,portalContainer}=usePageHeaderActionsSlot();const {filtersSlot,filtersContainer}=usePageHeaderFiltersSlot();const [open,setOpen]=useState(false);
 return <PageHeaderActionsProvider slot={slot} filtersSlot={filtersSlot}><header>{portalContainer}<button onClick={()=>setOpen(value=>!value)}>Filtres</button>{open&&filtersContainer}</header><Controls/></PageHeaderActionsProvider>;
}
it('moves controls into the header without duplicate body controls and preserves filters when reopened',()=>{
 render(<Host/>);const header=screen.getByRole('banner');const results=screen.getByRole('region',{name:'Résultats'});
 expect(within(results).queryByRole('combobox')).toBeNull();expect(within(results).queryByRole('button')).toBeNull();
 fireEvent.click(within(header).getByRole('button',{name:'Grille'}));expect(screen.getByText('all / grid')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Filtres'}));fireEvent.change(within(header).getByRole('combobox',{name:'Ville'}),{target:{value:'Nantes'}});
 fireEvent.click(screen.getByRole('button',{name:'Filtres'}));fireEvent.click(screen.getByRole('button',{name:'Filtres'}));
 expect(screen.getAllByRole('combobox',{name:'Ville'})).toHaveLength(1);expect(screen.getByRole('combobox',{name:'Ville'})).toHaveValue('Nantes');
});
it('keeps standalone controls available without a parent page header',()=>{
 render(<Controls/>);fireEvent.change(screen.getByRole('combobox',{name:'Ville'}),{target:{value:'Nantes'}});fireEvent.click(screen.getByRole('button',{name:'Grille'}));
 expect(screen.getByText('Nantes / grid')).toBeInTheDocument();
});
