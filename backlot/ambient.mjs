import {crew} from './encounters.mjs?v=cleanup1';
import {findPath,distance,clamp,GRID,scenicStation,carpenterStation} from './world.mjs?v=cleanup1';
const stop=(x,y,hold,task,face,carry=false)=>({point:{x,y},hold,task,face,carry});
const scripts={
 scenic:[stop(scenicStation.mix.x,scenicStation.mix.y,4,'mix','down'),stop(scenicStation.paint.x,scenicStation.paint.y,7,'paint','right')],
 grip:[stop(carpenterStation.measure.x,carpenterStation.measure.y,3,'measure','down',true),stop(carpenterStation.stack.x,carpenterStation.stack.y,4,'stack','left')],
 pa:[stop(560,608,4,'radio','left'),stop(576,480,5,'radio','left')]
};
function route(from,to){
 const start={x:Math.round(from.x/GRID)*GRID,y:Math.round(from.y/GRID)*GRID};
 return [start,...findPath(start,to)];
}
export class CrewRoutines{
 constructor(){this.people=crew.map(p=>({...p.point,id:p.id,coat:p.coat,face:'down',moving:false,step:0,time:0,task:scripts[p.id][0].task,stop:0,wait:scripts[p.id][0].hold,path:[]}));}
 pose(id){return this.people.find(p=>p.id===id);}
 update(dt,world,reduced=false){
  if(world.paused||reduced)return;dt=clamp(dt,0,.05);
  for(const p of this.people){
   p.moving=false;
   // Stop early enough for a click destination to remain stable on approach.
   if(world.destination==='egg:'+p.id||world.arrived==='egg:'+p.id||distance(p,world.player)<64){const dx=world.player.x-p.x,dy=world.player.y-p.y;p.face=Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up');continue;}
   p.time+=dt;
   const script=scripts[p.id];
   if(p.wait>0){p.wait-=dt;p.face=script[p.stop].face;p.task=script[p.stop].task;continue;}
   if(!p.path.length){const next=(p.stop+1)%script.length;p.task=script[p.stop].carry?'carry':'walk';p.path=route(p,script[next].point);p.stop=next;}
   let budget=(p.id==='grip'?28:p.id==='pa'?35:25)*dt;
   while(budget>0&&p.path.length){const point=p.path[0],dx=point.x-p.x,dy=point.y-p.y,length=Math.hypot(dx,dy);if(length<.001){p.path.shift();continue;}const amount=Math.min(length,budget);p.x+=dx/length*amount;p.y+=dy/length*amount;p.step+=amount/6;p.face=Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up');p.moving=true;budget-=amount;if(amount>=length-.001)p.path.shift();}
   if(!p.path.length){p.wait=script[p.stop].hold;p.task=script[p.stop].task;p.face=script[p.stop].face;}
  }
 }
}
