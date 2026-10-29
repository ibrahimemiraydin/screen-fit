import {useEffect,useState} from 'react';
import {browser} from 'wxt/browser';
import {normalizeSettings} from './settings';
import type {Language} from './i18n';
export function useLanguage():Language {
 const [language,setLanguage]=useState<Language>('tr');
 useEffect(()=>{
  void browser.storage.local.get('settings').then(data=>setLanguage(normalizeSettings(data.settings).language)).catch(()=>{});
  const changed=(changes:Record<string,{newValue?:unknown}>,area:string)=>{if(area==='local'&&changes.settings)setLanguage(normalizeSettings(changes.settings.newValue).language);};
  browser.storage.onChanged.addListener(changed);return()=>browser.storage.onChanged.removeListener(changed);
 },[]);
 return language;
}
