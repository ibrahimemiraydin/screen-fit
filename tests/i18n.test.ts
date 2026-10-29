import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {english,translate,type Message} from '../src/i18n';
import {normalizeSettings} from '../src/settings';
describe('Turkish and English localization',()=>{
 it('provides nonempty translations with matching placeholders for every key',()=>{for(const [key,value]of Object.entries(english)){expect(value.trim()).not.toBe('');expect(value.match(/\{\w+\}/g)??[]).toEqual(key.match(/\{\w+\}/g)??[]);expect(translate('tr',key as Message)).toBe(key);}});
 it('translates user-facing settings text',()=>{expect(translate('en','Videoya yer açın')).toBe('Make room for video');expect(translate('tr','Arayüz dili')).toBe('Arayüz dili');});
 it('interpolates player numbers in both languages',()=>{expect(translate('en','Video {number} seç',{number:2})).toBe('Select video 2');expect(translate('tr','Video {number} seç',{number:2})).toBe('Video 2 seç');});
 it('retains Turkish for existing or invalid language settings',()=>{expect(normalizeSettings({}).language).toBe('tr');expect(normalizeSettings({language:'unknown'}).language).toBe('tr');});
 it('persists language independently of display settings',()=>expect(normalizeSettings({language:'en',zoom:137,playerSize:83,mode:'fill'})).toMatchObject({language:'en',zoom:137,playerSize:83,mode:'fill'}));
 it('ships complete browser locale catalogs',()=>{const tr=JSON.parse(readFileSync('public/_locales/tr/messages.json','utf8')),en=JSON.parse(readFileSync('public/_locales/en/messages.json','utf8'));expect(Object.keys(tr).sort()).toEqual(Object.keys(en).sort());for(const item of Object.values(en) as {message:string}[])expect(item.message.trim().length).toBeGreaterThan(0);});
});
