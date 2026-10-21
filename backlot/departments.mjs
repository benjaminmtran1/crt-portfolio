import {clamp} from './world.mjs?v=crew3';

export const lightingLooks=[
 {id:'work',name:'Work lights',note:'The usual studio glow. Ready for the next setup.',color:'#c4d3bb'},
 {id:'golden',name:'Golden hour',note:'One last warm take before the light goes.',color:'#efbd7b'},
 {id:'night',name:'Night shoot',note:'Blue moonlight, warm practicals. The lot stays awake.',color:'#9aade0'}
];
export const buildSteps=[
 {title:'Mark out',note:'A chalk line makes the first promise. Everything starts on the floor.'},
 {title:'Frame',note:'Rails, stiles and toggles. A doorway takes shape; braces keep the illusion upright.'},
 {title:'Skin',note:'Plywood skins turn the skeleton into a wall. The doorway stays open.'},
 {title:'Dress',note:'Paint, trim and a practical light. Ready for its close-up.'}
];
export const BUILD_LENGTH=12;
export class BuildSequence{
 constructor(reduced=false){this.elapsed=reduced?3-.000001:0;this.playing=!reduced;}
 get step(){return Math.min(3,Math.floor(this.elapsed/3));}
 get complete(){return this.elapsed>=BUILD_LENGTH;}
 progress(step){return clamp((this.elapsed-step*3)/3,0,1);}
 show(step){if(!Number.isInteger(step)||step<0||step>3)return;this.elapsed=step===3?BUILD_LENGTH:(step+1)*3-.000001;this.playing=false;}
 replay(){this.elapsed=0;this.playing=true;}
 update(dt,active=true){if(!active||!this.playing)return;this.elapsed=Math.min(BUILD_LENGTH,this.elapsed+clamp(dt,0,.05));if(this.complete)this.playing=false;}
}

const gossip=[
 'Walls are up, camera’s ready, and the coffee has become structural.',
 'That castle? Timber, paint, and a very convincing camera angle.',
 'Continuity says the doughnuts were here in the last take. We’re investigating.',
 'Someone labelled the last biscuit “HERO PROP”. Nobody’s touched it.'
];
export function crewReply(topic,found,index=0){
 if(topic==='coffee')return 'One coffee. No quest attached. Take your time — we’re still waiting on lighting.';
 if(topic==='rumour'){
  if(!found.has('cat'))return 'The shop cat knows a quiet corner. Make friends, then follow its lead.';
  if(!found.has('backstage'))return 'Try the service lane behind stages 01 and 02. The camera never sees that side.';
  if(!found.has('lighting'))return 'There’s a lighting desk beside the central avenue. Apparently it can move the sun.';
  if(!found.has('build'))return 'Someone left a tiny set on the drafting table outside the workshop. Go see how it comes together.';
  if(!found.has('take'))return 'The clapperboard is waiting for you. One take, then we can all go home.';
  return 'You’ve seen every corner of this place. At this point we should put your name on a chair.';
 }
 return gossip[index%gossip.length];
}
