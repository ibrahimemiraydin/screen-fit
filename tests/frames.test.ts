import {describe,it,expect} from 'vitest';
import {classifyFrame,isTrAnimePlayer,type FrameHints} from '../src/frames';
const base:FrameHints={src:'https://external-media.test/watch/abc',title:'',context:'',allow:'',fullscreen:false,width:800,height:450};
describe('cross-origin player hints',()=>{
 it('recognizes the supplied TrAnimeIzle player source only in its site context',()=>{expect(isTrAnimePlayer('www.tranimeizle.live','https://optraco.top/explorer/123')).toBe(true);expect(isTrAnimePlayer('www.tranimeizle.io','https://optraco.top/explorer/123')).toBe(true);expect(isTrAnimePlayer('unrelated.test','https://optraco.top/explorer/123')).toBe(false);expect(isTrAnimePlayer('www.tranimeizle.live','https://optraco.top.evil.test/explorer/123')).toBe(false);});
 it('accepts other providers when fullscreen is declared',()=>expect(classifyFrame({...base,fullscreen:true})).toBe('player'));
 it('accepts the modern allow fullscreen form',()=>expect(classifyFrame({...base,allow:"autoplay; fullscreen *; encrypted-media"})).toBe('player'));
 it('recognizes semantic player wrappers',()=>expect(classifyFrame({...base,context:'iframe player-container video-wrapper'})).toBe('player'));
 it('recognizes existing providers',()=>expect(classifyFrame({...base,src:'https://www.youtube.com/embed/id'})).toBe('player'));
 it('asks for explicit selection for unknown large frames',()=>expect(classifyFrame(base)).toBe('possible'));
 it('rejects verification and advertising frames even with fullscreen',()=>{for(const src of ['https://challenges.cloudflare.com/turnstile/abc','https://google.com/recaptcha/frame','https://doubleclick.net/ad'])expect(classifyFrame({...base,src,fullscreen:true})).toBeNull();});
 it('rejects tiny frames and blank helpers',()=>{expect(classifyFrame({...base,width:64,height:64})).toBeNull();expect(classifyFrame({...base,src:'about:blank'})).toBeNull();});
 it('rejects banners and unsupported URL schemes',()=>{expect(classifyFrame({...base,width:1200,height:90})).toBeNull();expect(classifyFrame({...base,src:'javascript:alert(1)'})).toBeNull();});
});
