// Shared with the existing Control Room: content.json and assets/ remain canonical.
export const plainText=value=>String(value??'').replace(/<br\s*\/?\s*>/gi,' ').replace(/<[^>]*>/g,'').trim();
export function mediaKind(src=''){
 if(/^https:\/\/(?:www\.)?(?:youtube\.com|youtu\.be|vimeo\.com|player\.vimeo\.com)\//i.test(src))return 'watch';
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
export const watchLinks=project=>(project.gallery||[]).filter(x=>safeURL(x.src)&&mediaKind(x.src)==='watch');
export function thumbnailFor(project){return galleryFor(project).find(x=>x.kind==='image')?.src||'';}
export function featuredProjects(projects,categories){const chosen=categories.map(c=>projects.find(p=>p.category===c.id)).filter(Boolean);return chosen.length?chosen:projects.slice(0,4);}
