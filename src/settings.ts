import {percent} from './display';
import type {Language} from './i18n';
export type Settings = { language:Language;selection: 'smart'|'manual'|'largest'; mode: 'fit'|'fill'; zoom:number; playerSize:number; color: string; thickness: number; notifications: boolean; embeds: boolean };
export const defaults: Settings = { language:'tr',selection:'smart', mode:'fit', zoom:100, playerSize:100, color:'#a3e635', thickness:3, notifications:true, embeds:true };
export function normalizeSettings(value: unknown): Settings {
  const v = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {language:v.language==='en'?'en':'tr', selection: ['smart','manual','largest'].includes(String(v.selection)) ? v.selection as Settings['selection'] : defaults.selection,
    mode: v.mode === 'fill' ? 'fill' : 'fit',zoom:percent(v.zoom,25,300),playerSize:percent(v.playerSize,25,100), color: typeof v.color === 'string' && /^#[\da-f]{6}$/i.test(v.color) ? v.color : defaults.color,
    thickness: typeof v.thickness === 'number' && Number.isFinite(v.thickness) ? Math.min(6, Math.max(2, v.thickness)) : 3,
    notifications: typeof v.notifications === 'boolean' ? v.notifications : true, embeds: typeof v.embeds === 'boolean' ? v.embeds : true };
}
