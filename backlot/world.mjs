export const WIDTH=960, HEIGHT=720, GRID=8;
export const stages=[
 {id:'narrative',number:'01',name:'Narrative',place:'The soundstage',sub:'Features & episodic',x:96,y:92,w:264,h:164,door:{x:324,y:282},color:'#caaa79'},
 {id:'commercial',number:'02',name:'Commercial',place:'The commercial studio',sub:'Spots & branded content',x:592,y:92,w:272,h:164,door:{x:628,y:282},color:'#a5c9b3'},
 {id:'reality',number:'03',name:'Reality',place:'The arena',sub:'Unscripted & competition builds',x:96,y:408,w:264,h:160,door:{x:324,y:594},color:'#da9288'},
 {id:'installation',number:'04',name:'Installs',place:'The prop garden',sub:'Installations & experiential',x:592,y:408,w:272,h:160,door:{x:628,y:594},color:'#b8add5'},
 {id:'about',number:'05',name:'About Ben',place:'The workshop',sub:'The person behind the builds',x:400,y:100,w:144,h:112,door:{x:472,y:238},color:'#dbb96c'},
 {id:'contact',number:'06',name:'Contact',place:'Production office',sub:'Bookings & enquiries',x:400,y:508,w:144,h:80,door:{x:472,y:614},color:'#9ebdca'}
];
export const obstacles=[...stages.map(s=>({x:s.x-4,y:s.y-4,w:s.w+8,h:s.h+8})),
 {x:408,y:388,w:44,h:24},{x:512,y:388,w:40,h:24},
 {x:52,y:328,w:68,h:22},{x:832,y:328,w:68,h:22}];
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function blocked(x,y,r=7){return x<32+r||y<50+r||x>WIDTH-32-r||y>HEIGHT-30-r||obstacles.some(o=>x>o.x-r&&x<o.x+o.w+r&&y>o.y-r&&y<o.y+o.h+r);}
export function findPath(from,to){
 const cols=WIDTH/GRID,rows=HEIGHT/GRID,key=(x,y)=>y*cols+x;
 const start={x:Math.round(from.x/GRID),y:Math.round(from.y/GRID)};
 const requested={x:clamp(Math.round(to.x/GRID),5,cols-6),y:clamp(Math.round(to.y/GRID),8,rows-6)};
 let goal=requested;
 if(blocked(goal.x*GRID,goal.y*GRID)){
  let best=Infinity;
  for(let dy=-18;dy<=18;dy++)for(let dx=-18;dx<=18;dx++){
   const x=requested.x+dx,y=requested.y+dy,d=dx*dx+dy*dy;
   if(d<best&&!blocked(x*GRID,y*GRID)){best=d;goal={x,y};}
  }
  if(best===Infinity)return [];
 }
 const startKey=key(start.x,start.y),goalKey=key(goal.x,goal.y),open=[startKey],parents=new Map(),scores=new Map([[startKey,0]]),closed=new Set();
 let count=0;
 while(open.length&&count++<12000){
  let at=0,best=Infinity;
  for(let i=0;i<open.length;i++){const k=open[i],s=scores.get(k)+Math.abs(k%cols-goal.x)+Math.abs(Math.floor(k/cols)-goal.y);if(s<best){at=i;best=s;}}
  const current=open.splice(at,1)[0];
  if(current===goalKey){const route=[];let k=current;while(k!==startKey){route.unshift({x:(k%cols)*GRID,y:Math.floor(k/cols)*GRID});k=parents.get(k);}return route;}
  closed.add(current);const x=current%cols,y=Math.floor(current/cols);
  for(const [dx,dy] of [[0,-1],[-1,0],[1,0],[0,1]]){
   const nx=x+dx,ny=y+dy,n=key(nx,ny);if(nx<0||ny<0||nx>=cols||ny>=rows||closed.has(n)||blocked(nx*GRID,ny*GRID))continue;
   const tentative=scores.get(current)+1;
   if(tentative<(scores.get(n)??Infinity)){parents.set(n,current);scores.set(n,tentative);if(!open.includes(n))open.push(n);}
  }
 }
 return [];
}
export class World{
 constructor(){this.player={x:472,y:332,face:'down',step:0,moving:false};this.t=0;this.path=[];this.destination=null;this.arrived=null;this.walked=0;this.paused=false;this.visited=new Set();}
 goTo(point,stage=null){this.path=findPath(this.player,point);this.destination=stage;this.arrived=null;if(stage&&distance(this.player,point)<16){this.path=[];this.destination=null;this.arrived=stage;}}
 goToStage(id){const s=stages.find(s=>s.id===id);if(s)this.goTo(s.door,id);}
 nearby(){return stages.find(s=>distance(s.door,this.player)<39)||null;}
 move(dx,dy){const p=this.player,old={x:p.x,y:p.y};if(!blocked(p.x+dx,p.y))p.x+=dx;if(!blocked(p.x,p.y+dy))p.y+=dy;return distance(old,p);}
 update(dt,input={x:0,y:0}){
  if(this.paused)return;dt=Math.min(dt,.05);this.t+=dt;const p=this.player;let vx=input.x||0,vy=input.y||0,amount=0;
  if(vx||vy){this.path=[];this.destination=null;const len=Math.max(1,Math.hypot(vx,vy));vx/=len;vy/=len;amount=this.move(vx*100*dt,vy*100*dt);}
  else if(this.path.length){let budget=100*dt;
   while(budget>.0001&&this.path.length){const n=this.path[0],dx=n.x-p.x,dy=n.y-p.y,len=Math.hypot(dx,dy);if(len<.2){this.path.shift();continue;}vx=dx/len;vy=dy/len;const step=Math.min(budget,len),m=this.move(vx*step,vy*step);amount+=m;budget-=step;if(m<step*.1){this.path=[];this.destination=null;break;}if(len<=step+.1)this.path.shift();}
   if(!this.path.length&&this.destination){this.arrived=this.destination;this.destination=null;}
  }
  p.moving=amount>.01;if(p.moving){p.face=Math.abs(vx)>Math.abs(vy)?(vx>0?'right':'left'):(vy>0?'down':'up');p.step+=amount/6;this.walked+=amount;}
 }
}
