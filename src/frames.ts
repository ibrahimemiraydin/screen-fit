export type FrameHints={src:string;title:string;context:string;allow:string;fullscreen:boolean;width:number;height:number};
export function isTrAnimePlayer(pageHost:string,src:string):boolean {
  try {const u=new URL(src);return /(^|\.)tranimeizle\.(live|io)$/i.test(pageHost)&&u.hostname==='optraco.top'&&u.pathname.startsWith('/explorer/');}catch{return false;}
}
export function classifyFrame(h:FrameHints):'player'|'possible'|null {
  let url:URL;
  try {url=new URL(h.src);}catch{return null;}
  if(!['https:','http:'].includes(url.protocol))return null;
  const text=`${url.hostname} ${url.pathname} ${h.title} ${h.context}`;
  if(/(?:captcha|turnstile|challenge|doubleclick|googlesyndication|adservice|dtscout|advertisement|consent|recaptcha)/i.test(text))return null;
  const host=url.hostname.replace(/^www\./,'');
  const known=(['youtube.com','youtube-nocookie.com'].includes(host)&&url.pathname.startsWith('/embed/'))||host==='player.vimeo.com'||host==='player.twitch.tv'||(host==='dailymotion.com'&&url.pathname.startsWith('/embed/'));
  const ratio=h.width/h.height;
  if(h.width<240||h.height<135||ratio<.8||ratio>3)return null;
  if(known||h.fullscreen||/(?:^|;)\s*fullscreen(?:\s|;|$)/i.test(h.allow)||/(?:^|[\s_\-/])(?:player|video|embed|cinema|oynatici)(?:$|[\s_\-/])/i.test(text))return 'player';
  // Unknown large frames are offered for explicit selection, never auto-selected.
  return h.width>=320&&h.height>=180&&ratio>=1.1&&ratio<=2.5?'possible':null;
}
