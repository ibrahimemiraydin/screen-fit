import {describe,it,expect} from 'vitest';
import {noCandidateReason} from '../src/compatibility';
describe('evidence-scoped compatibility feedback',()=>{
 it('does not claim a custom player when nothing was detected',()=>expect(noCandidateReason({videos:0,customPlayer:false,embedsDisabled:false})).toBe('no-video'));
 it('distinguishes a hidden or off-screen HTML5 video',()=>expect(noCandidateReason({videos:1,customPlayer:false,embedsDisabled:false})).toBe('not-visible'));
 it('identifies a visible custom rendering hint',()=>expect(noCandidateReason({videos:0,customPlayer:true,embedsDisabled:false})).toBe('custom-player'));
 it('prefers a custom renderer hint over its hidden backing video',()=>expect(noCandidateReason({videos:1,customPlayer:true,embedsDisabled:false})).toBe('custom-player'));
 it('offers settings when embedded detection is disabled',()=>expect(noCandidateReason({videos:0,customPlayer:false,embedsDisabled:true})).toBe('embeds-disabled'));
 it('prioritizes the setting the user can change',()=>expect(noCandidateReason({videos:2,customPlayer:true,embedsDisabled:true})).toBe('embeds-disabled'));
});
