export type CompatibilityReason='no-video'|'not-visible'|'embeds-disabled'|'custom-player'|'expand-failed';
export type DetectionSignals={videos:number;customPlayer:boolean;embedsDisabled:boolean};
export function noCandidateReason(signals:DetectionSignals):CompatibilityReason {
 if(signals.embedsDisabled)return 'embeds-disabled';
 if(signals.customPlayer)return 'custom-player';
 if(signals.videos>0)return 'not-visible';
 return 'no-video';
}
