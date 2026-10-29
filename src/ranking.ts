export type Metrics = { area:number; visibleRatio:number; playing:boolean; duration:number; embedded:boolean };
export function score(v: Metrics) {
  return v.area * v.visibleRatio * (v.playing ? 1.7 : 1) * (v.duration > 60 ? 1.15 : 1) * (v.embedded ? 0.8 : 1);
}
export function choose<T extends Metrics>(items:T[], preference:'smart'|'manual'|'largest'):T|null {
  if (!items.length) return null;
  if (items.length === 1) return items[0]!;
  if (preference === 'manual') return null;
  if (preference === 'largest') return [...items].sort((a,b)=>b.area*b.visibleRatio-a.area*a.visibleRatio)[0]!;
  const ranked = [...items].sort((a,b)=>score(b)-score(a));
  return score(ranked[0]!) >= score(ranked[1]!)*1.65 ? ranked[0]! : null;
}
