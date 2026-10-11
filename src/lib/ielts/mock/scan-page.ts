/** Original question layout, with a selectable text layer for annotations. */
export type ScanPage = { url: string; width: number; height: number; lines: {text:string;x:number;y:number;w:number;h:number}[] };
export function renderScanPage(page: ScanPage): HTMLElement {
 if (!/^\/ielts\/mock\/c(?:16|17|18|19)-test-[1234]\/page-\d+\.webp$/.test(page.url) || !(page.width>0 && page.height>0)) throw new RangeError('Invalid source page');
 const figure=document.createElement('div');figure.className='scan-page';
 const image=document.createElement('img');image.src=page.url;image.width=page.width;image.height=page.height;image.alt='原题页面';image.loading='lazy';image.draggable=false;figure.append(image);
 const layer=document.createElement('div');layer.className='scan-text-layer';
 const metrics=document.createElement('canvas').getContext('2d');if(metrics)metrics.font='100px Arial';
 for(const line of page.lines){
  if (![line.x,line.y,line.w,line.h].every(Number.isFinite) || line.x<0 || line.y<0 || line.x>1 || line.y>1 || line.w<=0 || line.h<=0) throw new RangeError('Invalid text coordinates');
  const span=document.createElement('span');span.className='scan-text-line';span.textContent=line.text;
  span.style.left=`${line.x*100}%`;span.style.top=`${line.y*100}%`;span.style.width=`${line.w*100}%`;span.style.height=`${line.h*100}%`;
  span.style.fontSize=`${line.h*page.height/page.width*100}cqw`;
  const measured=metrics?.measureText(line.text).width||0;
  if(measured>0)span.style.transform=`scaleX(${line.w*page.width/(line.h*page.height*measured/100)})`;
  layer.append(span);
 }
 figure.append(layer);return figure;
}
