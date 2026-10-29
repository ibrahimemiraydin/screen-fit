import {describe,it,expect} from 'vitest';
import {percent,viewBox,displayCss} from '../src/display';
import {normalizeSettings} from '../src/settings';
describe('independent display scales',()=>{
 it('uses no crop at 100 percent and zooms the content at 200',()=>{expect(viewBox(100)).toBe('none');expect(viewBox(200)).toBe('inset(25%)');});
 it('expands the viewbox to zoom out',()=>expect(viewBox(50)).toBe('inset(-50%)'));
 it('accepts exact custom percentages and clamps invalid values',()=>{expect(percent(137,25,300)).toBe(137);expect(percent(400,25,300)).toBe(300);expect(percent(5,25,100)).toBe(25);expect(percent(NaN,25,100)).toBe(100);});
 it('shrinks only the outer viewport, not every nested iframe',()=>{expect(displayCss('test','fit',100,80,true)).toContain('width:80vw');expect(displayCss('test','fit',100,80,false)).toContain('width:100vw');});
 it('keeps the object viewbox independent of Fit and Fill',()=>{expect(displayCss('test','fill',200,75,true)).toContain('object-fit:cover');expect(displayCss('test','fill',200,75,true)).toContain('inset(25%)');});
 it('migrates older settings to neutral scales',()=>expect(normalizeSettings({mode:'fill'})).toMatchObject({mode:'fill',zoom:100,playerSize:100}));
 it('preserves saved custom defaults',()=>expect(normalizeSettings({zoom:137,playerSize:83})).toMatchObject({zoom:137,playerSize:83}));
 it('sanitizes corrupt scale values before generating CSS',()=>expect(normalizeSettings({zoom:'999;display:none',playerSize:200})).toMatchObject({zoom:100,playerSize:100}));
});
