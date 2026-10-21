// Real DOM/event checks with linkedom, also used by admin-editor.test.mjs.
// Run with ADMIN_DOM_MODULE=/absolute/path/to/linkedom when not installed locally.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {World,stages,WIDTH,HEIGHT,distance} from '../world.mjs';
import {LotLife} from '../life.mjs';
import {BuildSequence,buildSteps,lightingLooks} from '../departments.mjs';
import * as contentAPI from '../content.mjs';
const require=createRequire(import.meta.url),{parseHTML}=require(process.env.ADMIN_DOM_MODULE||'linkedom');
const root=new URL('../../',import.meta.url),html=fs.readFileSync(new URL('index.html',root),'utf8'),raw=JSON.parse(fs.readFileSync(new URL('content.json',root),'utf8'));
const source=fs.readFileSync(new URL('backlot/app.mjs',root),'utf8').replace(/^import .*;\n/gm,'');
async function boot(reduced=false,saved={}){
 const {document,Event}=parseHTML(html),get=s=>document.querySelector(s),storage=new Map(Object.entries(saved)),listeners=new Map(),drawn=[];
 document.fonts={ready:Promise.resolve()};document.hidden=false;let focused=true,now=0;
 document.hasFocus=()=>focused;get('#panel').open=false;get('#panel').showModal=function(){this.open=true;};get('#panel').close=function(){this.open=false;this.dispatchEvent(new Event('close'));};
 for(const el of document.querySelectorAll('*')){el.getBoundingClientRect=()=>({left:0,top:0,right:900,bottom:720,width:900,height:720});el.focus=function(){document.activeElement=this;};}
 document.activeElement=document.body;
 const proto=Object.getPrototypeOf(document.createElement('div'));proto.scrollIntoView=function(){};proto.pause=function(){this.pausedByApp=true;};proto.load=function(){this.unloadedByApp=true;};
 const renderer=new Proxy({camera:{},drawConstruction(_c,s){drawn.push({elapsed:s.elapsed,step:s.step});},screenToWorld:(x,y)=>({x,y})},{get:(o,k)=>k in o?o[k]:()=>{}});
 const env={document,window:{addEventListener:(k,fn)=>listeners.set(k,fn)},getComputedStyle:()=>({flexDirection:'column',gap:'0'}),matchMedia:q=>({matches:q.includes('reduced-motion')?reduced:false}),localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},location:{hash:'',pathname:'/',search:''},history:{replaceState(){}},ResizeObserver:class{observe(){}},requestAnimationFrame(){},setTimeout(){},clearTimeout(){},fetch:async()=>({ok:true,json:async()=>structuredClone(raw)}),console,URLSearchParams,World,stages,WIDTH,HEIGHT,distance,LotLife,BuildSequence,buildSteps,lightingLooks,...contentAPI,Renderer:class{constructor(){return renderer;}},TitleScene:class{resize(){}render(){}}};
 const app=await vm.runInNewContext('(async()=>{'+source+'\nreturn {dismissIntro,openProject,changePhoto,closePanel,openIndex,openAbout,openSettings,openBuild,contentLoaded};})()',env);
 app.dismissIntro();
 return{app,get,document,Event,storage,drawn,focus:v=>{focused=v;},advance(seconds){for(let i=0;i<seconds*60;i++)app.frame(now+=1000/60);},click(s){const b=get(s);assert.ok(b,s);b.dispatchEvent(new Event('click',{bubbles:true}));}};
}
const t=await boot(),{app,get,document}=t;
function film(){app.openProject('commercial-02');t.click('[data-watch]');const frame=get('iframe[data-film-player]');assert.ok(frame);return frame;}
function stopped(frame){assert.equal(frame.getAttribute('src'),'about:blank');assert.equal(frame.isConnected,false);assert.equal(document.querySelectorAll('iframe[data-film-player]').length,0);}
{
 app.openProject('commercial-02');assert.ok(get('#gallery-image'));assert.equal(get('iframe'),null);assert.equal(get('[data-watch]').tagName,'BUTTON');
 const before=JSON.stringify(raw),frame=film();assert.ok(frame.getAttribute('src').includes('PiSPYPvDHnY'));assert.ok(frame.getAttribute('src').includes('playsinline=1'));assert.ok(frame.hasAttribute('allowfullscreen'));assert.ok(!frame.getAttribute('src').includes('autoplay'));assert.equal(frame.getAttribute('referrerpolicy'),'strict-origin-when-cross-origin');assert.ok(frame.getAttribute('title').includes('Cupra'));assert.ok(get('.video-fallback').getAttribute('href').includes('youtube.com/watch'));assert.equal(get('.video-fallback').getAttribute('target'),'_blank');
 t.click('[data-watch]');assert.equal(get('iframe[data-film-player]'),frame,'Repeated Watch does not restart the current film');
 app.changePhoto(0);stopped(frame);assert.ok(get('#gallery-image'));assert.equal(JSON.stringify(raw),before,'Viewing never rewrites project content');
}
for(const end of [()=>t.click('[data-close]'),()=>get('#panel').close(),()=>app.openProject('commercial-03'),()=>app.openIndex(),()=>app.openAbout(),()=>app.openSettings(),()=>app.openBuild()]){const frame=film();end();stopped(frame);}
for(const [project,id] of [['commercial-02','PiSPYPvDHnY'],['commercial-03','uHDmH2Z8I6M'],['commercial-04','SUqkJ00fWx8']]){app.openProject(project);t.click('[data-watch]');assert.ok(get('iframe[data-film-player]').getAttribute('src').includes(id));assert.equal(document.querySelectorAll('iframe[data-film-player]').length,1);app.closePanel();assert.equal(document.querySelectorAll('iframe[data-film-player]').length,0);}
{
 const fixture=structuredClone(raw),p=fixture.channels.find(c=>c.id==='commercial').projects[1];p.gallery=[{src:'assets/test.mp4',caption:'Native video'},{src:'https://vimeo.com/123456789/abcdef1234',caption:'Vimeo film'},{src:'https://youtube.com/playlist?list=abc',caption:'External playlist'}];app.contentLoaded(fixture);app.openProject('commercial-02');app.changePhoto(1);
 const video=get('video');assert.ok(video);for(const attr of ['controls','playsinline'])assert.ok(video.hasAttribute(attr));assert.equal(video.getAttribute('preload'),'metadata');assert.equal(video.hasAttribute('autoplay'),false);app.changePhoto(2);assert.ok(video.pausedByApp);assert.ok(video.unloadedByApp);assert.equal(video.hasAttribute('src'),false);assert.equal(video.isConnected,false);assert.ok(get('iframe').getAttribute('src').includes('h=abcdef1234'));assert.ok(get('.video-fallback').textContent.includes('Vimeo'));
 assert.equal(get('a.watch-link').getAttribute('href'),'https://youtube.com/playlist?list=abc','Unsupported provider URLs remain explicit external links, never iframes');
 app.changePhoto(1);const reopened=get('video');app.closePanel();assert.ok(reopened.pausedByApp);assert.ok(reopened.unloadedByApp);
}
console.log('Popup video DOM passed: current three films, Watch/gallery selection, repeated selection, safe fallback, inline/fullscreen/manual playback attributes, Vimeo privacy hash, native MP4 pause/unload, close/Escape-equivalent lifecycle, gallery/project/index/other-panel transitions, reopen and data preservation. Actual playback remains a browser check.');
