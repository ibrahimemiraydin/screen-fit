const paths={
 brand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5"/><path d="m10 8 6 4-6 4z" fill="currentColor" stroke="none"/>',
 fit:'<path d="M3 8V3h5m8 0h5v5M3 16v5h5m8 0h5v-5"/><path d="M8 8h8v8H8z" opacity=".5"/>',
 fill:'<path d="M3 8V3h5m8 0h5v5M3 16v5h5m8 0h5v-5"/><path d="M7 7h10v10H7z" fill="currentColor" stroke="none" opacity=".65"/>',
 up:'<path d="m6 15 6-6 6 6"/>',down:'<path d="m6 9 6 6 6-6"/>',
 reset:'<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',
 access:'<path d="m12 3 8 3v6c0 5-8 9-8 9S4 17 4 12V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
} as const;
export function overlayIcon(name:keyof typeof paths):SVGSVGElement {
 const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');
 for(const [key,value]of Object.entries({viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'1.7','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',focusable:'false',class:'icon'}))icon.setAttribute(key,value);
 icon.innerHTML=paths[name];return icon;
}
