import {beforeAll,beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
const {api,handlers}=vi.hoisted(()=>{
 const handlers:Record<string,(...args:any[])=>any>={};
 const event=(name:string)=>({addListener:vi.fn((fn:(...args:any[])=>any)=>{handlers[name]=fn;})});
 const api={
  action:{onClicked:event('click'),setBadgeText:vi.fn(),setBadgeBackgroundColor:vi.fn(),setTitle:vi.fn()},
  commands:{onCommand:event('command')},
  runtime:{onMessage:event('message'),getURL:vi.fn((p:string)=>`chrome-extension://fixture${p}`)},
  tabs:{onUpdated:event('updated'),onRemoved:event('removed'),query:vi.fn(),sendMessage:vi.fn(),create:vi.fn()},
  storage:{session:{get:vi.fn(),set:vi.fn(),remove:vi.fn()}},
  scripting:{executeScript:vi.fn()},
 };
 return {api,handlers};
});
vi.mock('wxt/browser',()=>({browser:api}));
let start:()=>void;
beforeAll(async()=>{vi.stubGlobal('defineBackground',(fn:()=>void)=>fn);start=(await import('../entrypoints/background')).default as unknown as ()=>void;});
beforeEach(()=>{
 vi.clearAllMocks();
 for(const fn of [api.action.setBadgeText,api.action.setBadgeBackgroundColor,api.action.setTitle,api.tabs.sendMessage,api.tabs.create,api.storage.session.set,api.storage.session.remove])fn.mockReset().mockResolvedValue(undefined);
 api.storage.session.get.mockReset().mockResolvedValue({});api.tabs.query.mockReset().mockResolvedValue([{id:7}]);api.scripting.executeScript.mockReset().mockResolvedValue([]);
 vi.spyOn(console,'error').mockImplementation(()=>{});start();
});
afterEach(()=>vi.restoreAllMocks());
const flush=()=>new Promise(resolve=>setTimeout(resolve,0));
const missing=()=>new Error('No tab with id: 7.');
describe('tab closing during background work',()=>{
 it('handles late state notifications when all three action updates reject',async()=>{
  for(const fn of [api.action.setBadgeText,api.action.setBadgeBackgroundColor,api.action.setTitle])fn.mockRejectedValue(missing());
  await handlers.message!({type:'screen-fit:state',state:'active'},{tab:{id:7},frameId:0});
  expect(api.action.setTitle).toHaveBeenCalled();expect(console.error).not.toHaveBeenCalled();
 });
 it('handles navigation action updates after the tab is removed',async()=>{
  api.action.setBadgeText.mockRejectedValue(missing());api.action.setTitle.mockRejectedValue(missing());
  handlers.updated!(7,{status:'loading'});handlers.removed!(7);await flush();await flush();
  expect(api.action.setTitle).toHaveBeenCalled();expect(console.error).not.toHaveBeenCalled();
 });
 it('does not try to put an error badge on a tab lost during injection, and releases the busy guard',async()=>{
  api.tabs.sendMessage.mockRejectedValue(missing());api.scripting.executeScript.mockRejectedValue(missing());
  handlers.click!({id:7});await flush();handlers.click!({id:7});await flush();
  expect(api.scripting.executeScript).toHaveBeenCalledTimes(2);expect(api.action.setBadgeText).not.toHaveBeenCalled();expect(console.error).not.toHaveBeenCalled();
 });
 it('handles a tab closing while the unsupported-page badge is being written',async()=>{
  api.tabs.sendMessage.mockRejectedValue(new Error('Receiving end does not exist'));
  api.scripting.executeScript.mockRejectedValue(new Error('Cannot access chrome:// page'));
  for(const fn of [api.action.setBadgeText,api.action.setBadgeBackgroundColor,api.action.setTitle])fn.mockRejectedValue(missing());
  handlers.click!({id:7});await flush();expect(api.action.setBadgeText).toHaveBeenCalledWith({tabId:7,text:'!'});expect(console.error).not.toHaveBeenCalled();
 });
 it('waits for in-flight badge promises and tolerates their late rejection',async()=>{
  let reject!:(e:Error)=>void;api.action.setBadgeText.mockImplementation(()=>new Promise((_,r)=>{reject=r;}));
  const result=handlers.message!({type:'screen-fit:state',state:'idle'},{tab:{id:7},frameId:0});
  await vi.waitFor(()=>expect(api.action.setBadgeText).toHaveBeenCalled());handlers.removed!(7);reject(missing());await result;expect(console.error).not.toHaveBeenCalled();
 });
 it('keeps unexpected action failures visible',async()=>{
  const error=new Error('Unexpected action API failure');api.action.setTitle.mockRejectedValue(error);
  await handlers.message!({type:'screen-fit:state',state:'active'},{tab:{id:7},frameId:0});
  expect(console.error).toHaveBeenCalledWith('Screen Fit background operation failed:',error);
 });
});
