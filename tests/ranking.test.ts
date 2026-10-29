import { describe,it,expect } from 'vitest';
import { choose } from '../src/ranking';
import { normalizeSettings,defaults } from '../src/settings';
const video=(area:number,playing=false,visibleRatio=1)=>({area,playing,visibleRatio,duration:120,embedded:false});
describe('video selection',()=>{
 it('handles no video and a single candidate',()=>{expect(choose([],'smart')).toBeNull();const v=video(100);expect(choose([v],'manual')).toBe(v);});
 it('asks when smart candidates are ambiguous',()=>expect(choose([video(100),video(110)],'smart')).toBeNull());
 it('prefers a large main player over a playing preview',()=>{const main=video(10000);expect(choose([video(100,true),main],'smart')).toBe(main);});
 it('manual asks even with a clear winner',()=>expect(choose([video(10),video(10000)],'manual')).toBeNull());
 it('largest uses visible area rather than playback',()=>{const large=video(200);expect(choose([video(100,true),large],'largest')).toBe(large);});
 it('discounts mostly off-screen players',()=>{const visible=video(200);expect(choose([video(1000,false,.1),visible],'largest')).toBe(visible);});
});
describe('stored settings',()=>{
 it('handles corrupt or absent storage',()=>{expect(normalizeSettings(null)).toEqual(defaults);expect(normalizeSettings({color:'red;display:none',thickness:Infinity,mode:'bad'})).toEqual(defaults);});
 it('clamps thickness and keeps valid preferences',()=>expect(normalizeSettings({thickness:100,selection:'manual',notifications:false})).toMatchObject({thickness:6,selection:'manual',notifications:false}));
});
