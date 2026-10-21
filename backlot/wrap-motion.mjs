import {findPath,GRID,HEIGHT,distance,clamp} from './world.mjs?v=living1';
import {crew} from './encounters.mjs?v=pocket1';

// Build routes once, then sample by distance. Absolute time makes pause, manual
// chapter selection and replay deterministic without moving the live lot actors.
export const wrapExit={x:472,y:680};
const exitEnd={x:wrapExit.x,y:HEIGHT+34};
export const WRAP_WALK_SPEED=90;
export function createWrapCast(people=crew){return people.map((item,index)=>{
 const person=item.point?item:{...item,point:{x:item.x,y:item.y}};
 const start={x:Math.round(person.point.x/GRID)*GRID,y:Math.round(person.point.y/GRID)*GRID};
 const path=findPath(start,wrapExit);
 // A missing route must never fall back to a straight line through scenery.
 const points=path.length?[person.point,start,...path,exitEnd]:[person.point];
 const segments=[];let length=0;
 for(let i=1;i<points.length;i++){
  const from=points[i-1],to=points[i],span=distance(from,to);if(!span)continue;
  segments.push({from,to,span,start:length});length+=span;
 }
 return {person,segments,length,delay:index*.35};
});}
const routes=createWrapCast();
export function wrapActorsAt(elapsed,cast=null){
 return (cast||routes).map(({person,segments,length,delay})=>{
  const walked=clamp((elapsed-delay)*WRAP_WALK_SPEED,0,length);
  const segment=segments.find(s=>walked<s.start+s.span)||segments.at(-1);
  if(!segment)return {...person.point,coat:person.coat,id:person.id,face:'down',step:0,moving:false,exited:false};
  const {from,to,span,start}=segment,t=clamp((walked-start)/span,0,1),dx=to.x-from.x,dy=to.y-from.y;
  return {id:person.id,coat:person.coat,x:from.x+dx*t,y:from.y+dy*t,
   face:Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up'),
   step:walked/6,moving:elapsed>delay&&walked<length,exited:walked>=length};
 });
}
