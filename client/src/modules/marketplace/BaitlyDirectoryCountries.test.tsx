import {useState} from 'react';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it} from 'vitest';
import BaitlyDirectoryCountries from './BaitlyDirectoryCountries';
import type {DirectoryCountry} from './BaitlyDirectoryCountry';

afterEach(cleanup);
it('selects several countries in the same menu and keeps at least one selected',async()=>{
 function Picker(){const [value,setValue]=useState<DirectoryCountry[]>(['FR']);return <BaitlyDirectoryCountries value={value} onChange={setValue} language="fr"/>;}
 render(<Picker/>);
 fireEvent.keyDown(screen.getByRole('button',{name:'Pays : France'}),{key:'ArrowDown'});
 expect(await screen.findByRole('menuitemcheckbox',{name:'France'})).toHaveAttribute('data-disabled');
 fireEvent.click(screen.getByRole('menuitemcheckbox',{name:'Maroc'}));
 expect(screen.getByRole('button',{name:'Pays : France, Maroc'})).toBeInTheDocument();
 expect(screen.getByRole('menuitemcheckbox',{name:'France'})).not.toHaveAttribute('data-disabled');
 fireEvent.click(screen.getByRole('menuitemcheckbox',{name:'Arabie saoudite'}));
 expect(screen.getByRole('button',{name:'Pays : France, Maroc, Arabie saoudite'})).toBeInTheDocument();
 fireEvent.click(screen.getByRole('menuitemcheckbox',{name:'France'}));
 fireEvent.click(screen.getByRole('menuitemcheckbox',{name:'Maroc'}));
 expect(screen.getByRole('button',{name:'Pays : Arabie saoudite'})).toBeInTheDocument();
 expect(screen.getByRole('menuitemcheckbox',{name:'Arabie saoudite'})).toHaveAttribute('data-disabled');
});
