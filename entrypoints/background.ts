import { browser } from 'wxt/browser';
import {findPlayerRoots,frameOrigin,playerBranch,installEscapeRelay,removeEscapeRelay,updateFrameDisplay} from '../src/frame-relay';
import {percent} from '../src/display';
import {normalizeSettings} from '../src/settings';
import {translate,type Language} from '../src/i18n';
type RelayState={session:string;roots:number[];frameIds:number[];origins:string[];zoom:number;mode:'fit'|'fill'};
export default defineBackground(() => {
  const busy = new Set<number>();
  const isMissingTab=(error:unknown)=>/\b(?:No tab with id|Invalid tab ID)\b/i.test(error instanceof Error?error.message:String(error));
  const reportError=(error:unknown)=>{if(!isMissingTab(error))console.error('Screen Fit background operation failed:',error);};
  async function language():Promise<Language>{try{return normalizeSettings((await browser.storage.local.get('settings')).settings).language;}catch{return 'tr';}}
  async function updateAction(tabId:number,changes:{text?:string;color?:string;title?:string}) {
    // A tab can close between any two API calls. Consume every result, including
    // updates already in flight when onRemoved is delivered.
    const updates:(()=>Promise<unknown>)[]=[];
    if(changes.text!==undefined)updates.push(()=>browser.action.setBadgeText({tabId,text:changes.text!}));
    if(changes.color!==undefined)updates.push(()=>browser.action.setBadgeBackgroundColor({tabId,color:changes.color!}));
    if(changes.title!==undefined)updates.push(()=>browser.action.setTitle({tabId,title:changes.title!}));
    const results=await Promise.allSettled(updates.map(async update=>{
      try{await update();}catch(error){if(!isMissingTab(error))throw error;}
    }));
    const failure=results.find((result):result is PromiseRejectedResult=>result.status==='rejected');
    if(failure)throw failure.reason;
  }
  const desired=new Map<number,string>();
  const queues=new Map<number,Promise<unknown>>();
  function serial<T>(tabId:number,task:()=>Promise<T>):Promise<T> {
    const result=(queues.get(tabId)??Promise.resolve()).catch(()=>{}).then(task);
    queues.set(tabId,result);
    void result.finally(()=>{if(queues.get(tabId)===result)queues.delete(tabId);}).catch(()=>{});
    return result;
  }
  const relayKey=(tabId:number)=>`frame-relay:${tabId}`;
  const readRelay=async(tabId:number)=>(await browser.storage.session.get(relayKey(tabId)))[relayKey(tabId)] as RelayState|undefined;
  async function endRelay(tabId:number,session:string) {
    if(desired.get(tabId)===session)desired.delete(tabId);
    const relay=await readRelay(tabId);if(relay?.session!==session)return;
    await browser.storage.session.remove(relayKey(tabId));
    await Promise.allSettled(relay.frameIds.map(frameId=>browser.scripting.executeScript({target:{tabId,frameIds:[frameId]},func:removeEscapeRelay,args:[session]})));
  }
  async function attachRelay(tabId:number,session:string) {
    const relay=await readRelay(tabId);if(relay?.session!==session)return {status:'expired'};
    const frames=await browser.webNavigation.getAllFrames({tabId})??[];
    const branch=playerBranch(frames,relay.roots);
    if(!branch.length)return {status:'unavailable'};
    const origins=[...new Set(branch.map(f=>frameOrigin(f.url)).filter((o):o is string=>!!o))];
    const missing:string[]=[];
    for(const origin of origins)if(!await browser.permissions.contains({origins:[origin]}))missing.push(origin);
    if(missing.length){relay.origins=origins;await browser.storage.session.set({[relayKey(tabId)]:relay});return {status:'permission-required',origins:missing};}
    const results=await Promise.allSettled(branch.map(f=>browser.scripting.executeScript({target:{tabId,frameIds:[f.frameId]},func:installEscapeRelay,args:[session,percent(relay.zoom,25,300),relay.mode==='fill'?'fill':'fit']})));
    // An exit or a new selection may have happened while injection was pending.
    const current=await readRelay(tabId);
    if(current?.session!==session){await Promise.allSettled(branch.map(f=>browser.scripting.executeScript({target:{tabId,frameIds:[f.frameId]},func:removeEscapeRelay,args:[session]})));return {status:'expired'};}
    const frameIds=branch.filter((_,i)=>results[i]?.status==='fulfilled').map(f=>f.frameId);
    await browser.storage.session.set({[relayKey(tabId)]:{...relay,frameIds,origins}});
    const status=frameIds.length===branch.length?'ready':frameIds.length?'partial':'unavailable';
    await browser.tabs.sendMessage(tabId,{type:'screen-fit:escape-status',session,status},{frameId:0}).catch(()=>{});
    return {status};
  }
  async function prepareRelay(tabId:number,session:string,src:string,zoom:number,mode:'fit'|'fill') {
    desired.set(tabId,session);
    const frames=await browser.webNavigation.getAllFrames({tabId})??[];
    const roots=findPlayerRoots(frames,src);
    if(desired.get(tabId)!==session)return {status:'expired'};
    if(!roots.length)return {status:'unavailable'};
    const branch=playerBranch(frames,roots);
    const origins=[...new Set(branch.map(f=>frameOrigin(f.url)).filter((o):o is string=>!!o))];
    await browser.storage.session.set({[relayKey(tabId)]:{session,roots,origins,frameIds:[],zoom,mode}});
    return attachRelay(tabId,session);
  }
  async function toggle(tabId:number, manual=false) {
    if (busy.has(tabId)) return;
    busy.add(tabId);
    try {
      // Reuse the existing controller: reinjection invalidates WXT's previous context.
      try {
        await browser.tabs.sendMessage(tabId,{type:'screen-fit:ping'}, {frameId:0});
      } catch {
        await browser.scripting.executeScript({target:{tabId}, files:['/content-scripts/video.js']});
      }
      await browser.tabs.sendMessage(tabId,{type:'screen-fit:toggle', manual}, {frameId:0});
    } catch(error) {
      if(isMissingTab(error))return;
      await updateAction(tabId,{text:'!',color:'#c2410c',title:translate(await language(),'Screen Fit · Bu sayfada çalıştırılamıyor. Normal bir web sayfasında deneyin.')});
    } finally { busy.delete(tabId); }
  }
  browser.action.onClicked.addListener(tab=>{ if(tab.id) void toggle(tab.id).catch(reportError); });
  browser.commands.onCommand.addListener(command=>{
    void (async()=>{const [tab] = await browser.tabs.query({active:true,currentWindow:true});
    if(tab?.id)await toggle(tab.id,command==='select-video');})().catch(reportError);
  });
  browser.runtime.onMessage.addListener((message,sender)=>{
    const tabId=sender.tab?.id;
    if(message?.type==='screen-fit:open-options'&&tabId&&sender.frameId===0)return browser.runtime.openOptionsPage().catch(reportError);
    if(message?.type==='screen-fit:prepare-escape'&&tabId&&sender.frameId===0&&typeof message.session==='string'&&typeof message.src==='string') {
      return serial(tabId,()=>prepareRelay(tabId,message.session,message.src,percent(message.zoom,25,300),message.mode==='fill'?'fill':'fit')).catch(()=>({status:'unavailable'}));
    }
    if(message?.type==='screen-fit:frame-display'&&tabId&&sender.frameId===0&&typeof message.session==='string')return serial(tabId,async()=>{
      const relay=await readRelay(tabId);if(!relay||relay.session!==message.session)return;
      relay.zoom=percent(message.zoom,25,300);relay.mode=message.mode==='fill'?'fill':'fit';
      await browser.storage.session.set({[relayKey(tabId)]:relay});
      await Promise.allSettled(relay.frameIds.map(frameId=>browser.scripting.executeScript({target:{tabId,frameIds:[frameId]},func:updateFrameDisplay,args:[relay.session,relay.zoom,relay.mode]})));
    }).catch(()=>{});
    if(message?.type==='screen-fit:end-escape'&&tabId&&sender.frameId===0&&typeof message.session==='string')return serial(tabId,()=>endRelay(tabId,message.session)).catch(()=>{});
    if(message?.type==='screen-fit:frame-escape'&&tabId&&typeof message.session==='string') {
      return (async()=>{const relay=await readRelay(tabId);if(relay&&relay.session===message.session&&relay.frameIds.includes(sender.frameId??-1))await browser.tabs.sendMessage(tabId,{type:'screen-fit:exit',session:relay.session},{frameId:0}).catch(()=>{});})();
    }
    if(message?.type==='screen-fit:open-frame-access'&&tabId&&sender.frameId===0) {
      return (async()=>{const relay=await readRelay(tabId);if(!relay||relay.session!==message.session)return;await browser.tabs.create({url:browser.runtime.getURL('/frame-access.html')+`?tabId=${tabId}&session=${encodeURIComponent(relay.session)}`});})();
    }
    if(sender.url?.startsWith(browser.runtime.getURL('/frame-access.html'))&&typeof message?.tabId==='number'&&typeof message?.session==='string') {
      if(message.type==='screen-fit:frame-access-info')return readRelay(message.tabId).then(relay=>relay&&relay.session===message.session?{origins:relay.origins}:{expired:true});
      if(message.type==='screen-fit:attach-escape')return serial(message.tabId,()=>attachRelay(message.tabId,message.session)).catch(()=>({status:'unavailable'}));
    }
    if(message?.type !== 'screen-fit:state' || !sender.tab?.id) return;
    const stateTabId=sender.tab.id;
    return language().then(lang=>updateAction(stateTabId,{text:message.state==='active'?'ON':message.state==='selecting'?'…':'',color:'#4d7c0f',title:translate(lang,message.state==='active'?'Screen Fit · Orijinal boyuta dön':'Screen Fit · Büyüt / geri yükle')})).catch(reportError);
  });
  browser.tabs.onRemoved.addListener(tabId=>{desired.delete(tabId);void browser.storage.session.remove(relayKey(tabId)).catch(()=>{});});
  browser.tabs.onUpdated.addListener((tabId,info)=>{if(info.status==='loading') {void serial(tabId,async()=>{const relay=await readRelay(tabId);if(relay)await endRelay(tabId,relay.session);}).catch(()=>{});void language().then(lang=>updateAction(tabId,{text:'',title:translate(lang,'Screen Fit · Büyüt / geri yükle')})).catch(reportError);}});
  const languageChanged=(changes:Record<string,{newValue?:unknown}>,area:string)=>{
    if(area!=='local'||!changes.settings)return;
    const lang=normalizeSettings(changes.settings.newValue).language;
    void (async()=>{
      await browser.action.setTitle({title:translate(lang,'Screen Fit · Büyüt / geri yükle')});
      const tabs=await browser.tabs.query({});
      await Promise.allSettled(tabs.filter(tab=>tab.id!==undefined).map(async tab=>{
        try{const badge=await browser.action.getBadgeText({tabId:tab.id!});await updateAction(tab.id!,{title:translate(lang,badge==='ON'?'Screen Fit · Orijinal boyuta dön':badge==='!'?'Screen Fit · Bu sayfada çalıştırılamıyor. Normal bir web sayfasında deneyin.':'Screen Fit · Büyüt / geri yükle')});}catch(error){reportError(error);}
      }));
    })().catch(reportError);
  };
  browser.storage.onChanged?.addListener(languageChanged);
  if(browser.storage.local)void language().then(lang=>browser.action.setTitle({title:translate(lang,'Screen Fit · Büyüt / geri yükle')})).catch(reportError);
});
