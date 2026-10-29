import {browserPath} from './browser-path.mjs';
// Optional live-site smoke test; uses a fresh, unsigned-in browser profile.
import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:browserPath,headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900},bypassCSP:true});
try {
  await page.goto('https://www.youtube.com/watch?v=aqz-KE-bpKQ',{waitUntil:'domcontentloaded',timeout:45000});
  await page.locator('#movie_player video').first().waitFor({state:'visible',timeout:20000});
  const metrics=()=>page.evaluate(()=>{
    const box=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,style:e.getAttribute('style')};};
    return {url:location.href,player:box('#movie_player'),video:box('#movie_player video'),controls:box('.ytp-chrome-bottom'),progress:box('.ytp-progress-bar-container'),chapter:box('.ytp-chapter-hover-container'),videos:document.querySelectorAll('#movie_player video').length};
  });
  await page.waitForTimeout(2500);
  const before=await metrics();
  await page.evaluate(()=>{
    const attach=Element.prototype.attachShadow;Element.prototype.attachShadow=function(init){const root=attach.call(this,init);if(init.mode==='closed')window.screenFitTestRoot=root;return root;};
    const listeners=[];
    window.chrome={runtime:{id:'live-fixture',getURL:s=>s,onMessage:{addListener:fn=>listeners.push(fn),removeListener:fn=>listeners.splice(listeners.indexOf(fn),1)},sendMessage:async()=>{}},storage:{local:{get:async()=>({settings:{}})}}};
    window.screenFitTestToggle=()=>Promise.all(listeners.map(fn=>fn({type:'screen-fit:toggle'})));
  });
  await page.addScriptTag({path:'.output/chrome-mv3/content-scripts/video.js'});
  await page.evaluate(()=>window.screenFitTestToggle());await page.waitForTimeout(1000);
  const active=await metrics();await page.screenshot({path:'artifacts/youtube-live-active.png'});
  let scales;
  if(process.argv.includes('--scales')) {
    const set=async(label,value)=>{await page.evaluate(({label,value})=>{const input=window.screenFitTestRoot.querySelector(`input[type="range"][aria-label="${label}"]`);input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));},{label,value});await page.waitForTimeout(750);};
    await set('Görüntü',150);const zoomed=await metrics();assert.equal(zoomed.controls.width,1416);assert.equal(zoomed.player.width,1440);
    assert.equal(await page.locator('#movie_player video').first().evaluate(v=>getComputedStyle(v).getPropertyValue('object-view-box')),'inset(16.6667%)');
    await set('Oynatıcı',80);const reduced=await metrics();assert.equal(reduced.player.width,1152);assert.equal(reduced.player.height,720);assert.equal(reduced.controls.width,1128);assert.equal(reduced.controls.bottom,810);
    await page.screenshot({path:'artifacts/youtube-live-custom-scale.png'});scales={zoom:150,playerSize:80,zoomed,reduced};
    await set('Görüntü',100);await set('Oynatıcı',100);
  }
  await page.evaluate(()=>window.screenFitTestToggle());await page.waitForTimeout(1500);const restored=await metrics();
  const result={before,active,restored,scales};await writeFile('artifacts/youtube-live-probe.json',JSON.stringify(result,null,2));
  assert.equal(active.player.width,1440);assert.equal(active.player.height,900);
  assert.equal(active.controls.width,1416);assert.equal(active.controls.bottom,900);assert.equal(active.progress.width,1416);
  assert.equal(active.chapter.width,1416);
  assert.ok(Math.abs(restored.player.width-before.player.width)<2,'original player width should return');
  assert.ok(Math.abs(restored.controls.width-before.controls.width)<2,'original controls width should return');
  console.log(JSON.stringify(result,null,2));
} finally {await browser.close();}
