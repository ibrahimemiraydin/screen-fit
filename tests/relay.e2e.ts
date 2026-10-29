import {browserPath} from './browser-path';
import {test,expect,chromium} from '@playwright/test';
import {mkdtemp,cp,readFile,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

test('real extension forwards Escape from selected nested iframe and removes relays on exit',async()=>{
 const prefix=path.join(os.tmpdir(),'screen-fit-relay-'),temp=await mkdtemp(prefix),extension=path.join(temp,'extension');
 await cp(path.resolve('.output/chrome-mv3'),extension,{recursive:true});
 const manifest=JSON.parse(await readFile(path.join(extension,'manifest.json'),'utf8'));
 // Grants are fixture-only. The shipped extension still requests hosts optionally.
 manifest.host_permissions=['http://127.0.0.1/*','http://relay-media.test/*','http://relay-child.test/*'];
 await writeFile(path.join(extension,'manifest.json'),JSON.stringify(manifest));
 const context=await chromium.launchPersistentContext(path.join(temp,'profile'),{executablePath:browserPath,headless:true,args:['--disable-extensions-except='+extension,'--load-extension='+extension],viewport:{width:1440,height:900}});
 try {
  const page=await context.newPage();
  await page.route('http://relay-media.test/**',route=>route.fulfill({contentType:'text/html',body:'<button id="outer">Outer player</button><iframe src="http://relay-child.test/video" style="width:500px;height:300px"></iframe><iframe src="http://doubleclick.test/ad" style="width:20px;height:20px"></iframe>'}));
  await page.route('http://doubleclick.test/**',route=>route.fulfill({contentType:'text/html',body:'Ad inside player'}));
  await page.route('http://relay-child.test/**',route=>route.fulfill({contentType:'text/html',body:'<button id="focus">Inner player focus</button><video controls style="width:420px;height:220px"></video>'}));
  await page.route('http://ungranted-ad.test/**',route=>route.fulfill({contentType:'text/html',body:'Advertising sibling'}));
  await page.goto('http://127.0.0.1:4178');await page.setContent('<iframe id="player" allowfullscreen src="http://relay-media.test/player" style="width:800px;height:450px"></iframe><iframe src="http://ungranted-ad.test/ad" style="width:30px;height:30px"></iframe>');
  await page.frameLocator('#player').frameLocator('iframe[src^="http://relay-child.test/"]').locator('#focus').waitFor();
  let worker=context.serviceWorkers()[0];if(!worker)worker=await context.waitForEvent('serviceworker');
  const tabId=await worker.evaluate(async()=>{const api=(globalThis as any).chrome;const tabs=await api.tabs.query({url:'http://127.0.0.1/*'});const tabId=tabs[0].id;await api.scripting.executeScript({target:{tabId},files:['content-scripts/video.js']});await api.tabs.sendMessage(tabId,{type:'screen-fit:toggle'},{frameId:0});return tabId;});
  await expect(page.locator('#player')).toHaveAttribute('data-screen-fit-target',/sf-/);
  await expect.poll(()=>worker.evaluate(async id=>{const data=await (globalThis as any).chrome.storage.session.get(`frame-relay:${id}`);return data[`frame-relay:${id}`]?.frameIds.length;},tabId)).toBe(2);
  await worker.evaluate(async id=>{const api=(globalThis as any).chrome;const state=await api.storage.session.get(`frame-relay:${id}`);await api.scripting.executeScript({target:{tabId:id,frameIds:[0]},func:async(session:string)=>{await (globalThis as any).chrome.runtime.sendMessage({type:'screen-fit:frame-display',session,zoom:200,mode:'fit'});},args:[state[`frame-relay:${id}`].session]});},tabId);
  const video=page.frameLocator('#player').frameLocator('iframe[src^="http://relay-child.test/"]').locator('video');
  await expect.poll(()=>video.evaluate(v=>getComputedStyle(v).getPropertyValue('object-view-box'))).toBe('inset(25%)');
  const options=await context.newPage();await options.goto(`chrome-extension://${new URL(worker.url()).host}/options.html`);await options.locator('#ui-language').selectOption('en');
  await expect(options.getByRole('status')).toContainText('Changes saved');
  const cdp=await context.newCDPSession(page);await expect.poll(async()=>{const tree=await cdp.send('Accessibility.getFullAXTree');return tree.nodes.some(n=>n.role?.value==='slider'&&n.name?.value==='Image');}).toBe(true);
  await expect.poll(()=>worker.evaluate(async id=>(globalThis as any).chrome.action.getTitle({tabId:id}),tabId)).toBe('Screen Fit · Restore original size');
  expect(await video.evaluate(v=>getComputedStyle(v).getPropertyValue('object-view-box'))).toBe('inset(25%)');await expect(page.locator('#player')).toHaveAttribute('data-screen-fit-target',/sf-/);await options.close();
  await page.frameLocator('#player').frameLocator('iframe[src^="http://relay-child.test/"]').locator('#focus').focus();await page.keyboard.press('Escape');
  await expect(page.locator('[data-screen-fit-target]')).toHaveCount(0);
  await expect.poll(()=>video.evaluate(v=>getComputedStyle(v).getPropertyValue('object-view-box'))).toBe('none');
  await expect.poll(()=>worker.evaluate(async id=>Object.keys(await (globalThis as any).chrome.storage.session.get(`frame-relay:${id}`)).length,tabId)).toBe(0);
  await expect.poll(()=>worker.evaluate(async id=>{const result=await (globalThis as any).chrome.webNavigation.getAllFrames({tabId:id});const child=result.find((f:any)=>f.url==='http://relay-child.test/video');const [{result:installed}]=await (globalThis as any).chrome.scripting.executeScript({target:{tabId:id,frameIds:[child.frameId]},func:()=>!!(window as any).__screenFitEscape});return installed;},tabId)).toBe(false);
 }finally {await context.close();if(!path.resolve(temp).startsWith(path.resolve(prefix)))throw new Error('Unexpected temporary path');await rm(temp,{recursive:true,force:true});}
});
test('missing provider permission opens a scoped grant page and expired sessions are rejected',async()=>{
 const prefix=path.join(os.tmpdir(),'screen-fit-relay-'),temp=await mkdtemp(prefix),extension=path.join(temp,'extension');
 await cp(path.resolve('.output/chrome-mv3'),extension,{recursive:true});
 const manifest=JSON.parse(await readFile(path.join(extension,'manifest.json'),'utf8'));
 manifest.host_permissions=['http://127.0.0.1/*'];
 await writeFile(path.join(extension,'manifest.json'),JSON.stringify(manifest));
 const context=await chromium.launchPersistentContext(path.join(temp,'profile'),{executablePath:browserPath,headless:true,args:['--disable-extensions-except='+extension,'--load-extension='+extension],viewport:{width:1440,height:900}});
 try {
  const page=await context.newPage();await page.route('http://relay-media.test/**',route=>route.fulfill({contentType:'text/html',body:'<button>Player</button>'}));
  await page.goto('http://127.0.0.1:4178');await page.setContent('<iframe allowfullscreen src="http://relay-media.test/player" style="width:800px;height:450px"></iframe>');await page.frameLocator('iframe').getByRole('button').waitFor();
  let worker=context.serviceWorkers()[0];if(!worker)worker=await context.waitForEvent('serviceworker');
  const tabId=await worker.evaluate(async()=>{const api=(globalThis as any).chrome;const [tab]=await api.tabs.query({url:'http://127.0.0.1/*'});await api.scripting.executeScript({target:{tabId:tab.id},files:['content-scripts/video.js']});await api.tabs.sendMessage(tab.id,{type:'screen-fit:toggle'},{frameId:0});return tab.id;});
  await expect.poll(()=>worker.evaluate(async id=>{const state=await (globalThis as any).chrome.storage.session.get(`frame-relay:${id}`);return state[`frame-relay:${id}`]?.origins;},tabId)).toEqual(['http://relay-media.test/*']);
  const cdp=await context.newCDPSession(page);
  await expect.poll(async()=>{const tree=await cdp.send('Accessibility.getFullAXTree');return tree.nodes.some(n=>n.name?.value==='Oynatıcı erişimini etkinleştir');}).toBe(true);
  const tree=await cdp.send('Accessibility.getFullAXTree');const node=tree.nodes.find(n=>n.name?.value==='Oynatıcı erişimini etkinleştir')!;
  const {object}=await cdp.send('DOM.resolveNode',{backendNodeId:node.backendDOMNodeId});
  const opened=context.waitForEvent('page');await cdp.send('Runtime.callFunctionOn',{objectId:object.objectId,functionDeclaration:'function(){this.click()}',userGesture:true});
  const access=await opened;await access.waitForLoadState();await expect(access.getByRole('listitem')).toHaveText(['relay-media.test']);await expect(access.getByRole('button',{name:'İzin ver ve etkinleştir'})).toBeEnabled();
  await access.screenshot({path:'artifacts/frame-access-preview.png'});
  await worker.evaluate(async id=>{await (globalThis as any).chrome.tabs.sendMessage(id,{type:'screen-fit:toggle'},{frameId:0});},tabId);
  await expect.poll(()=>worker.evaluate(async id=>Object.keys(await (globalThis as any).chrome.storage.session.get(`frame-relay:${id}`)).length,tabId)).toBe(0);
  await access.reload();await expect(access.getByRole('status')).toContainText('oturumu sona ermiş');await expect(access.getByRole('button',{name:'İzin ver ve etkinleştir'})).toBeDisabled();
 }finally{await context.close();if(!path.resolve(temp).startsWith(path.resolve(prefix)))throw new Error('Unexpected temporary path');await rm(temp,{recursive:true,force:true});}
});
