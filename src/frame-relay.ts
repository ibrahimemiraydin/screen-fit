export type FrameInfo={frameId:number;parentFrameId:number;url:string};
export function frameOrigin(url:string):string|null {
  try {const u=new URL(url);return ['https:','http:'].includes(u.protocol)?`${u.protocol}//${u.hostname}/*`:null;}catch{return null;}
}
export function playerBranch(frames:FrameInfo[], roots:number[]):FrameInfo[] {
  const eligible=frames.filter(f=>!/(?:captcha|turnstile|challenge|doubleclick|googlesyndication|adservice|dtscout|advertisement|consent|recaptcha)/i.test(f.url));
  const ids=new Set(roots.filter(id=>id!==0&&eligible.some(f=>f.frameId===id)));
  let changed=true;
  while(changed){changed=false;for(const f of eligible)if(ids.has(f.parentFrameId)&&!ids.has(f.frameId)){ids.add(f.frameId);changed=true;}}
  return eligible.filter(f=>ids.has(f.frameId));
}
export function findPlayerRoots(frames:FrameInfo[],src:string):number[] {
  const clean=(s:string)=>s.split('#')[0];
  const exact=frames.filter(f=>f.frameId!==0&&clean(f.url)===clean(src));
  if(exact.length)return exact.map(f=>f.frameId);
  const sameOrigin=frames.filter(f=>f.frameId!==0&&frameOrigin(f.url)===frameOrigin(src));
  return sameOrigin.length===1?sameOrigin.map(f=>f.frameId):[];
}

// Serialized by scripting.executeScript: keep these functions self-contained.
export function installEscapeRelay(session:string,zoom=100,mode:'fit'|'fill'='fit') {
  const win=window as typeof window & {__screenFitEscape?:{session:string;dispose:()=>void;apply:(zoom:number,mode:'fit'|'fill')=>void}};
  const api=(globalThis as unknown as {chrome:{runtime:{id?:string;sendMessage:(m:unknown)=>Promise<unknown>}}}).chrome;
  if(win.__screenFitEscape?.session===session){win.__screenFitEscape.apply(zoom,mode);return true;}
  win.__screenFitEscape?.dispose();
  const style=document.createElement('style');(document.head??document.documentElement).append(style);
  const originals=new Map<HTMLVideoElement,string|null>();
  let selected:HTMLVideoElement|undefined,currentZoom=zoom,currentMode=mode;
  function apply(value:number,mode:'fit'|'fill') {
    currentZoom=typeof value==='number'&&Number.isFinite(value)?Math.round(Math.max(25,Math.min(300,value))):100;currentMode=mode==='fill'?'fill':'fit';
    const videos=[...document.querySelectorAll('video')].filter(v=>{const r=v.getBoundingClientRect(),s=getComputedStyle(v);return r.width>50&&r.height>32&&r.bottom>0&&r.right>0&&r.top<innerHeight&&r.left<innerWidth&&s.display!=='none'&&s.visibility==='visible'&&s.opacity!=='0';});
    videos.sort((a,b)=>{const area=(v:HTMLVideoElement)=>{const r=v.getBoundingClientRect();return r.width*r.height*(!v.paused&&!v.ended?1.7:1);};return area(b)-area(a);});
    const video=videos[0];
    if(selected!==video){if(selected){const original=originals.get(selected);if(original==null)selected.removeAttribute('data-screen-fit-frame-media');else selected.setAttribute('data-screen-fit-frame-media',original);}selected=video;}
    if(video){if(!originals.has(video))originals.set(video,video.getAttribute('data-screen-fit-frame-media'));video.setAttribute('data-screen-fit-frame-media',session);}
    const box=currentZoom===100?'none':`inset(${Number(((1-100/currentZoom)*50).toFixed(5))}%)`;
    const css=`video[data-screen-fit-frame-media="${session}"]{object-fit:${currentMode==='fill'?'cover':'contain'}!important;object-view-box:${box}!important}`;
    if(style.textContent!==css)style.textContent=css;
  }
  const key=(event:KeyboardEvent)=>{
    if(event.key!=='Escape')return;
    try {
      if(!api.runtime.id){dispose();return;}
      event.preventDefault();event.stopImmediatePropagation();
      void api.runtime.sendMessage({type:'screen-fit:frame-escape',session}).catch(()=>dispose());
    }catch{dispose();}
  };
  const timer=setInterval(()=>{try{if(!api.runtime.id)dispose();else apply(currentZoom,currentMode);}catch{dispose();}},1000);
  function dispose(){document.removeEventListener('keydown',key,true);clearInterval(timer);style.remove();for(const [v,original]of originals){if(original===null)v.removeAttribute('data-screen-fit-frame-media');else v.setAttribute('data-screen-fit-frame-media',original);}if(win.__screenFitEscape?.session===session)delete win.__screenFitEscape;}
  document.addEventListener('keydown',key,true);win.__screenFitEscape={session,dispose,apply};apply(zoom,mode);return true;
}
export function updateFrameDisplay(session:string,zoom:number,mode:'fit'|'fill') {
  const win=window as typeof window & {__screenFitEscape?:{session:string;apply:(zoom:number,mode:'fit'|'fill')=>void}};
  if(win.__screenFitEscape?.session===session)win.__screenFitEscape.apply(zoom,mode);
}
export function removeEscapeRelay(session:string) {
  const win=window as typeof window & {__screenFitEscape?:{session:string;dispose:()=>void}};
  if(win.__screenFitEscape?.session===session)win.__screenFitEscape.dispose();
}
