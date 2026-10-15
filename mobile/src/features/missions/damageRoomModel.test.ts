import { catalogMatchesRoom, inventoryMatchesRoom } from './damageRoomModel';
it('shows appliances and TVs only in suitable catalog rooms',()=>{
  expect(catalogMatchesRoom({key:'fridge',sheet:'large-appliances',room:'Cuisine'},'kitchen_1')).toBe(true);
  expect(catalogMatchesRoom({key:'fridge',sheet:'large-appliances',room:'Cuisine'},'bedroom_1')).toBe(false);
  expect(catalogMatchesRoom({key:'television',sheet:'electronics',room:'Salon'},'bathroom_1')).toBe(false);
  expect(catalogMatchesRoom({key:'television',sheet:'electronics',room:'Salon'},'bedroom_1')).toBe(true);
});
it('uses actual inventory room assignments and keeps unknown locations available',()=>{
  expect(inventoryMatchesRoom({room:'Salon'},'bedroom_1')).toBe(false);
  expect(inventoryMatchesRoom({room:'Chambre'},'bedroom_2')).toBe(true);
  expect(inventoryMatchesRoom({},'bedroom_1')).toBe(true);
});
it('places kitchen fixtures in the kitchen and supports common safety items',()=>{
  expect(catalogMatchesRoom({key:'kitchen-sink',sheet:'fixtures',room:'Salle de bain'},'kitchen_1')).toBe(true);
  expect(catalogMatchesRoom({key:'kitchen-sink',sheet:'fixtures',room:'Salle de bain'},'bathroom_1')).toBe(false);
  expect(catalogMatchesRoom({key:'smoke-detector',sheet:'safety-access',room:'Salon'},'kitchen_1')).toBe(true);
});
