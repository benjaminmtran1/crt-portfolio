// Bookmark identity is independent of the editor's project order.
export const projectKey=p=>encodeURIComponent(p.category)+':'+encodeURIComponent(p.title.trim().toLowerCase());
export const discoveryEntries=[
 ['take','Roll a take','Quiet on set. Camera rolling.'],['backstage','Behind the scenery','Timber, braces and the side the lens never sees.'],['cat','Crew approved','The shop cat has vouched for you.'],['lighting','Chase the light','Three looks, one backlot.'],['craft','Coffee break','The most important department.'],['build','From plan to set','Design. Mark out. Build. Shoot.'],['camera','Through the lens','Real builds, a few pixels at a time.'],['crew','On the crew','A few familiar faces between setups.'],['wrap','That’s a wrap','One last look before the lights go out.']
];
export function resolveBookmark(record,projects){
 const exact=projects.find(p=>projectKey(p)===record.key);if(exact)return exact;
 const matches=record.image?projects.filter(p=>p.category===record.category&&p.image===record.image):[];
 return matches.length===1?matches[0]:null;
}
export class FieldNotebook{
 constructor(raw){
  let data;try{data=JSON.parse(raw||'{}');}catch{data={};}if(!data||typeof data!=='object')data={};
  this.saved=Array.isArray(data.saved)?data.saved.filter(r=>r&&typeof r.key==='string'&&typeof r.title==='string'&&typeof r.category==='string'&&typeof r.image==='string').slice(0,100):[];
  this.saved=[...new Map(this.saved.map(r=>[r.key,r])).values()];
  this.met=new Set(Array.isArray(data.met)?data.met.filter(id=>['scenic','grip','pa','craft'].includes(id)):[]);
 }
 has(project,projects){return this.saved.some(r=>resolveBookmark(r,projects)===project);}
 toggle(project,projects){const index=this.saved.findIndex(r=>resolveBookmark(r,projects)===project);if(index>=0){this.saved.splice(index,1);return false;}this.saved.push({key:projectKey(project),title:project.title,category:project.category,image:project.image});return true;}
 remove(key){this.saved=this.saved.filter(r=>r.key!==key);}
 serialize(){return JSON.stringify({version:1,saved:this.saved,met:[...this.met]});}
}
