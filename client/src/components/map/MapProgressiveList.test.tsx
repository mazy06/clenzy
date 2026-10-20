import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import MapProgressiveList from './MapProgressiveList';
vi.mock('../../hooks/useTranslation',()=>({useTranslation:()=>({t:(_key:string,fallback:string)=>fallback})}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();});
it('reveals a selected row beyond the initial window and scrolls only its panel',()=>{
 const scroll=vi.fn();
 vi.stubGlobal('matchMedia',()=>({matches:true}));
 vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this:HTMLElement){
  return {top:this.hasAttribute('data-map-list-scroll')?100:600,bottom:this.hasAttribute('data-map-list-scroll')?400:650} as DOMRect;
 });
 const items=Array.from({length:65},(_,i)=>i);
 const row=(id:number)=><article key={id} data-testid="row">Contact {id}</article>;
 const view=render(<div data-map-list-scroll><MapProgressiveList items={items} resetKey="all" renderItem={row}/></div>);
 const panel=view.container.querySelector<HTMLElement>('[data-map-list-scroll]')!;panel.scrollTo=scroll;
 view.rerender(<div data-map-list-scroll><MapProgressiveList items={items} resetKey="all" renderItem={row} activeIndex={44}/></div>);
 expect(screen.getByText('Contact 44')).toBeInTheDocument();
 expect(scroll).toHaveBeenCalledWith({top:250,behavior:'instant'});
 view.rerender(<div data-map-list-scroll><MapProgressiveList items={items} resetKey="all" renderItem={row}/></div>);
 expect(screen.getByText('Contact 44')).toBeInTheDocument();
 expect(scroll).toHaveBeenCalledTimes(1);
});
it('appends rows near the end of the shared scroll panel and resets for a different selection',()=>{
 let notify!:IntersectionObserverCallback;let options:IntersectionObserverInit|undefined;
 vi.stubGlobal('IntersectionObserver',class{constructor(callback:IntersectionObserverCallback,config:IntersectionObserverInit){notify=callback;options=config;}observe(){}disconnect(){}});
 const items=Array.from({length:45},(_,i)=>i);
 const row=(id:number)=><div key={id} data-testid="row">Contact {id}</div>;
 const {container,rerender}=render(<div data-map-list-scroll><MapProgressiveList items={items} resetKey="all" renderItem={row}/></div>);
 expect(screen.getAllByTestId('row')).toHaveLength(20);expect(options?.root).toBe(container.querySelector('[data-map-list-scroll]'));
 act(()=>notify([{isIntersecting:true}] as IntersectionObserverEntry[],{} as IntersectionObserver));
 expect(screen.getAllByTestId('row')).toHaveLength(40);expect(screen.getByText('Contact 0')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button'));expect(screen.getAllByTestId('row')).toHaveLength(45);expect(screen.queryByRole('button')).not.toBeInTheDocument();
 rerender(<div data-map-list-scroll><MapProgressiveList items={items} resetKey="providers" renderItem={row}/></div>);
 expect(screen.getAllByTestId('row')).toHaveLength(20);
});
