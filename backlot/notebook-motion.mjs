// Only the current request may replace a leaf. Closing or changing dialogs
// cancels both animation and any deferred render, including rapid repeated turns.
export class NotebookPageTurn{
 constructor(){this.revision=0;this.animation=null;}
 cancel(){this.revision++;this.animation?.cancel();this.animation=null;}
 async play(page,frames,duration){
  if(!page?.animate)return;
  try{this.animation=page.animate(frames,{duration,easing:'cubic-bezier(.45,0,.2,1)',fill:'both'});await this.animation.finished;}catch{}
 }
 async turn(getPage,render,{direction=1,reduced=false,active=()=>true}={}){
  this.cancel();const revision=this.revision,page=getPage();
  if(!active())return false;
  if(reduced||!page?.animate){render();return true;}
  const origin=direction>0?'0% 50%':'100% 50%',angle=direction>0?-76:76;
  await this.play(page,[
   {transform:'rotateY(0deg)',transformOrigin:origin,filter:'brightness(1)',boxShadow:'none'},
   {transform:'rotateY('+angle+'deg)',transformOrigin:origin,filter:'brightness(.78)',boxShadow:'12px 2px 24px #29392d40'}
  ],180);
  if(revision!==this.revision)return false;
  if(!active()){this.animation?.cancel();this.animation=null;return false;}
  this.animation?.cancel();this.animation=null;render();
  await this.play(getPage(),[
   {transform:'rotateY('+(-angle*.65)+'deg)',transformOrigin:origin,filter:'brightness(.86)',boxShadow:'8px 2px 18px #29392d30'},
   {transform:'rotateY(0deg)',transformOrigin:origin,filter:'brightness(1)',boxShadow:'none'}
  ],240);
  if(revision===this.revision){this.animation?.cancel();this.animation=null;}
  return revision===this.revision;
 }
}
