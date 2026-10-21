// Shared with the existing Control Room: content.json and assets/ remain canonical.
export const plainText=value=>String(value??'').replace(/<br\s*\/?\s*>/gi,' ').replace(/<[^>]*>/g,'').trim();
// Only known provider hosts and video-ID shapes can produce iframe URLs.
export function hostedVideo(src=''){
 let url;try{url=new URL(String(src).trim());}catch{return null;}
 if(url.protocol!=='https:'||url.username||url.password||url.port)return null;
 const host=url.hostname.toLowerCase(),path=url.pathname.replace(/\/$/,''),youtube=['youtube.com','www.youtube.com','m.youtube.com'];
 let id='',provider='',hash='';
 if(youtube.includes(host)){
  if(path==='/watch')id=url.searchParams.get('v')||'';
  else id=path.match(/^\/(?:embed|shorts|live)\/([\w-]+)$/)?.[1]||'';
  provider='YouTube';
 }else if(host==='youtu.be'||host==='www.youtu.be'){id=path.slice(1);provider='YouTube';}
 else if(host==='youtube-nocookie.com'||host==='www.youtube-nocookie.com'){id=path.match(/^\/embed\/([\w-]+)$/)?.[1]||'';provider='YouTube';}
 else if(['vimeo.com','www.vimeo.com','player.vimeo.com'].includes(host)){
  const match=host==='player.vimeo.com'?path.match(/^\/video\/([1-9]\d*)$/):path.match(/^\/([1-9]\d*)(?:\/([a-zA-Z0-9]+))?$/);
  if(!match)return null;id=match[1];hash=url.searchParams.get('h')||match[2]||'';provider='Vimeo';
  if(hash&&!/^[a-zA-Z0-9]{6,64}$/.test(hash))return null;
 }
 if(provider==='YouTube'&&!/^[a-zA-Z0-9_-]{11}$/.test(id)||provider==='Vimeo'&&!/^[1-9]\d{0,19}$/.test(id)||!provider)return null;
 const embed=new URL(provider==='YouTube'?'https://www.youtube-nocookie.com/embed/'+id:'https://player.vimeo.com/video/'+id);
 embed.searchParams.set('playsinline','1');
 if(provider==='YouTube')embed.searchParams.set('rel','0');
 if(hash)embed.searchParams.set('h',hash);
 const time=url.searchParams.get('start')||url.searchParams.get('t')||new URLSearchParams(url.hash.slice(1)).get('t')||'';
 const units=time.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/),seconds=/^\d+$/.test(time)?Number(time):units?Number(units[1]||0)*3600+Number(units[2]||0)*60+Number(units[3]||0):0;
 if(Number.isSafeInteger(seconds)&&seconds>0){if(provider==='YouTube')embed.searchParams.set('start',String(seconds));else embed.hash='t='+seconds+'s';}
 return {provider,id,embedURL:embed.href};
}
export function mediaKind(src=''){
 if(hostedVideo(src))return 'embed';
 if(/^https:\/\/(?:www\.)?(?:youtube\.com|m\.youtube\.com|youtube-nocookie\.com|youtu\.be|vimeo\.com|player\.vimeo\.com)\//i.test(src))return 'watch';
 return /\.(mp4|webm)(?:[?#]|$)/i.test(src)?'video':'image';
}
export function safeURL(src,contact=false){
 const value=String(src??'').trim();
 if(/^https?:\/\/[^\s]+$/i.test(value))return value;
 if(contact&&/^(?:mailto:|tel:)[^\s<>]+$/i.test(value))return value;
 if(!contact&&/^(?:\.\/)?assets\/[a-z0-9_./%+ ()-]+(?:[?#][^\s<>]*)?$/i.test(value)&&!value.includes('..'))return value;
 return '';
}
export function mediaURL(src,revision=''){
 const url=safeURL(src);if(!url)return '';
 if(!/^https?:\/\//i.test(url)&&revision)return url+(url.includes('?')?'&':'?')+'v='+encodeURIComponent(revision);
 return url;
}
export function normalizeContent(raw){
 const channels=(Array.isArray(raw.channels)?raw.channels:[]).filter(c=>c&&typeof c==='object').map(c=>({...c,id:String(c.id||''),label:plainText(c.label||c.id)}));
 const categories=channels.filter(c=>c.type==='guide');
 const projects=categories.flatMap(c=>(Array.isArray(c.projects)?c.projects:[]).map((p,i)=>({...p,
  category:c.id,order:i,id:c.id+'-'+String(i+1).padStart(2,'0'),title:plainText(p.title)||'Untitled project',
  tags:String(p.tags??''),desc:String(p.desc??''),writeup:String(p.writeup??''),image:String(p.image??''),caption:String(p.caption??''),
  meta:Array.isArray(p.meta)?p.meta:[],gallery:Array.isArray(p.gallery)?p.gallery:[]
 })));
 return {site:raw.site||{},channels,categories,projects};
}
export function galleryFor(project){
 const items=[{src:project.image,caption:project.caption||''},...(project.gallery||[])].filter(x=>safeURL(x.src)&&mediaKind(x.src)!=='watch');
 return [...new Map(items.map(x=>[x.src,{...x,kind:mediaKind(x.src)}])).values()];
}
export const watchLinks=project=>(project.gallery||[]).filter(x=>safeURL(x.src)&&['watch','embed'].includes(mediaKind(x.src)));
export function thumbnailFor(project){return galleryFor(project).find(x=>x.kind==='image')?.src||'';}
export function featuredProjects(projects,categories){const chosen=categories.map(c=>projects.find(p=>p.category===c.id)).filter(Boolean);return chosen.length?chosen:projects.slice(0,4);}
