export function percent(value:unknown,min:number,max:number,fallback=100):number {
  return typeof value==='number'&&Number.isFinite(value)?Math.round(Math.min(max,Math.max(min,value))):fallback;
}
export function viewBox(zoom:number):string {
  const value=percent(zoom,25,300);
  return value===100?'none':`inset(${Number(((1-100/value)*50).toFixed(5))}%)`;
}
export function displayCss(token:string,mode:'fit'|'fill',zoom:number,playerSize:number,outer:boolean):string {
  const size=outer?percent(playerSize,25,100):100;
  return `[data-screen-fit-target="${token}"]{width:${size}vw!important;height:${size}vh!important;margin:auto!important;inset:0!important;overflow:hidden!important}
    [data-screen-fit-video="${token}"], [data-screen-fit-target="${token}"] canvas.video-canvas,[data-screen-fit-target="${token}"] canvas.subtitle-canvas{object-fit:${mode==='fill'?'cover':'contain'}!important;object-view-box:${viewBox(zoom)}!important}`;
}
