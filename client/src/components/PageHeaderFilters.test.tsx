import {useState} from 'react';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import PageHeaderActions from './PageHeaderActions';

vi.mock('../hooks/useTranslation',()=>({useTranslation:()=>({t:(_key:string,fallback:string)=>fallback})}));
vi.mock('../hooks/useHeaderSeam',()=>({useHeaderSeam:()=>({triggerRef:{current:null},seam:null,measure:vi.fn()}),HEADER_FLYOUT_CLASS:''}));
afterEach(cleanup);

function Filters({narrow=false}:{narrow?:boolean}){
 const [service,setService]=useState('');
 return <PageHeaderActions narrow={narrow} filtersActive={!!service} filters={<label>Type de service<select aria-label="Type de service" value={service} onChange={event=>setService(event.target.value)}><option value="">Tous</option><option value="cleaning">Ménage</option></select><button onClick={()=>setService('')}>Réinitialiser</button></label>}/>;
}

it('keeps the desktop filter icon active after its panel closes',async()=>{
 render(<Filters/>);const button=screen.getByRole('button',{name:'Filtres'});
 fireEvent.click(button);fireEvent.change(await screen.findByRole('combobox'),{target:{value:'cleaning'}});
 fireEvent.click(button);expect(screen.queryByRole('combobox')).not.toBeInTheDocument();expect(button).toHaveAttribute('data-filters-active','true');
});

it('keeps the compact menu open while changing or resetting filters',async()=>{
 render(<Filters narrow/>);const button=screen.getByRole('button',{name:'Actions'});
 fireEvent.keyDown(button,{key:'Enter'});const select=await screen.findByRole('combobox');
 fireEvent.click(select);expect(select).toBeVisible();
 fireEvent.change(select,{target:{value:'cleaning'}});expect(button).toHaveAttribute('data-filters-active','true');
 fireEvent.click(screen.getByRole('button',{name:'Réinitialiser'}));expect(select).toBeVisible();expect(select).toHaveValue('');expect(button).toHaveAttribute('data-filters-active','false');
});
