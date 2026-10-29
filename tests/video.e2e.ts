import {browserPath} from './browser-path';
import {test,expect,chromium,type BrowserContext,type Page} from '@playwright/test';
import path from 'node:path';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import sharp from 'sharp';
let context:BrowserContext, profile:string;
test.beforeAll(async()=>{profile=await mkdtemp(path.join(os.tmpdir(),'screen-fit-'));context=await chromium.launchPersistentContext(profile,{executablePath:browserPath,headless:true,args:['--disable-extensions-except='+path.resolve('.output/chrome-mv3'),'--load-extension='+path.resolve('.output/chrome-mv3')],viewport:{width:1440,height:1100}});});
test.afterAll(async()=>{await context?.close();await rm(profile,{recursive:true,force:true});});
async function setup(page:Page,body:string,settings:object={}){
 await page.goto('http://127.0.0.1:4178');
 await page.setContent(`<style>body{margin:0;height:2000px}video{display:block;width:640px;height:360px;background:#25382d}button{padding:10px}</style>${body}`);
 await page.evaluate(s=>{
   const attach=Element.prototype.attachShadow;
   Element.prototype.attachShadow=function(init){const root=attach.call(this,init);(window as any).__testShadow=root;return root;};
   const listeners:((m:unknown)=>unknown)[]=[];
   (window as any).chrome={runtime:{id:'fixture',getURL:(s:string)=>s,onMessage:{addListener:(fn:any)=>listeners.push(fn),removeListener:(fn:any)=>{const i=listeners.indexOf(fn);if(i>=0)listeners.splice(i,1);}},sendMessage:async()=>{}},storage:{local:{get:async()=>({settings:s})}}};
   (window as any).toggle=(manual=false)=>Promise.all(listeners.map(fn=>fn({type:'screen-fit:toggle',manual})));
 },settings);
 await page.addScriptTag({path:'.output/chrome-mv3/content-scripts/video.js'});
}
const toggle=(p:Page,manual=false)=>p.evaluate(m=>(window as any).toggle(m),manual);
const setScale=(p:Page,name:string,value:number)=>p.evaluate(({name,value})=>{const input=(window as any).__testShadow.querySelector(`input[type="range"][aria-label="${name}"]`);input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));},{name,value});
test('modern toolbar has custom steppers, editable percentages, keyboard support and responsive layout',async()=>{
 const p=await context.newPage();await p.setViewportSize({width:1440,height:900});await setup(p,'<video controls></video>');
 await p.locator('video').evaluate(v=>{
  const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;const ctx=canvas.getContext('2d')!,sky=ctx.createLinearGradient(0,0,0,720);sky.addColorStop(0,'#153336');sky.addColorStop(.6,'#416657');sky.addColorStop(1,'#a2b18a');ctx.fillStyle=sky;ctx.fillRect(0,0,1280,720);ctx.fillStyle='#d6e6b5';ctx.beginPath();ctx.arc(1010,155,46,0,Math.PI*2);ctx.fill();
  for(const [points,color]of [[[[0,560],[270,205],[520,480],[800,270],[1280,610],[1280,720],[0,720]],'#284c43'],[[[0,720],[0,630],[390,355],[650,660],[990,465],[1280,690],[1280,720]],'#173b35']] as const){ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();}
  (v as HTMLVideoElement).poster=canvas.toDataURL();
 });
 await toggle(p);
 const click=(name:string)=>p.evaluate(name=>(window as any).__testShadow.querySelector(`button[aria-label="${name}"]`).click(),name);
 const value=()=>p.evaluate(()=>(window as any).__testShadow.querySelector('input[type=range][aria-label="Görüntü"]').value);
 const disabled=(name:string)=>p.evaluate(name=>(window as any).__testShadow.querySelector(`button[aria-label="${name}"]`).disabled,name);
 expect(await disabled('Oynatıcı boyutunu artır')).toBe(true);
 await p.evaluate(()=>{const input=(window as any).__testShadow.querySelector('input[type=number][aria-label="Görüntü yüzdesi"]');input.focus();input.select();});await p.keyboard.type('137');await p.keyboard.press('Enter');expect(await value()).toBe('137');
 await click('Görüntüyü artır');expect(await value()).toBe('138');
 await p.evaluate(()=>(window as any).__testShadow.querySelector('button[aria-label="Görüntüyü azalt"]').focus());await p.keyboard.press('Enter');expect(await value()).toBe('137');
 expect(await p.evaluate(()=>getComputedStyle((window as any).__testShadow.querySelector('input[type=number]')).getPropertyValue('appearance'))).toBe('textfield');
 await setScale(p,'Görüntü',25);expect(await disabled('Görüntüyü azalt')).toBe(true);await setScale(p,'Görüntü',300);expect(await disabled('Görüntüyü artır')).toBe(true);
 await click('Fill · Doldur');expect(await p.locator('video').evaluate(v=>getComputedStyle(v).objectFit)).toBe('cover');await click('Fit · Sığdır');
 await click('Ölçekleri yüzde 100 yap');expect(await value()).toBe('100');await setScale(p,'Görüntü',137);await setScale(p,'Oynatıcı',83);
 const box=()=>p.evaluate(()=>{const r=(window as any).__testShadow.querySelector('[data-screen-fit-toolbar]').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};});
 const desktop=await box();expect(desktop.height).toBeLessThan(110);expect(desktop.x).toBeGreaterThanOrEqual(16);
 await p.mouse.move(desktop.x+desktop.width/2,desktop.y+desktop.height/2);await p.screenshot({path:'artifacts/toolbar-preview-full.png'});await p.screenshot({path:'artifacts/toolbar-preview.png',clip:{x:desktop.x-10,y:desktop.y-10,width:desktop.width+20,height:desktop.height+20}});
 await p.setViewportSize({width:390,height:844});const mobile=await box();expect(mobile.x).toBeGreaterThanOrEqual(15);expect(mobile.width).toBeLessThanOrEqual(360);expect(await p.evaluate(()=>{const b=(window as any).__testShadow.querySelector('[data-screen-fit-toolbar]');return b.scrollWidth<=b.clientWidth;})).toBe(true);await p.screenshot({path:'artifacts/toolbar-mobile.png'});
 await p.keyboard.press('Escape');await expect(p.locator('[data-screen-fit-target]')).toHaveCount(0);await p.close();
});
test('English manual picker and no-video notification use the saved language',async()=>{
 const p=await context.newPage();await setup(p,'<video></video><video></video>',{language:'en',selection:'manual'});await toggle(p);
 expect(await p.evaluate(()=>(window as any).__testShadow.querySelector('.bar').textContent)).toContain('Select the player you want to expand');
 expect(await p.evaluate(()=>(window as any).__testShadow.querySelector('.pick').getAttribute('aria-label'))).toBe('Select video 1');
 await p.keyboard.press('Escape');await expect(p.locator('[data-screen-fit-target]')).toHaveCount(0);
 await setup(p,'',{language:'en',notifications:false});await toggle(p);
 expect(await p.evaluate(()=>(window as any).__testShadow.querySelector('.compatibility-card').dataset.reason)).toBe('no-video');expect(await p.evaluate(()=>(window as any).__testShadow.querySelector('.compatibility-card').textContent)).toContain('No suitable video was detected on this page.');
 const card=await p.evaluate(()=>{const r=(window as any).__testShadow.querySelector('.compatibility-card').getBoundingClientRect();return {x:r.x-8,y:r.y-8,width:r.width+16,height:r.height+16};});await p.screenshot({path:'artifacts/compatibility-no-video.png',clip:card});await p.close();
});
test('compatibility cards distinguish visibility, custom players and disabled embeds, with retry and dismissal',async()=>{
 const p=await context.newPage();await setup(p,'<video style="position:absolute;top:2500px"></video>');await toggle(p);
 const reason=()=>p.evaluate(()=>(window as any).__testShadow.querySelector('.compatibility-card')?.dataset.reason);
 expect(await reason()).toBe('not-visible');await p.keyboard.press('Escape');expect(await reason()).toBeUndefined();
 await setup(p,'<div class="custom-player"><canvas width="640" height="360"></canvas></div>');await toggle(p);expect(await reason()).toBe('custom-player');
 await p.evaluate(()=>{const video=document.createElement('video');video.controls=true;document.body.prepend(video);(window as any).__testShadow.querySelector('.compatibility-actions button').click();});await expect(p.locator('[data-screen-fit-target]')).toHaveCount(1);await p.keyboard.press('Escape');
 await p.route('http://external-media.test/**',route=>route.fulfill({contentType:'text/html',body:'<video></video>'}));await setup(p,'<iframe allowfullscreen src="http://external-media.test/player" style="width:800px;height:450px"></iframe>',{embeds:false});await p.frameLocator('iframe').locator('video').waitFor();await toggle(p);expect(await reason()).toBe('embeds-disabled');
 await p.evaluate(()=>{(window as any).__messages=[];(window as any).chrome.runtime.sendMessage=async(message:unknown)=>{(window as any).__messages.push(message);};const buttons=[...(window as any).__testShadow.querySelectorAll('.compatibility-actions button')] as HTMLButtonElement[];buttons.find(b=>b.textContent==='Ayarları aç')!.click();});
 expect(await p.evaluate(()=>(window as any).__messages)).toContainEqual({type:'screen-fit:open-options'});
 await p.screenshot({path:'artifacts/compatibility-disabled-embeds.png'});await p.keyboard.press('Escape');await p.close();
});
test('content zoom renders independently of native controls and centered player size',async()=>{
 const p=await context.newPage();await setup(p,'<video controls muted loop></video>');
 await p.evaluate(async()=>{
  const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;const ctx=canvas.getContext('2d')!;
  ctx.fillStyle='#ff0000';ctx.fillRect(0,0,320,180);ctx.fillStyle='#0000ff';ctx.fillRect(80,45,160,90);
  const stream=canvas.captureStream(20),recorder=new MediaRecorder(stream,{mimeType:'video/webm'}),chunks:BlobPart[]=[];recorder.ondataavailable=e=>chunks.push(e.data);
  const done=new Promise<void>(r=>recorder.onstop=()=>r());recorder.start(100);let phase=0;const redraw=setInterval(()=>{ctx.fillStyle=++phase%2?'#00ff00':'#ff0000';ctx.fillRect(0,0,2,2);},50);await new Promise(r=>setTimeout(r,1200));recorder.stop();await done;clearInterval(redraw);stream.getTracks().forEach(t=>t.stop());
  const v=document.querySelector('video')!;v.src=URL.createObjectURL(new Blob(chunks,{type:'video/webm'}));await v.play();await new Promise<void>(resolve=>v.requestVideoFrameCallback(()=>resolve()));await new Promise(r=>setTimeout(r,150));v.pause();
  (window as any).__loads=0;for(const event of ['emptied','loadstart','loadedmetadata'])v.addEventListener(event,()=>{(window as any).__loads++;});
 });
 const before=await p.locator('video').evaluate(v=>({src:(v as HTMLVideoElement).src,time:(v as HTMLVideoElement).currentTime,controls:(v as HTMLVideoElement).controls}));
 await toggle(p);const normal=await sharp(await p.screenshot()).raw().toBuffer({resolveWithObject:true});const index=(550*normal.info.width+150)*normal.info.channels;expect(normal.data[index]!).toBeGreaterThan(180);expect(normal.data[index+2]!).toBeLessThan(60);
 await setScale(p,'Görüntü',200);await setScale(p,'Oynatıcı',80);
 const rect=await p.locator('video').evaluate(v=>({x:v.getBoundingClientRect().x,y:v.getBoundingClientRect().y,w:v.getBoundingClientRect().width,h:v.getBoundingClientRect().height,box:getComputedStyle(v).getPropertyValue('object-view-box')}));
 expect(rect).toEqual({x:144,y:110,w:1152,h:880,box:'inset(25%)'});
 const zoomed=await sharp(await p.screenshot({path:'artifacts/custom-scale-preview.png'})).raw().toBuffer({resolveWithObject:true});const z=(550*zoomed.info.width+200)*zoomed.info.channels;expect(zoomed.data[z+2]!).toBeGreaterThan(180);expect(zoomed.data[z]!).toBeLessThan(60);
 expect(await p.locator('video').evaluate(v=>({src:(v as HTMLVideoElement).src,time:(v as HTMLVideoElement).currentTime,controls:(v as HTMLVideoElement).controls}))).toEqual(before);expect(await p.evaluate(()=>(window as any).__loads)).toBe(0);
 await p.evaluate(()=>(window as any).__testShadow.querySelector('button[aria-label="Ölçekleri yüzde 100 yap"]').click());expect(await p.locator('video').evaluate(v=>v.getBoundingClientRect().width)).toBe(1440);
 await p.keyboard.press('Escape');await expect(p.locator('[data-screen-fit-target]')).toHaveCount(0);await expect(p.locator('[data-screen-fit-backdrop]')).toHaveCount(0);expect(await p.locator('video').evaluate(v=>getComputedStyle(v).getPropertyValue('object-view-box'))).toBe('none');await p.close();
});
test('other fullscreen iframe providers expand without reloading; edge reveals toolbar',async()=>{
 const p=await context.newPage();await p.route('http://external-media.test/**',route=>route.fulfill({contentType:'text/html',body:'<video controls style="width:100%;height:100%"></video>'}));
 await setup(p,'<div id="player-container"><iframe allowfullscreen src="http://external-media.test/watch/abc" style="width:800px;height:450px"></iframe></div>');
 await p.frameLocator('iframe').locator('video').waitFor();const frame=p.frames()[1]!;await frame.evaluate(()=>{(window as any).originalPlayer=true;});
 await toggle(p);await expect(p.locator('iframe')).toHaveAttribute('data-screen-fit-target',/sf-/);
 expect(await p.locator('iframe').evaluate(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height}))).toEqual({w:1440,h:1100});
 expect(await frame.evaluate(()=>(window as any).originalPlayer)).toBe(true);
 const hidden=()=>p.evaluate(()=>(window as any).__testShadow.querySelector('[data-screen-fit-toolbar]').getAttribute('aria-hidden'));
 await p.mouse.move(700,500);await expect.poll(hidden,{timeout:4500}).toBe('true');await p.mouse.move(700,5);await expect.poll(hidden).toBe('false');
 await toggle(p);await expect(p.locator('[data-screen-fit-target]')).toHaveCount(0);expect(await frame.evaluate(()=>(window as any).originalPlayer)).toBe(true);await p.close();
});
test('unknown large frames require selection and embeds setting disables them',async()=>{
 const p=await context.newPage();await p.route('http://external-media.test/**',route=>route.fulfill({contentType:'text/html',body:'<p>Embedded player</p>'}));
 await setup(p,'<iframe src="http://external-media.test/watch/abc" style="width:800px;height:450px"></iframe>');await p.frameLocator('iframe').locator('p').waitFor();
 await toggle(p);await expect(p.locator('[data-screen-fit-target]')).toHaveCount(0);await p.evaluate(()=>(window as any).__testShadow.querySelector('.pick').click());await expect(p.locator('iframe')).toHaveAttribute('data-screen-fit-target',/sf-/);await toggle(p);
 await setup(p,'<iframe allowfullscreen src="http://external-media.test/watch/abc" style="width:800px;height:450px"></iframe>',{embeds:false});await p.frameLocator('iframe').locator('p').waitFor();await toggle(p);await expect(p.locator('[data-screen-fit-target]')).toHaveCount(0);await p.close();
});
test('OpenAnime canvas player expands as one unit while backing video stays untouched',async()=>{
 const p=await context.newPage();await setup(p,'<div class="openanime-vanilla-player" style="width:800px;height:450px;position:relative"><div class="left-side"><div class="subtitles">Altyazı</div><div class="main-graphics"><canvas class="video-canvas" width="800" height="450"></canvas><canvas class="subtitle-canvas" width="800" height="450"></canvas></div><button>Oynat</button></div></div><video id="backing" style="position:absolute;top:2000px"></video>');
 const original=await p.locator('#backing').getAttribute('style');await toggle(p);await expect(p.locator('.openanime-vanilla-player')).toHaveAttribute('data-screen-fit-target',/sf-/);
 expect(await p.locator('.video-canvas').evaluate(c=>c.getBoundingClientRect().width)).toBe(1440);expect(await p.locator('#backing').getAttribute('style')).toBe(original);await expect(p.locator('.subtitles')).toBeVisible();
 await p.keyboard.press('Escape');await expect(p.locator('[data-screen-fit-target]')).toHaveCount(0);expect(await p.locator('.openanime-vanilla-player').evaluate(e=>e.getBoundingClientRect().width)).toBe(800);await p.close();
});
test('TrAnimeIzle screenshot wrapper expands even when the iframe reports a small layout box',async()=>{
 const p=await context.newPage();await p.route('https://www.tranimeizle.live/**',route=>route.fulfill({contentType:'text/html',body:'<title>TrAnimeIzle fixture</title>'}));
 await p.route('https://optraco.top/**',route=>route.fulfill({contentType:'text/html',body:'<video controls style="width:100%;height:100%"></video>'}));
 await setup(p,'');
 // Keep the installed fixture messaging, but give the adapter its actual site context.
 await p.goto('https://www.tranimeizle.live/test-video');
 await p.setContent('<style>.videoSource{display:flex}.videoSource-video{width:830px}.videoSource-player{position:relative;width:830px;height:467px}iframe{width:100px;height:60px}</style><div class="videoSource"><div class="videoSource-video anime-description"><div class="video-ad-container">Ad slot</div><div class="videoSource-player" id="videoPlayer" data-ad-observer-attached="1"><iframe src="https://optraco.top/explorer/fixture" allowfullscreen></iframe></div><p id="notice">Site notice</p></div><aside>Sources</aside></div>');
 await p.evaluate(()=>{const listeners:any[]=[];(window as any).chrome={runtime:{id:'fixture',onMessage:{addListener:(fn:any)=>listeners.push(fn),removeListener:(fn:any)=>listeners.splice(listeners.indexOf(fn),1)},sendMessage:async()=>{}},storage:{local:{get:async()=>({settings:{}})}}};(window as any).toggle=()=>Promise.all(listeners.map(fn=>fn({type:'screen-fit:toggle'})));});
 await p.addScriptTag({path:'.output/chrome-mv3/content-scripts/video.js'});await p.frameLocator('iframe').locator('video').waitFor();const originalWidth=await p.locator('iframe').evaluate(e=>e.getBoundingClientRect().width);await toggle(p);
 await expect(p.locator('#videoPlayer')).toHaveAttribute('data-screen-fit-target',/sf-/);
 expect(await p.locator('iframe').evaluate(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height}))).toEqual({w:1440,h:1100});await expect(p.locator('#notice')).not.toHaveAttribute('data-screen-fit-target');
 await toggle(p);expect(await p.locator('iframe').evaluate(e=>e.getBoundingClientRect().width)).toBe(originalWidth);await p.close();
});
test('single video fills viewport; Escape restores exact attributes and playback state',async()=>{
 const p=await context.newPage();await setup(p,'<video id="main" controls style="border-radius:8px"></video>');
 const before=await p.locator('video').evaluate(v=>({style:v.getAttribute('style'),controls:(v as HTMLVideoElement).controls,time:(v as HTMLVideoElement).currentTime}));
 await toggle(p);await expect(p.locator('video')).toHaveAttribute('data-screen-fit-target',/sf-/);
 expect(await p.locator('video').evaluate(v=>({w:v.getBoundingClientRect().width,h:v.getBoundingClientRect().height,fit:getComputedStyle(v).objectFit}))).toEqual({w:1440,h:1100,fit:'contain'});
 await p.keyboard.press('Escape');await expect(p.locator('[data-screen-fit-target]')).toHaveCount(0);
 expect(await p.locator('video').evaluate(v=>({style:v.getAttribute('style'),controls:(v as HTMLVideoElement).controls,time:(v as HTMLVideoElement).currentTime}))).toEqual(before);await p.close();
});
test('YouTube inline control widths follow viewport and restore on exit',async()=>{
 const p=await context.newPage();await setup(p,`<div id="movie_player" class="html5-video-player" style="width:640px;height:360px;position:relative">
 <div class="html5-video-container"><video></video><video style="display:none"></video></div>
 <div class="ytp-gradient-bottom" style="position:absolute;bottom:0;width:640px;height:80px"></div>
 <div class="ytp-chrome-bottom" style="position:absolute;left:12px;bottom:0;width:616px;height:48px">
 <div class="ytp-progress-bar-container" style="width:616px;height:5px;background:red"></div>
 <div class="ytp-chrome-controls" style="display:flex;width:616px"><button>Pause</button><span class="ytp-time-display">1:23 / 10:00</span><button style="margin-left:auto">Settings</button></div></div></div>`);
 const original=await p.locator('.ytp-chrome-bottom').getAttribute('style');await toggle(p);
 const widths=()=>p.evaluate(()=>['.ytp-chrome-bottom','.ytp-progress-bar-container','.ytp-chrome-controls'].map(s=>document.querySelector(s)!.getBoundingClientRect().width));
 expect(await widths()).toEqual([1416,1416,1416]);
 expect(await p.locator('.ytp-chrome-bottom').evaluate(e=>e.getBoundingClientRect().bottom)).toBe(1100);
 await p.setViewportSize({width:1000,height:750});expect(await widths()).toEqual([976,976,976]);
 await setScale(p,'Oynatıcı',80);await setScale(p,'Görüntü',150);expect(await widths()).toEqual([776,776,776]);expect(await p.locator('.ytp-chrome-bottom').evaluate(e=>e.getBoundingClientRect().bottom)).toBe(675);
 await p.screenshot({path:'artifacts/youtube-controls-fixture.png'});
 await toggle(p);expect(await widths()).toEqual([616,616,616]);expect(await p.locator('.ytp-chrome-bottom').getAttribute('style')).toBe(original);await p.close();
});
test('toolbar hides when idle, returns on movement, stays usable on hover',async()=>{
 const p=await context.newPage();await setup(p,'<video controls></video>');await toggle(p);await p.mouse.move(900,500);
 const hidden=()=>p.evaluate(()=>(window as any).__testShadow.querySelector('[data-screen-fit-toolbar]').getAttribute('aria-hidden'));
 await expect.poll(hidden,{timeout:4000}).toBe('true');await p.mouse.move(800,400);await expect.poll(hidden).toBe('false');
 const center=await p.evaluate(()=>{const r=(window as any).__testShadow.querySelector('[data-screen-fit-toolbar]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});
 await p.mouse.move(center.x,center.y);await p.waitForTimeout(2500);expect(await hidden()).toBe('false');
 await p.mouse.move(800,500);await expect.poll(hidden,{timeout:4000}).toBe('true');await p.keyboard.press('Escape');await expect(p.locator('[data-screen-fit-target]')).toHaveCount(0);await p.close();
});
test('invalidated runtime cleans up without uncaught errors and can be reinjected',async()=>{
 const p=await context.newPage();const errors:string[]=[];p.on('pageerror',e=>errors.push(e.message));await setup(p,'<video controls></video>');
 await p.evaluate(()=>{(window as any).chrome.runtime.sendMessage=()=>{throw new Error('Extension context invalidated.');};});
 // Even synchronous errors must not abort activation or Escape cleanup.
 await toggle(p);await expect(p.locator('[data-screen-fit-target]')).toHaveCount(1);await p.keyboard.press('Escape');await expect(p.locator('[data-screen-fit-target]')).toHaveCount(0);
 await toggle(p);await p.evaluate(()=>{(window as any).chrome.runtime.id=undefined;});
 await expect(p.locator('[data-screen-fit-target]')).toHaveCount(0,{timeout:2000});expect(await p.evaluate(()=>(window as any).__screenFit)).toBeUndefined();
 await p.evaluate(()=>{(window as any).chrome.runtime.id='fixture';(window as any).chrome.runtime.sendMessage=async()=>{};});
 await p.addScriptTag({path:'.output/chrome-mv3/content-scripts/video.js'});await toggle(p);await expect(p.locator('[data-screen-fit-target]')).toHaveCount(1);await toggle(p);await expect(p.locator('[data-screen-fit-target]')).toHaveCount(0);expect(errors).toEqual([]);await p.close();
});
test('manual selection blocks page clicks, selects one video and toggles off',async()=>{
 const p=await context.newPage();await setup(p,'<video></video><video></video><button id="site">Site</button>',{selection:'manual'});await toggle(p);
 await expect(p.locator('[data-screen-fit-target]')).toHaveCount(0);
 // Closed shadow UI is exercised through real screen coordinates.
 await p.mouse.click(200,200);await expect(p.locator('[data-screen-fit-video]')).toHaveCount(1);
 await toggle(p);await expect(p.locator('[data-screen-fit-target]')).toHaveCount(0);await p.close();
});
test('same-origin iframe ancestors expand and restore',async()=>{
 const p=await context.newPage();await setup(p,'<iframe style="width:650px;height:400px" srcdoc="<video controls style=\'width:600px;height:340px\'></video>"></iframe>');
 await p.frameLocator('iframe').locator('video').waitFor();await toggle(p);
 await expect(p.locator('iframe')).toHaveAttribute('data-screen-fit-target',/sf-/);
 await expect(p.frameLocator('iframe').locator('video')).toHaveAttribute('data-screen-fit-video',/sf-/);
 await setScale(p,'Oynatıcı',80);expect(await p.locator('iframe').evaluate(e=>e.getBoundingClientRect().width)).toBe(1152);expect(await p.frameLocator('iframe').locator('video').evaluate(e=>e.getBoundingClientRect().width)).toBe(1152);
 await p.frameLocator('iframe').locator('video').press('Escape');await expect(p.locator('[data-screen-fit-target]')).toHaveCount(0);await p.close();
});
test('Fill mode, dynamic removal, repeat injection, and no-video path',async()=>{
 const p=await context.newPage();await setup(p,'<video controls></video>',{mode:'fill'});await toggle(p);
 expect(await p.locator('video').evaluate(v=>getComputedStyle(v).objectFit)).toBe('cover');
 await p.locator('video').evaluate(v=>v.remove());await expect(p.locator('[data-screen-fit-ancestor]')).toHaveCount(0,{timeout:2000});
 await p.addScriptTag({path:'.output/chrome-mv3/content-scripts/video.js'});await toggle(p);await expect(p.locator('[data-screen-fit-target]')).toHaveCount(0);await p.close();
});
test('YouTube-style wrapper retains controls and fullscreen geometry',async()=>{
 const p=await context.newPage();await setup(p,'<div id="movie_player" style="width:640px;height:360px;position:relative"><div class="html5-video-container"><video></video></div><button id="controls">Pause</button></div>');await toggle(p);
 await expect(p.locator('#movie_player')).toHaveAttribute('data-screen-fit-target',/sf-/);await expect(p.locator('#controls')).toBeVisible();await toggle(p);await expect(p.locator('#movie_player')).not.toHaveAttribute('data-screen-fit-target');await p.close();
});
test('real extension settings render, persist, and produce preview',async()=>{
 let worker=context.serviceWorkers()[0];if(!worker)worker=await context.waitForEvent('serviceworker');
 const id=new URL(worker.url()).host;const p=await context.newPage();await p.goto(`chrome-extension://${id}/options.html`);
 await expect(p.getByRole('heading',{name:'Videoya yer açın.'})).toBeVisible();
 await p.getByRole('radio',{name:/Manuel seçim/}).check();await expect(p.getByRole('status')).toContainText('kaydedildi');await p.reload();await expect(p.getByRole('radio',{name:/Manuel seçim/})).toBeChecked();
 await p.getByRole('spinbutton',{name:'Varsayılan görüntü ölçeği yüzdesi'}).fill('137');await p.getByRole('spinbutton',{name:'Varsayılan görüntü ölçeği yüzdesi'}).press('Tab');
 await p.getByRole('spinbutton',{name:'Varsayılan oynatıcı boyutu yüzdesi'}).fill('83');await p.getByRole('spinbutton',{name:'Varsayılan oynatıcı boyutu yüzdesi'}).press('Tab');await expect(p.getByRole('status')).toContainText('kaydedildi');await p.reload();
 await expect(p.getByRole('spinbutton',{name:'Varsayılan görüntü ölçeği yüzdesi'})).toHaveValue('137');await expect(p.getByRole('spinbutton',{name:'Varsayılan oynatıcı boyutu yüzdesi'})).toHaveValue('83');
 await p.locator('#ui-language').selectOption('en');await expect(p.getByRole('heading',{name:'Make room for video.'})).toBeVisible();await expect(p.getByRole('status')).toContainText('Changes saved');await p.reload();
 await expect(p.locator('#ui-language')).toHaveValue('en');await expect(p.locator('html')).toHaveAttribute('lang','en');await expect(p).toHaveTitle('Screen Fit · Preferences');
 await expect(p.getByRole('spinbutton',{name:'Default image scale percentage'})).toHaveValue('137');await expect(p.getByRole('spinbutton',{name:'Default player size percentage'})).toHaveValue('83');
 await p.getByRole('button',{name:'Restore defaults'}).click();await expect(p.locator('#ui-language')).toHaveValue('en');await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:'artifacts/settings-en.png',fullPage:true});
 const access=await context.newPage();await access.goto(`chrome-extension://${id}/frame-access.html`);await expect(access.getByRole('heading',{name:/Image scaling and Esc/})).toBeVisible();await expect(access.getByRole('status')).toContainText('Open this page');
 await p.locator('#ui-language').selectOption('tr');await expect(access.locator('html')).toHaveAttribute('lang','tr');await expect(access.getByRole('status')).toContainText('Bu sayfayı');await access.close();
 await p.getByRole('button',{name:'Varsayılana dön'}).click();await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:'artifacts/settings-preview.png',fullPage:true});await p.setViewportSize({width:390,height:844});await expect(p.locator('body')).toHaveJSProperty('scrollWidth',390);await p.screenshot({path:'artifacts/settings-mobile.png',fullPage:true});await p.close();
});
test('real media keeps playing across enter and exit, and restores scroll',async()=>{
 const p=await context.newPage();await setup(p,'<div style="height:400px"></div><video controls muted loop></video>');
 await p.evaluate(async()=>{
  const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#456';ctx.fillRect(0,0,320,180);
  const stream=canvas.captureStream(20),recorder=new MediaRecorder(stream,{mimeType:'video/webm'});const chunks:BlobPart[]=[];
  recorder.ondataavailable=e=>chunks.push(e.data);const done=new Promise<void>(resolve=>recorder.onstop=()=>resolve());recorder.start();
  const timer=setInterval(()=>{ctx.fillStyle=`hsl(${Math.random()*360} 30% 30%)`;ctx.fillRect(0,0,320,180);},50);
  await new Promise(r=>setTimeout(r,1500));recorder.stop();await done;clearInterval(timer);stream.getTracks().forEach(t=>t.stop());
  const v=document.querySelector('video')!;v.src=URL.createObjectURL(new Blob(chunks,{type:'video/webm'}));await v.play();scrollTo(0,300);
 });
 const src=await p.locator('video').getAttribute('src');await toggle(p);await expect.poll(()=>p.locator('video').evaluate(v=>(v as HTMLVideoElement).paused)).toBe(false);await toggle(p);
 expect(await p.locator('video').getAttribute('src')).toBe(src);expect(await p.evaluate(()=>scrollY)).toBe(300);expect(await p.locator('video').evaluate(v=>(v as HTMLVideoElement).paused)).toBe(false);await p.close();
});
