import {CrewRoutines} from './ambient.mjs?v=cleanup1';
import {distance,findPath,clamp,craftStop,craftHit,cameraStop,cameraHit,lotSlate,draftingTable,foundScrew} from './world.mjs?v=screw1';
import {lightingLooks,crewReply} from './departments.mjs?v=crew3';

import {crew} from './encounters.mjs?v=cleanup1';

// These props share the same walkable space as the portfolio destinations.
export const curiosities=[
 {id:'camera',point:cameraStop,label:'Look through the camera',caption:'CAMERA / VIEWFINDER',radius:28},
 {id:'wrap',point:{x:392,y:640},label:'Call it a day',caption:'THE WRAP BELL',radius:30},
 ...crew.map(person=>({id:person.id,point:person.point,label:'Talk to '+person.name,caption:person.role.toUpperCase(),radius:28})),
 {id:'slate',point:lotSlate,label:'Roll a take',caption:'THE CLAPPERBOARD',radius:38},
 {id:'rear-narrative',point:{x:224,y:64},label:'Look behind the set',caption:'REAR OF STAGE 01',category:'narrative',radius:40},
 {id:'rear-commercial',point:{x:736,y:64},label:'Look behind the set',caption:'REAR OF STAGE 02',category:'commercial',radius:40},
 {id:'lighting',point:{x:568,y:440},label:'Try the lights',caption:'THE LIGHTING DESK',radius:36},
 {id:'craft',point:craftStop,label:'Take a break',caption:'CRAFT SERVICES',radius:36},
 {id:'build',point:draftingTable,label:'Build a little set',caption:'THE DRAFTING TABLE',radius:34},
 {id:'screw',point:foundScrew.stop,label:'Pick up the screw',caption:'SOMETHING SHINY',radius:26}
];
export const catHome={x:416,y:240},catNook={x:736,y:640};
export const CAT_REST=8;
export const TAKE_LENGTH=10.5;
const discoveries=new Set(['take','backstage','cat','lighting','craft','build','camera','crew','wrap','screw']);

