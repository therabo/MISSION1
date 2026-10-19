// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { PositionStatusBar } from './PositionStatusBar';
import regions from '../geo/marineRegions.json';
import { MARINE_POLICY, type MarineRegionIdentity } from '../geo/marineLookup';
import type { OverLookupResult } from '../geo/overLocation';
const props={position:null,selectedSource:null,sceneTimeMs:null,buffer:'waiting' as const};
it('renders exactly the approved marine values once, as text only with no extra interaction',async()=>{
  Object.defineProperty(globalThis,'IS_REACT_ACT_ENVIRONMENT',{value:true,configurable:true});
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  try{
    for(const region of Object.values(regions)){
      await act(async()=>root.render(<PositionStatusBar {...props} over={{kind:'marine-region',region:region as MarineRegionIdentity,policy:MARINE_POLICY,boundary:false}}/>));
      const value=host.querySelector('.position-over dd')!,name=value.querySelector('.marine-name')!;
      expect(value.classList.contains('position-marine')).toBe(true);expect(value.textContent).toBe(region.displayName);
      expect(name.getAttribute('title')).toBe(region.displayName);expect(value.querySelectorAll('span')).toHaveLength(1);
      expect(value.querySelector('img,svg,.country-mark,.country-name,button,a,[tabindex],[role],[aria-live],[aria-label]')).toBeNull();
      expect(host.querySelector('[data-country-state]')!.getAttribute('data-country-state')).toBe('no-country');
    }
  }finally{await act(async()=>root.unmount());host.remove();}
});
it.each<OverLookupResult>([
  {kind:'no-region'},{kind:'ambiguous-marine',candidates:[],policy:MARINE_POLICY},
  {kind:'dataset-loading',dataset:'marine'},{kind:'dataset-unavailable',dataset:'marine'},
])('renders $kind as a dash without losing the diagnostic',async over=>{
  const host=document.createElement('div'),root=createRoot(host);
  try{await act(async()=>root.render(<PositionStatusBar {...props} over={over}/>));
    expect(host.querySelector('.position-over dd')!.textContent).toBe('—');
    expect(host.querySelector('[data-over-state]')!.getAttribute('data-over-state')).toBe(over.kind);
    expect(host.querySelector('.marine-name,img,svg')).toBeNull();
  }finally{await act(async()=>root.unmount());}
});
