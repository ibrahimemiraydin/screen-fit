import {describe,it,expect} from 'vitest';
import {frameOrigin,findPlayerRoots,playerBranch,type FrameInfo} from '../src/frame-relay';
const frames:FrameInfo[]=[{frameId:0,parentFrameId:-1,url:'https://site.test/watch'},{frameId:2,parentFrameId:0,url:'https://media.test/player/123'},{frameId:3,parentFrameId:2,url:'https://child.test/embed'},{frameId:4,parentFrameId:0,url:'https://ads.test/banner'}];
describe('selected player frame branch',()=>{
 it('finds exact player while ignoring fragments',()=>expect(findPlayerRoots(frames,'https://media.test/player/123#time')).toEqual([2]));
 it('uses an unambiguous redirected path on the same origin',()=>expect(findPlayerRoots(frames,'https://media.test/redirect')).toEqual([2]));
 it('does not guess among several frames on the same origin',()=>expect(findPlayerRoots([...frames,{frameId:5,parentFrameId:0,url:'https://media.test/other'}],'https://media.test/redirect')).toEqual([]));
 it('selects descendants and excludes sibling advertising frames',()=>expect(playerBranch(frames,[2]).map(f=>f.frameId)).toEqual([2,3]));
 it('excludes known advertising and challenge descendants with their subframes',()=>expect(playerBranch([...frames,{frameId:6,parentFrameId:2,url:'https://doubleclick.test/ad'},{frameId:7,parentFrameId:6,url:'https://another.test/frame'}],[2]).map(f=>f.frameId)).toEqual([2,3]));
 it('never includes top frame even with invalid root input',()=>expect(playerBranch(frames,[0])).toEqual([]));
 it('requests exact HTTP origins only',()=>{expect(frameOrigin('https://media.test/player/private-id')).toBe('https://media.test/*');expect(frameOrigin('about:blank')).toBeNull();expect(frameOrigin('javascript:alert(1)')).toBeNull();});
});