export class LotLife{
 constructor(saved=[]){
  this.found=new Set(Array.isArray(saved)?saved.filter(id=>discoveries.has(id)):[]);
  // Trust is persistent; location is not. Returning visitors can follow again.
  this.cat={...catHome,mode:'idle',face:'right',moving:false,step:0,heart:0,waiting:false,rest:0,idleTime:3,stroll:0};
  this.catPath=[];this.take=null;this.takeNumber=0;this.events=[];this.crewTime=0;this.lighting='work';this.chatCount=0;this.reduced=false;this.treasure=0;
  // A fresh takeaway lasts for this visit, independently of the saved craft stamp.
  this.hasCoffee=false;this.routines=new CrewRoutines();
 }
 discover(id){if(!this.found.has(id)){this.found.add(id);this.events.push({type:'discovery',id});}}
 selectLight(id){if(!lightingLooks.some(look=>look.id===id))return;this.lighting=id;this.discover('lighting');this.events.push({type:'lighting-change',id});}
 chat(topic){const reply=crewReply(topic,this.found,this.chatCount);if(topic==='day')this.chatCount++;if(topic==='coffee')this.hasCoffee=true;this.discover('craft');return reply;}
 crewHotspots(){return curiosities.filter(item=>item.id!=='screw'||!this.found.has('screw')).map(item=>this.routines.pose(item.id)?{...item,point:this.routines.pose(item.id)}:item);}
 hotspot(id){return id==='cat'?{id,point:this.cat,label:'Pet the cat',caption:this.cat.mode==='trusted'?'CREW APPROVED':this.cat.mode==='nook'?'THE CAT’S SECRET SPOT':'THE SHOP CAT',radius:38}:this.crewHotspots().find(item=>item.id===id);}
 nearby(player){if(this.take)return null;return [...this.crewHotspots(),this.hotspot('cat')].filter(item=>distance(item.point,player)<item.radius).sort((a,b)=>distance(a.point,player)-distance(b.point,player))[0]||null;}
 hit(point){if(this.take)return null;if(point.x>=cameraHit.x&&point.x<=cameraHit.x+cameraHit.w&&point.y>=cameraHit.y&&point.y<=cameraHit.y+cameraHit.h)return this.hotspot('camera');if(point.x>=378&&point.x<=421&&point.y>=571&&point.y<=630)return this.hotspot('wrap');if(Object.values(craftHit).some(r=>point.x>=r.x&&point.x<r.x+r.w&&point.y>=r.y&&point.y<r.y+r.h))return this.hotspot('craft');return [...this.crewHotspots(),this.hotspot('cat')].find(item=>Math.abs(point.x-item.point.x)<(item.id==='cat'?18:24)&&point.y>item.point.y-28&&point.y<item.point.y+12)||null;}
 backstage(player){return player.y<94?curiosities.find(item=>item.category&&Math.abs(player.x-item.point.x)<125)?.category:null;}
 interact(id,world){
  if(this.take)return;
  if(id==='screw'&&!this.found.has('screw')){
   world.path=[];world.destination=null;world.arrived=null;world.player.moving=false;
   this.treasure=2.8;this.discover('screw');this.events.push({type:'screw-found'});return;
  }
  if(id==='slate'){
   world.path=[];world.destination=null;world.arrived=null;world.player.moving=false;
   this.take={elapsed:0,number:++this.takeNumber};this.crewTime=world.t;this.events.push({type:'take-start'});return;
  }
  const item=this.hotspot(id);if(item?.category){this.discover('backstage');this.events.push({type:'backstage',category:item.category});return;}
  if(['lighting','craft','build','camera','wrap',...crew.map(p=>p.id)].includes(id)){this.events.push({type:id});return;}
  if(id!=='cat')return;
  const cat=this.cat;cat.heart=2;
  if(cat.mode==='idle'){
   cat.mode='leading';cat.waiting=false;this.catPath=findPath(cat,catNook);this.events.push({type:'cat-follow'});
  }else if(cat.mode==='nook'){
   const known=this.found.has('cat');cat.mode='trusted';cat.rest=CAT_REST;this.discover('cat');this.events.push({type:known?'cat-purr':'cat-approved'});
  }else this.events.push({type:cat.mode==='leading'?'cat-follow':'cat-purr'});
 }
 get phase(){if(!this.take)return '';return this.take.elapsed<1.5?'quiet':this.take.elapsed<8.5?'action':'cut';}
 get actionProgress(){return this.take?clamp((this.take.elapsed-1.5)/7,0,1):0;}
 finishTake(skipped=false){if(!this.take)return;this.take=null;if(!skipped)this.discover('take');this.events.push({type:'take-end',skipped});}
 update(dt,world){
  if(world.paused)return;dt=clamp(dt,0,.05);
  this.treasure=Math.max(0,this.treasure-dt);
  if(this.take){this.take.elapsed+=dt;if(this.take.elapsed>=TAKE_LENGTH)this.finishTake();return;}
  this.crewTime=world.t;this.routines.update(dt,world,this.reduced);
  const cat=this.cat;cat.heart=Math.max(0,cat.heart-dt);cat.moving=false;
  cat.waiting=false;
  if(cat.mode==='nook')return; // The first reward never expires while exploring.
  if(cat.mode==='trusted'){
   cat.rest=Math.max(0,cat.rest-dt);if(cat.rest>0)return;
   cat.mode='returning';this.catPath=findPath(cat,catHome);
  }
  if(cat.mode==='idle'){
   // A small workshop stroll, just like before the crew discovery was added.
   // Stop near a visitor so clicking or tapping the cat stays straightforward.
   if(this.reduced||distance(cat,world.player)<56)return;
   if(!this.catPath.length){cat.idleTime-=dt;if(cat.idleTime>0)return;cat.stroll=1-cat.stroll;this.catPath=findPath(cat,{x:cat.stroll?400:424,y:catHome.y});}
  }
  // Only the outward guide waits for the player; the return is its own stroll.
  if(cat.mode==='leading')cat.waiting=distance(cat,world.player)>88;
  if(cat.waiting||cat.heart>1.25)return;
  let budget=(cat.mode==='idle'?12:52)*dt;
  while(budget>0&&this.catPath.length){
   const next=this.catPath[0],dx=next.x-cat.x,dy=next.y-cat.y,length=Math.hypot(dx,dy);
   if(length<.01){this.catPath.shift();continue;}
   const step=Math.min(budget,length);cat.x+=dx/length*step;cat.y+=dy/length*step;budget-=step;
   cat.face=Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up');cat.moving=true;cat.step+=step/5;
   if(step>=length-.001)this.catPath.shift();
  }
  if(!this.catPath.length){
   cat.waiting=false;cat.moving=false;
   if(cat.mode==='leading'){cat.mode=this.found.has('cat')?'trusted':'nook';cat.rest=CAT_REST;this.events.push({type:'cat-arrived'});}
   else if(cat.mode==='returning'){cat.mode='idle';cat.idleTime=3;}
   else cat.idleTime=3;
  }
 }
 drain(){return this.events.splice(0);}
}

