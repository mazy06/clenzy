import {cleanup,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import MapWithSheet from '../MapWithSheet';
vi.mock('../../../hooks/use-mobile',()=>({useIsMobile:()=>true}));
vi.mock('../../../hooks/use-media-query',()=>({useMediaQuery:()=>false}));
vi.mock('../../../hooks/useTranslation',()=>({useTranslation:()=>({t:(_key:string,fallback?:string)=>fallback||'Déplier la liste'})}));
afterEach(cleanup);
it('keeps map commands accessible beside the mobile sheet and expands a form without hiding the map',async()=>{
 const {rerender}=render(<MapWithSheet map={<button>Localiser les contacts</button>} listTitle="Contacts"><p>Liste des contacts</p></MapWithSheet>);
 await screen.findByText('Liste des contacts');
 await waitFor(()=>expect(screen.getByRole('button',{name:'Localiser les contacts'})).toBeInTheDocument());
 expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-modal','true');
 rerender(<MapWithSheet map={<button>Localiser les contacts</button>} listTitle="Localisation" listInteraction="form"><label>Ville<input /></label></MapWithSheet>);
 await screen.findByLabelText('Ville');expect(screen.getByRole('button',{name:'Localiser les contacts'})).toBeInTheDocument();
});
