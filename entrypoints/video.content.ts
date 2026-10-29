import { browser } from 'wxt/browser';
import { defaults, normalizeSettings, type Settings } from '../src/settings';
import { choose, type Metrics } from '../src/ranking';
import { classifyFrame,isTrAnimePlayer } from '../src/frames';
import {displayCss,percent} from '../src/display';
import {translate,type Message} from '../src/i18n';
import overlayStyles from '../src/overlay.css?inline';
import {overlayIcon} from '../src/overlay-icons';
import {noCandidateReason,type DetectionSignals,type CompatibilityReason} from '../src/compatibility';

type Candidate = Metrics & { element: HTMLElement; root: HTMLElement; chain: HTMLIFrameElement[]; frame?:HTMLIFrameElement; requiresConfirmation?:boolean; custom?:boolean };
export default defineContentScript({
  registration:'runtime',
  main(ctx) {
    const win = window as typeof window & { __screenFit?:boolean };
    if(win.__screenFit) return;
    win.__screenFit=true;
    let settings:Settings=defaults;
    let active=false, selecting=false, cleanup: (()=>void)|undefined;
    let pickerCleanup:(()=>void)|undefined;
    let toastTimer:ReturnType<typeof setTimeout>;
    let ui:HTMLElement|undefined, shadow:ShadowRoot|undefined;
    let disposed=false;
    let frameSession:string|undefined;
    let frameZoomReady:((ready:boolean)=>void)|undefined;
    let signals:DetectionSignals={videos:0,customPlayer:false,embedsDisabled:false};
    let noticeCleanup:(()=>void)|undefined;
    let frameCompatibility:((status:string)=>void)|undefined;
    let bindings:{node:HTMLElement;refresh:()=>void}[]=[];
    const t=(key:Message,values:Record<string,string|number>={})=>translate(settings.language,key,values);
    function bind(node:HTMLElement,key:Message|(()=>Message),attribute?:string,values:Record<string,string|number>={}){
      const refresh=()=>{const value=t(typeof key==='function'?key():key,values);if(attribute)node.setAttribute(attribute,value);else node.textContent=value;};
      refresh();bindings.push({node,refresh});
    }
    const token = `sf-${crypto.randomUUID().replaceAll('-','')}`;
    function surface() {
      if(shadow && ui?.isConnected) return shadow;
      ui=document.createElement('div');
      ui.lang=settings.language;
      ui.style.cssText='all:initial!important;position:fixed!important;inset:0!important;pointer-events:none!important;z-index:2147483647!important;';
      shadow=ui.attachShadow({mode:'closed'});
      const style=document.createElement('style');
      style.textContent=overlayStyles;
      shadow.append(style);document.documentElement.append(ui);return shadow;
    }
    function toast(text:Message, force=false) {
      if(!settings.notifications && !force) return;
      const s=surface(); s.querySelector('.toast')?.remove();clearTimeout(toastTimer);
      const el=document.createElement('div');el.className='toast';el.role='status';bind(el,text);s.append(el);
      toastTimer=setTimeout(()=>{el.remove(); if(!active&&!selecting) {ui?.remove();ui=undefined;shadow=undefined;}},3000);
    }
    function runtimeAvailable() {
      try { return !disposed && !!browser.runtime?.id; } catch { return false; }
    }
    function state(value:string) {
      // Chrome can throw synchronously after reload; a Promise.catch alone is insufficient.
      if(!runtimeAvailable()) return;
      try { void browser.runtime.sendMessage({type:'screen-fit:state',state:value}).catch(()=>{}); } catch { /* stale extension context */ }
    }
    function rect(c:Candidate) {
      let r=c.element.getBoundingClientRect(), x=r.left,y=r.top;
      for(const frame of [...c.chain].reverse()) {const f=frame.getBoundingClientRect();x+=f.left+frame.clientLeft;y+=f.top+frame.clientTop;}
      return {left:x,top:y,width:r.width,height:r.height};
    }
    function scan():Candidate[] {
      signals={videos:0,customPlayer:false,embedsDisabled:false};
      const found:Candidate[]=[];
      const handledFrames=new Set<Element>();
      function visit(doc:Document, chain:HTMLIFrameElement[], scope:Document|ShadowRoot=doc) {
        for(const node of scope.querySelectorAll('*')) {
          if(handledFrames.has(node))continue;
          if(node.shadowRoot) visit(doc,chain,node.shadowRoot);
          if(node.tagName==='VIDEO')signals.videos++;
          if(node.tagName==='CANVAS'&&node.closest('[class*="player" i],[id*="player" i],[class*="video" i],[id*="video" i]')){
            const r=node.getBoundingClientRect(),css=doc.defaultView!.getComputedStyle(node);
            if(r.width>=240&&r.height>=135&&r.bottom>0&&r.right>0&&r.top<doc.defaultView!.innerHeight&&r.left<doc.defaultView!.innerWidth&&css.display!=='none'&&css.visibility==='visible'&&css.opacity!=='0')signals.customPlayer=true;
          }
          const custom=node.matches('.openanime-vanilla-player')&&!!node.querySelector('canvas.video-canvas');
          const nestedFrame=node.matches('#videoPlayer.videoSource-player')?node.querySelector<HTMLIFrameElement>('iframe[src]'):null;
          const siteFrame=nestedFrame&&isTrAnimePlayer(doc.location.hostname,nestedFrame.src)?nestedFrame:null;
          if(node.tagName!=='VIDEO'&&node.tagName!=='IFRAME'&&!custom&&!siteFrame) continue;
          const element=node as HTMLElement;
          let requiresConfirmation=false;
          const r=element.getBoundingClientRect(), css=doc.defaultView!.getComputedStyle(element);
          if(r.width<120||r.height<68||css.visibility!=='visible'||css.display==='none'||Number(css.opacity)===0||chain.some(f=>f.getBoundingClientRect().width<120)) continue;
          if(siteFrame&&!settings.embeds){signals.embedsDisabled=true;continue;}
          if(element.tagName==='IFRAME') {
            const frame=element as HTMLIFrameElement;
            try {if(frame.contentDocument?.documentElement) {const count=found.length;visit(frame.contentDocument,[...chain,frame]);if(found.length>count)continue;}} catch { /* cross-origin frame */ }
            let context='';let parent:Element|null=frame;
            for(let i=0;i<4&&parent;i++,parent=parent.parentElement)context+=` ${parent.id} ${parent.getAttribute('class')??''}`;
            const kind=classifyFrame({src:frame.src,title:frame.title,allow:frame.getAttribute('allow')??'',fullscreen:frame.hasAttribute('allowfullscreen')||frame.hasAttribute('webkitallowfullscreen'),width:r.width,height:r.height,context});
            if(!kind)continue;
            if(!settings.embeds){signals.embedsDisabled=true;continue;}
            requiresConfirmation=kind==='possible';
          }
          let root:HTMLElement=element;
          if(element.tagName==='VIDEO') {
            const known=element.closest<HTMLElement>('#movie_player,.html5-video-player,.video-js,.plyr,.jwplayer,[data-plyr-provider]');
            if(known&&(known.matches('#movie_player,.html5-video-player')||known.querySelectorAll('video').length===1)) root=known;
            else {const p=element.parentElement;if(p&&p!==doc.body&&p!==doc.documentElement&&p.querySelectorAll('video').length===1&&p.getBoundingClientRect().width<=r.width*1.2&&p.getBoundingClientRect().height<=r.height*1.4) root=p;}
          }
          const video=element as HTMLVideoElement;
          const c:Candidate={element,root,chain,custom,requiresConfirmation,frame:siteFrame??(element.tagName==='IFRAME'?element as HTMLIFrameElement:undefined),area:r.width*r.height,visibleRatio:1,playing:element.tagName==='VIDEO'&&!video.paused&&!video.ended,duration:video.duration||0,embedded:element.tagName==='IFRAME'||!!siteFrame};
          const global=rect(c);
          let l=Math.max(0,global.left),t=Math.max(0,global.top),right=Math.min(innerWidth,global.left+global.width),bottom=Math.min(innerHeight,global.top+global.height);
          for(const f of chain) {const fr=f.getBoundingClientRect(); if(chain.length===1){l=Math.max(l,fr.left);t=Math.max(t,fr.top);right=Math.min(right,fr.right);bottom=Math.min(bottom,fr.bottom);}}
          c.visibleRatio=Math.max(0,right-l)*Math.max(0,bottom-t)/c.area;
          if(c.visibleRatio>.1) {
            if(siteFrame)handledFrames.add(siteFrame);
            const existing=found.findIndex(item=>item.root===c.root);
            if(existing===-1)found.push(c);
            else if(c.playing&&!found[existing]!.playing)found[existing]=c;
          }
        }
      }
      visit(document,[]);
      const verified=found.filter(c=>!c.requiresConfirmation);
      return verified.length?verified:found;
    }
    function stop(announce=true) {
      noticeCleanup?.();noticeCleanup=undefined;
      bindings=[];
      if(frameSession&&runtimeAvailable()){
        try{void browser.runtime.sendMessage({type:'screen-fit:end-escape',session:frameSession}).catch(()=>{});}catch{/* stale context */}
      }
      frameSession=undefined;
      frameZoomReady=undefined;
      frameCompatibility=undefined;
      pickerCleanup?.();pickerCleanup=undefined;cleanup?.();cleanup=undefined;
      active=false;selecting=false;shadow?.querySelector('.bar')?.remove();state('idle');
      if(announce) toast('Video eski boyutuna döndürüldü.'); else {clearTimeout(toastTimer);ui?.remove();ui=undefined;shadow=undefined;}
    }
    function enter(c:Candidate) {
      noticeCleanup?.();noticeCleanup=undefined;
      bindings=[];
      pickerCleanup?.();pickerCleanup=undefined;selecting=false;
      if(!c.element.isConnected) {toast('Video artık sayfada değil. Tekrar deneyin.',true);state('idle');return;}
      const undos:(()=>void)[]=[];
      const sheets:{style:HTMLStyleElement;base:string;outer:boolean}[]=[];
      let notifyFrameDisplay=()=>{};
      let lastSize=settings.playerSize;
      const scrolls = new Map<Window,{x:number;y:number}>();
      for(const doc of [document,c.root.ownerDocument,...c.chain.map(f=>f.ownerDocument)]) {
        const w=doc.defaultView; if(w)scrolls.set(w,{x:w.scrollX,y:w.scrollY});
      }
      const resizePlayer=()=>{
        if(c.root.matches('#movie_player,.html5-video-player,.openanime-vanilla-player')) {
          for(const w of scrolls.keys())w.dispatchEvent(new Event('resize'));
        }
      };
      const restore=()=>{
        for(const undo of undos.reverse())undo();
        for(const [w,pos] of scrolls)w.scrollTo(pos.x,pos.y);
        resizePlayer();
      };
      const attribute=(el:Element,name:string,value:string)=>{const old=el.getAttribute(name);el.setAttribute(name,value);undos.push(()=>{if(old===null)el.removeAttribute(name);else el.setAttribute(name,old);});};
      try {
        const targets=[...c.chain,c.root];
        const outer=targets[0]!;
        const backdrop=outer.ownerDocument.createElement('div');
        backdrop.setAttribute('data-screen-fit-backdrop',token);
        backdrop.style.cssText='position:fixed!important;inset:0!important;background:#000!important;z-index:2147483645!important;pointer-events:auto!important;';
        outer.parentNode?.appendChild(backdrop);undos.push(()=>backdrop.remove());
        for(const target of targets) {
          const doc=target.ownerDocument;
          const path:Element[]=[];
          for(let p:Element|null=target.parentElement;p;p=p.parentElement??(p.getRootNode() instanceof ShadowRoot?(p.getRootNode() as ShadowRoot).host:null))path.push(p);
          attribute(target,'data-screen-fit-target',token);
          path.forEach(p=>attribute(p,'data-screen-fit-ancestor',token));
          if(target===c.root) attribute(c.element,'data-screen-fit-video',token);
          if(target===c.root&&c.frame&&c.frame!==c.root)attribute(c.frame,'data-screen-fit-player-frame',token);
          const style=doc.createElement('style');
          style.textContent=`[data-screen-fit-ancestor="${token}"]{transform:none!important;translate:none!important;rotate:none!important;scale:none!important;filter:none!important;perspective:none!important;contain:none!important;content-visibility:visible!important;overflow:visible!important;clip-path:none!important;opacity:1!important;isolation:auto!important;z-index:2147483646!important}html[data-screen-fit-ancestor="${token}"],body[data-screen-fit-ancestor="${token}"]{overflow:hidden!important}[data-screen-fit-target="${token}"]{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;min-width:0!important;min-height:0!important;max-width:none!important;max-height:none!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;transform:none!important;z-index:2147483646!important;background:#000!important;box-sizing:border-box!important}[data-screen-fit-target="${token}"] video,[data-screen-fit-video="${token}"]{width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;object-fit:${settings.mode==='fill'?'cover':'contain'}!important;inset:0!important;margin:0!important}[data-screen-fit-target="${token}"] .html5-video-container{position:absolute!important;inset:0!important;width:100%!important;height:100%!important}`;
          if(target.matches('#movie_player,.html5-video-player')) {
            const player=`[data-screen-fit-target="${token}"]`;
            // YouTube writes pixel widths on controls independently of the video.
            // Anchor the full controls row (including time and seek bar) to our viewport.
            style.textContent+=`${player} .ytp-chrome-bottom{left:12px!important;right:12px!important;bottom:0!important;width:calc(100% - 24px)!important;box-sizing:border-box!important}
              ${player} .ytp-chrome-controls{width:100%!important}
              ${player} .ytp-progress-bar-container{left:0!important;right:0!important;width:100%!important}
              ${player} .ytp-chrome-top{left:12px!important;right:12px!important;width:calc(100% - 24px)!important}
              ${player} .ytp-gradient-bottom,${player} .ytp-gradient-top{left:0!important;right:0!important;width:100%!important}
              ${player} .ytp-cued-thumbnail-overlay{width:100%!important;height:100%!important}`;
          }
          if(c.custom&&target===c.root) {
            const player=`[data-screen-fit-target="${token}"]`;
            style.textContent+=`${player}{aspect-ratio:auto!important}
              ${player} .left-side{height:100%!important;min-width:0!important;flex:1 1 auto!important}
              ${player} .main-graphics{width:100%!important;height:100%!important}
              ${player} canvas.video-canvas,${player} canvas.subtitle-canvas{width:100%!important;height:100%!important;object-fit:${settings.mode==='fill'?'cover':'contain'}!important}`;
          }
          if(c.frame&&c.frame!==c.root&&target===c.root) {
            style.textContent+=`[data-screen-fit-player-frame="${token}"]{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;border:0!important;margin:0!important}`;
          }
          const scopes=new Set<Node>([doc.head??doc.documentElement,target.getRootNode(),...path.map(p=>p.getRootNode())]);
          for(const scope of scopes) {if(scope.nodeType===9)continue;const copy=style.cloneNode(true) as HTMLStyleElement;const base=style.textContent??'';copy.textContent=base+displayCss(token,settings.mode,settings.zoom,settings.playerSize,target===outer);scope.appendChild(copy);sheets.push({style:copy,base,outer:target===outer});undos.push(()=>copy.remove());}

        }
        active=true;state('active');
        const s=surface(),bar=document.createElement('div');bar.className='bar';bar.role='toolbar';bar.setAttribute('aria-label','Screen Fit');
        const brand=document.createElement('div');brand.className='toolbar-brand';const mark=document.createElement('span');mark.className='brand-mark';mark.append(overlayIcon('brand'));const name=document.createElement('span');name.className='brand-name';name.textContent='Screen Fit';brand.append(mark,name);bar.append(brand);
        bar.addEventListener('keydown',event=>{if(event.key!=='Escape')event.stopPropagation();});
        bar.dataset.screenFitToolbar='';
        bar.style.transition='opacity 180ms ease, visibility 180ms ease';
        const modes=document.createElement('div');modes.className='mode-switch';
        const fit=document.createElement('button');fit.type='button';fit.append(overlayIcon('fit'),document.createTextNode('Fit'));bind(fit,'Fit · Sığdır','aria-label');bind(fit,'Fit · Sığdır','title');
        const fill=document.createElement('button');fill.type='button';fill.append(overlayIcon('fill'),document.createTextNode('Fill'));bind(fill,'Fill · Doldur','aria-label');bind(fill,'Fill · Doldur','title');modes.append(fit,fill);bar.append(modes);
        const syncMode=()=>{fit.setAttribute('aria-pressed',String(settings.mode==='fit'));fill.setAttribute('aria-pressed',String(settings.mode==='fill'));};syncMode();
        const applyDisplay=()=>{
          for(const sheet of sheets)sheet.style.textContent=sheet.base+displayCss(token,settings.mode,settings.zoom,settings.playerSize,sheet.outer);
          syncMode();
          if(lastSize!==settings.playerSize){lastSize=settings.playerSize;resizePlayer();}
          notifyFrameDisplay();
        };
        fit.onclick=()=>{settings={...settings,mode:'fit'};applyDisplay();};fill.onclick=()=>{settings={...settings,mode:'fill'};applyDisplay();};
        const scaleInputs:{key:'zoom'|'playerSize';range:HTMLInputElement;number:HTMLInputElement;sync:()=>void}[]=[];
        const addScale=(key:'zoom'|'playerSize',label:Message,max:number)=>{
          const group=document.createElement('div');group.className='scale-field';group.dataset.scale=key;
          const head=document.createElement('div');head.className='scale-head';const text=document.createElement('label');text.className='scale-name';bind(text,label);
          const range=document.createElement('input');range.className='scale-range';range.id=`${token}-${key}`;text.htmlFor=range.id;range.type='range';range.min='25';range.max=String(max);range.step='1';range.value=String(settings[key]);bind(range,label,'aria-label');
          const valueBox=document.createElement('div');valueBox.className='scale-value';
          const number=document.createElement('input');number.type='number';number.min='25';number.max=String(max);number.step='1';number.value=range.value;bind(number,key==='zoom'?'Görüntü yüzdesi':'Oynatıcı yüzdesi','aria-label');
          const unit=document.createElement('span');unit.className='scale-unit';unit.textContent='%';unit.setAttribute('aria-hidden','true');
          const arrows=document.createElement('div');arrows.className='stepper';
          const up=document.createElement('button');up.type='button';up.append(overlayIcon('up'));const upLabel:Message=key==='zoom'?'Görüntüyü artır':'Oynatıcı boyutunu artır';bind(up,upLabel,'aria-label');bind(up,upLabel,'title');
          const down=document.createElement('button');down.type='button';down.append(overlayIcon('down'));const downLabel:Message=key==='zoom'?'Görüntüyü azalt':'Oynatıcı boyutunu azalt';bind(down,downLabel,'aria-label');bind(down,downLabel,'title');
          const sync=()=>{range.value=String(settings[key]);number.value=range.value;range.style.setProperty('--range-progress',`${(settings[key]-25)/(max-25)*100}%`);up.disabled=range.disabled||settings[key]>=max;down.disabled=range.disabled||settings[key]<=25;group.dataset.disabled=String(range.disabled);};
          const commit=(value:number)=>{settings={...settings,[key]:percent(value,25,max)};sync();applyDisplay();};
          up.onclick=()=>commit(settings[key]+1);down.onclick=()=>commit(settings[key]-1);
          range.oninput=()=>commit(range.valueAsNumber);number.onchange=()=>commit(number.valueAsNumber);number.onkeydown=e=>{if(e.key==='Enter')number.blur();};
          arrows.append(up,down);valueBox.append(number,unit,arrows);head.append(text,valueBox);group.append(head,range);bar.append(group);scaleInputs.push({key,range,number,sync});sync();
        };
        addScale('zoom','Görüntü',300);addScale('playerSize','Oynatıcı',100);
        const zoomInputs=scaleInputs[0]!;
        const supportsZoom=CSS.supports('object-view-box','inset(10%)');
        let imageReady=!c.embedded;
        const zoomHint=():Message=>!supportsZoom?'Bu tarayıcıda görüntü ölçeği desteklenmiyor.':imageReady?'Görüntüyü yakınlaştır / uzaklaştır':'Gömülü görüntü ölçeği için oynatıcı erişimini etkinleştirin.';
        bind(zoomInputs.range.parentElement!,zoomHint,'title');
        frameZoomReady=(ready:boolean)=>{imageReady=ready;zoomInputs.range.disabled=!ready||!supportsZoom;zoomInputs.number.disabled=!ready||!supportsZoom;zoomInputs.range.parentElement!.title=t(zoomHint());zoomInputs.sync();};
        frameZoomReady(!c.embedded);
        const actions=document.createElement('div');actions.className='toolbar-actions';
        const reset=document.createElement('button');reset.type='button';reset.className='reset-button';reset.append(overlayIcon('reset'));bind(reset,'Ölçekleri yüzde 100 yap','aria-label');bind(reset,'Ölçekleri yüzde 100 yap','title');reset.onclick=()=>{settings={...settings,zoom:100,playerSize:100};for(const input of scaleInputs)input.sync();applyDisplay();};
        const exit=document.createElement('button');exit.type='button';exit.className='exit-button';bind(exit,'Çık · Esc','aria-label');const exitText=document.createElement('span');bind(exitText,'Çık');const shortcut=document.createElement('kbd');shortcut.textContent='Esc';shortcut.setAttribute('aria-hidden','true');exit.append(overlayIcon('close'),exitText,shortcut);exit.onclick=()=>stop();actions.append(reset,exit);bar.append(actions);s.append(bar);
        const docs=new Set([document,...c.chain.map(f=>f.contentDocument).filter((d):d is Document=>!!d),c.root.ownerDocument]);
        let hideTimer:ReturnType<typeof setTimeout>;
        let toolbarHovered=false;
        const reveal=()=>{
          clearTimeout(hideTimer);
          bar.style.opacity='1';bar.style.visibility='visible';bar.style.pointerEvents='auto';
          bar.setAttribute('aria-hidden','false');
          hideTimer=setTimeout(()=>{
            if(toolbarHovered||bar.matches(':focus-within'))return;
            bar.style.opacity='0';bar.style.visibility='hidden';bar.style.pointerEvents='none';
            bar.setAttribute('aria-hidden','true');
          },2200);
        };
        const keyboardActivity=(event:KeyboardEvent)=>{if(event.key==='Tab')reveal();};
        for(const doc of docs) {
          doc.addEventListener('pointermove',reveal,{passive:true});
          doc.addEventListener('pointerdown',reveal,{passive:true});
          doc.addEventListener('keydown',keyboardActivity,true);
          undos.push(()=>{doc.removeEventListener('pointermove',reveal);doc.removeEventListener('pointerdown',reveal);doc.removeEventListener('keydown',keyboardActivity,true);});
        }
        bar.addEventListener('pointerenter',()=>{toolbarHovered=true;clearTimeout(hideTimer);});
        bar.addEventListener('pointerleave',()=>{toolbarHovered=false;reveal();});
        bar.addEventListener('focusout',reveal);reveal();
        if(c.embedded) {
          // Pointer events inside a cross-origin iframe cannot bubble to this document.
          const edge=document.createElement('button');bind(edge,'Screen Fit kontrollerini göster','aria-label');
          edge.style.cssText='position:fixed;top:0;left:0;width:100%;height:10px;padding:0;border:0;border-radius:0;background:transparent;pointer-events:auto;cursor:default';
          edge.addEventListener('pointerenter',reveal);edge.addEventListener('focus',reveal);s.append(edge);
          undos.push(()=>edge.remove());
        }
        undos.push(()=>clearTimeout(hideTimer));
        const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();stop();}};
        docs.forEach(d=>{d.addEventListener('keydown',key,true);undos.push(()=>d.removeEventListener('keydown',key,true));});
        const url=location.href;
        const timer=setInterval(()=>{if(!runtimeAvailable()){ctx.notifyInvalidated();return;}if(!c.element.isConnected||(c.frame&&!c.frame.isConnected)||location.href!==url)stop(false);},500);undos.push(()=>clearInterval(timer));
        cleanup=restore;
        resizePlayer();
        if(c.frame&&runtimeAvailable()) {
          const session=crypto.randomUUID();frameSession=session;
          let displayTimer:ReturnType<typeof setTimeout>;
          notifyFrameDisplay=()=>{clearTimeout(displayTimer);displayTimer=setTimeout(()=>{if(frameSession!==session||!active||!runtimeAvailable())return;try{void browser.runtime.sendMessage({type:'screen-fit:frame-display',session,zoom:settings.zoom,mode:settings.mode}).catch(()=>{});}catch{/* detached context */}},80);};
          undos.push(()=>clearTimeout(displayTimer));
          const row=document.createElement('div');row.className='compatibility-row';row.setAttribute('role','status');row.hidden=true;
          const note=document.createElement('span');note.className='compatibility-hint';
          let accessStatus='checking';
          bind(note,()=>accessStatus==='permission-required'?'Görüntü ölçeği ve iframe içinde Esc için oynatıcı erişimi gerekiyor.':accessStatus==='error'?'Oynatıcı erişim durumu alınamadı. Çık düğmesini kullanabilir veya tekrar deneyebilirsiniz.':'İç oynatıcıya tam erişim sağlanamadı. Dış boyut ayarı ve Çık düğmesi kullanılabilir.');
          const access=document.createElement('button');access.type='button';access.className='access-button';access.dataset.screenFitEscapeAccess='';access.append(overlayIcon('access'));const accessText=document.createElement('span');access.append(accessText);
          bind(accessText,'Oynatıcı erişimini etkinleştir');bind(access,'Oynatıcı erişimini etkinleştir','aria-label');
          row.append(note,access);bar.append(row);
          frameCompatibility=(status:string)=>{accessStatus=status;row.hidden=status==='ready'||status==='checking'||status==='expired';access.hidden=status!=='permission-required';note.textContent=t(status==='permission-required'?'Görüntü ölçeği ve iframe içinde Esc için oynatıcı erişimi gerekiyor.':status==='error'?'Oynatıcı erişim durumu alınamadı. Çık düğmesini kullanabilir veya tekrar deneyebilirsiniz.':'İç oynatıcıya tam erişim sağlanamadı. Dış boyut ayarı ve Çık düğmesi kullanılabilir.');};
          access.onclick=()=>{try{void browser.runtime.sendMessage({type:'screen-fit:open-frame-access',session}).catch(()=>toast('Erişim sayfası açılamadı.',true));}catch{/* context detached */}};
          try {
            void browser.runtime.sendMessage({type:'screen-fit:prepare-escape',session,src:c.frame.src,zoom:settings.zoom,mode:settings.mode}).then(reply=>{
              if(!active||frameSession!==session)return;
              frameZoomReady?.(reply?.status==='ready'||reply?.status==='partial');
              if(reply?.status)frameCompatibility?.(reply.status);
            }).catch(()=>{if(active&&frameSession===session)frameCompatibility?.('error');});
          }catch{/* context detached */}
        }
        toast(c.embedded?'Gömülü oynatıcı büyütüldü. İç görüntü modu oynatıcıya bağlıdır.':'Video büyütüldü. Esc ile çıkabilirsiniz.');
      } catch {restore();active=false;shadow?.querySelector('.bar')?.remove();state('idle');compatibilityNotice('expand-failed');}
    }
    function compatibilityNotice(reason:CompatibilityReason){
      noticeCleanup?.();noticeCleanup=undefined;bindings=[];
      const messages:Record<CompatibilityReason,[Message,Message]>={
        'no-video':['Video bulunamadı','Bu sayfada uygun video algılanamadı. Videoyu başlatıp yeniden deneyin.'],
        'not-visible':['Video henüz görünür değil','Videoyu başlatın veya oynatıcıyı ekrana getirip yeniden deneyin.'],
        'embeds-disabled':['Gömülü oynatıcı algılama kapalı','Sayfada gömülü bir oynatıcı alanı var. Ayarlardan gömülü oynatıcıları açıp yeniden deneyin.'],
        'custom-player':['Özel oynatıcı olabilir','Görünür bir oynatıcı alanı var, ancak uygun video algılanamadı. Bu oynatıcı türü henüz desteklenmeyebilir.'],
        'expand-failed':['Video büyütülemedi','Site oynatıcı düzenini değiştirmiş olabilir. Videoyu başlatıp yeniden deneyin.'],
      };
      const s=surface();s.querySelector('.toast')?.remove();clearTimeout(toastTimer);
      const card=document.createElement('section');card.className='compatibility-card';card.dataset.reason=reason;card.setAttribute('role','status');
      const head=document.createElement('div');head.className='compatibility-head';const title=document.createElement('strong');bind(title,messages[reason][0]);
      const close=document.createElement('button');close.type='button';close.className='reset-button';bind(close,'Uyumluluk mesajını kapat','aria-label');close.append(overlayIcon('close'));head.append(title,close);
      const detail=document.createElement('p');bind(detail,messages[reason][1]);
      const actions=document.createElement('div');actions.className='compatibility-actions';const retry=document.createElement('button');retry.type='button';bind(retry,'Yeniden dene');actions.append(retry);
      if(reason==='embeds-disabled'){const options=document.createElement('button');options.type='button';bind(options,'Ayarları aç');options.onclick=()=>{try{void browser.runtime.sendMessage({type:'screen-fit:open-options'}).catch(()=>{});}catch{/* detached context */}};actions.append(options);}
      card.append(head,detail,actions);s.append(card);
      const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();dismiss();}};
      const timer=setTimeout(()=>dismiss(),15000);
      const cleanup=()=>{clearTimeout(timer);card.remove();document.removeEventListener('keydown',key,true);if(!active&&!selecting){ui?.remove();ui=undefined;shadow=undefined;}};
      const dismiss=()=>{cleanup();noticeCleanup=undefined;};
      close.onclick=dismiss;retry.onclick=()=>{dismiss();void onMessage({type:'screen-fit:toggle'});};document.addEventListener('keydown',key,true);noticeCleanup=cleanup;
    }
    function pick(candidates:Candidate[]) {
      bindings=[];
      selecting=true;state('selecting');const s=surface();
      const nodes:HTMLElement[]=[];
      const previousFocus=document.activeElement;
      const backdrop=document.createElement('div');backdrop.style.cssText='position:fixed;inset:0;pointer-events:auto;background:#0003';s.append(backdrop);nodes.push(backdrop);
      const bar=document.createElement('div');bar.className='bar';const caption=document.createElement('span');bind(caption,'Büyütmek istediğiniz oynatıcıyı seçin');const cancel=document.createElement('button');bind(cancel,'İptal · Esc');cancel.onclick=()=>stop(false);bar.append(caption,cancel);s.append(bar);nodes.push(bar);
      const buttons=candidates.map((c,i)=>{const b=document.createElement('button');b.className='pick';bind(b,'Video {number} seç','aria-label',{number:i+1});b.style.border=`${settings.thickness}px solid ${settings.color}`;const label=document.createElement('span');label.className='label';const name=document.createElement('span');bind(name,c.embedded?'Gömülü video':c.playing?'Oynatılıyor':'Video');label.append(document.createTextNode(`${i+1} · `),name);b.append(label);b.onclick=e=>{e.preventDefault();e.stopPropagation();enter(c);};s.append(b);nodes.push(b);return b;});
      let frame=0;
      const update=()=>{candidates.forEach((c,i)=>{const r=rect(c),b=buttons[i]!;Object.assign(b.style,{left:`${Math.max(0,r.left)}px`,top:`${Math.max(0,r.top)}px`,width:`${Math.max(0,Math.min(innerWidth,r.left+r.width)-Math.max(0,r.left))}px`,height:`${Math.max(0,Math.min(innerHeight,r.top+r.height)-Math.max(0,r.top))}px`});b.hidden=!c.element.isConnected;});frame=requestAnimationFrame(update);};update();
      const block=(e:Event)=>{if(!e.composedPath().includes(ui!)){e.preventDefault();e.stopImmediatePropagation();}};
      const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();stop(false);}else if(!['Tab','Enter',' '].includes(e.key))block(e);};
      document.addEventListener('pointerdown',block,true);document.addEventListener('click',block,true);document.addEventListener('keydown',key,true);
      buttons[0]?.focus();
      pickerCleanup=()=>{cancelAnimationFrame(frame);nodes.forEach(n=>n.remove());document.removeEventListener('pointerdown',block,true);document.removeEventListener('click',block,true);document.removeEventListener('keydown',key,true);selecting=false;if(previousFocus instanceof HTMLElement)previousFocus.focus({preventScroll:true});};
      toast(candidates.length>1?'Birden fazla oynatıcı bulundu. İzlemek istediğinizi seçin.':'Gömülü alan bulundu. Video oynatıcısını seçerek büyütün.');
    }
    const onMessage=async (message:{type?:string;manual?:boolean;session?:string;status?:string})=>{
      if(disposed)return;
      if(message?.type==='screen-fit:exit') {if(active&&message.session===frameSession)stop();return;}
      if(message?.type==='screen-fit:escape-status') {if(message.session===frameSession){frameZoomReady?.(message.status==='ready'||message.status==='partial');if(message.status)frameCompatibility?.(message.status);}return;}
      if(message?.type==='screen-fit:ping')return {ready:true};
      if(message?.type!=='screen-fit:toggle')return;
      if(active||selecting){stop(active);return;}
      noticeCleanup?.();noticeCleanup=undefined;
      try {
        if(!runtimeAvailable()){ctx.notifyInvalidated();return;}
        settings=normalizeSettings((await browser.storage.local.get('settings')).settings);
      } catch {
        if(!runtimeAvailable()){ctx.notifyInvalidated();return;}
        toast('Ayarlar okunamadı. Lütfen tekrar deneyin.',true);return;
      }
      if(disposed||!runtimeAvailable())return;
      const candidates=scan();
      if(!candidates.length){state('idle');compatibilityNotice(noCandidateReason(signals));return;}
      const selected=choose(candidates,message.manual?'manual':settings.selection);
      if(selected&&!selected.requiresConfirmation)enter(selected);else pick(candidates);
    };
    browser.runtime.onMessage.addListener(onMessage);
    const languageChanged=(changes:Record<string,{newValue?:unknown}>,area:string)=>{
      if(area!=='local'||!changes.settings||disposed)return;
      settings={...settings,language:normalizeSettings(changes.settings.newValue).language};
      if(ui)ui.lang=settings.language;
      bindings=bindings.filter(binding=>binding.node.isConnected);for(const binding of bindings)binding.refresh();
    };
    browser.storage.onChanged?.addListener(languageChanged);
    const pagehide=()=>stop(false);
    addEventListener('pagehide',pagehide);
    ctx.onInvalidated(()=>{
      disposed=true;stop(false);delete win.__screenFit;
      removeEventListener('pagehide',pagehide);
      try{browser.storage.onChanged?.removeListener(languageChanged);}catch{/* context detached */}
      try {browser.runtime.onMessage.removeListener(onMessage);} catch { /* context already detached */ }
    });
  },
});
