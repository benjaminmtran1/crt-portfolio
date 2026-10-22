import {drawCrewPortrait} from './crew-art.mjs?v=pocket2';
import {FieldNotebook,discoveryEntries,resolveBookmark,notebookLeaves} from './notebook.mjs?v=screw1';
import {NotebookPageTurn} from './notebook-motion.mjs?v=pocket1';
import {createWrapCast} from './wrap-motion.mjs?v=cleanup1';
import {crew,cameraBuilds,projectTerms,drawViewfinder,wrapChapters,wrapStep} from './encounters.mjs?v=fivebuilds1';
import {TitleScene} from './title-scene.mjs?v=fivebuilds1';
import {World,stages,WIDTH,HEIGHT,distance} from './world.mjs?v=screw1';
import {Renderer} from './renderer.mjs?v=screw1';
import {LotLife} from './life.mjs?v=screw1';
import {BuildSequence,buildSteps,lightingLooks} from './departments.mjs?v=drafting1';
import {normalizeContent,mediaURL,mediaKind,hostedVideo,galleryFor,watchLinks,thumbnailFor,featuredProjects,plainText,safeURL} from './content.mjs?v=video1';
const $=s=>document.querySelector(s),world=new World(),renderer=new Renderer($('#world'));
const titleScene=new TitleScene($('#title-scene'));
function syncTitleBuild(build) {
 $('#title-set-number').textContent=`ON STAGE / ${String(build.index+1).padStart(2,'0')}`;
 $('#title-set-name').textContent=build.title;$('#title-set-detail').textContent=build.detail;
 $('#title-set-description').textContent=build.description;
 const pause=$('#title-set-pause');pause.hidden=build.reduced;pause.setAttribute('aria-pressed',String(build.paused));pause.textContent=build.paused?'▶':'II';pause.setAttribute('aria-label',build.paused?'Resume the set changes':'Pause the set changes');
}
titleScene.onBuildChange=syncTitleBuild;
$('#title-set-prev').onclick=()=>titleScene.stepBuild(-1);
$('#title-set-next').onclick=()=>titleScene.stepBuild(1);
$('#title-set-pause').onclick=()=>titleScene.toggleBuilds();
const panel=$('#panel'),panelInner=$('#panel-inner'),keys=new Set(),stick={x:0,y:0};
let content,categories=[],revision='',projects=[],filter='all',galleryIndex=0,activeProject=null,previousFocus=null,feature=0,nearbyId='',last=0,mapClock=0,toastTimer,treasureTimer,welcomed=false,titleClock=0,takePhase='',entering=false,enterTimer=0,revealTimer=0;
const settings={rain:true,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,sound:false};
const safeRead=k=>{try{return localStorage.getItem(k);}catch{return null;}};
const save=(k,v)=>{try{localStorage.setItem(k,v);return true;}catch{return false;}};
const notebook=new FieldNotebook(safeRead('backlot-notebook-v1'));let notebookTab='saved',notebookPage=0,wrapCast=null;const notebookTurn=new NotebookPageTurn();
let crewSave=[];try{crewSave=JSON.parse(safeRead('backlot-crew-v1')||'[]');}catch{}
const life=new LotLife(crewSave);world.paused=true;
const savedLight=safeRead('backlot-light-v1');if(lightingLooks.some(look=>look.id===savedLight))life.lighting=savedLight;
let cameraIndex=0,cameraWide=false,wrapElapsed=null,wrapPlaying=false,wrapChapter=-1;const crewVisits={};
let buildSequence=null,buildStep=-1;
try{const stored=JSON.parse(safeRead('backlot-display-v1')||'{}');if(typeof stored.rain==='boolean')settings.rain=stored.rain;if(typeof stored.reduced==='boolean'&&!settings.reduced)settings.reduced=stored.reduced;for(const id of JSON.parse(safeRead('backlot-visited-v1')||'[]'))if(stages.some(s=>s.id===id))world.visited.add(id);}catch{}
const escape=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const pic=path=>mediaURL(path,revision);
const channel=id=>content?.channels.find(s=>s.id===id)||{};
const stage=id=>stages.find(s=>s.id===id)||(channel(id).id?{id,number:'+',name:channel(id).label||id,place:'Work index',sub:channel(id).sub||''}:null);
const photos=p=>galleryFor(p);
const videoLinks=p=>watchLinks(p);
const placeholder='backlot/assets/placeholder.svg';
const displayName=()=>plainText(content?.site.heroName)||'BENJAMIN TRAN';
function contentLoaded(raw){
 content=normalizeContent(raw);categories=content.categories;projects=content.projects;revision=content.site.updatedAt||String(Date.now());
 document.title=plainText(content.site.pageTitle)||'Benjamin Tran';$('#identity-name').textContent=displayName();$('#home-button').setAttribute('aria-label',displayName()+', return to the lot entrance');
 const signal=channel('signal');if(signal.sub)$('#identity-role').textContent=plainText(signal.sub);
 $('#title-name').setAttribute('aria-label',displayName());const words=displayName().split(/\s+/),surname=words.pop();$('#title-name').replaceChildren(...[words.join(' '),surname].filter(Boolean).map((word,row)=>{const span=document.createElement('span');span.className='title-word';span.setAttribute('aria-hidden','true');span.style.setProperty('--letters',word.length);for(const [i,character] of [...word.toUpperCase()].entries()){const letter=document.createElement('i');letter.textContent=character;letter.style.setProperty('--letter-color',['#ffd39a','#ff657a','#35d6c5','#7e9cff'][(i+row)%4]);letter.style.setProperty('--tilt',[-3,2,-1,3,0,-2,2,-1][i%8]+'deg');span.append(letter);}return span;}));fitTitle();$('#title-credit').textContent=displayName();$('#crew-seal').hidden=!life.found.has('cat');
 for(const s of stages){const c=channel(s.id);if(c.label)s.name=c.label;if(c.sub)s.sub=c.sub;}
 syncNotebookButton();renderer.build();renderer.render(world,1);$('#index-button span').textContent=projects.length;
}
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3000);}
function dismissTreasure(){clearTimeout(treasureTimer);const hud=$('#treasure-hud');if(hud)hud.hidden=true;}
function showTreasure(){const hud=$('#treasure-hud');hud.hidden=false;clearTimeout(treasureTimer);treasureTimer=setTimeout(dismissTreasure,settings.reduced?2200:2800);ambience.cue('reward');}
function resetInput(){keys.clear();releaseJoy();}
function fitTitle(){const h=$('#title-name');if(!h)return;const rows=[...h.children],available=h.clientWidth;rows.forEach(row=>row.style.removeProperty('--fit'));if(getComputedStyle(h).flexDirection==='row'){const width=rows.reduce((sum,row)=>sum+row.scrollWidth,0)+parseFloat(getComputedStyle(h).gap||0);if(width>available&&available>0)rows.forEach(row=>row.style.setProperty('--fit',String((available-24)/(width-24))));}else for(const row of rows){if(row.scrollWidth>available&&available>0)row.style.setProperty('--fit',String(available/row.scrollWidth));}}
function cancelTitleEntry(){clearTimeout(enterTimer);clearTimeout(revealTimer);entering=false;const wipe=$('#scene-transition');wipe.hidden=true;wipe.classList.remove('closed');$('.app').classList.remove('revealing');if(content){$('#start-button').disabled=false;$('#title-work').disabled=false;}}
function startHint(){toast(matchMedia('(pointer:coarse)').matches?'Tap a set, or use the stick to explore.':'Click a set, or use WASD to explore.');}
function enterBacklot(){
 if(welcomed||entering||!content)return;ambience.cue('start');
 if(settings.reduced){dismissIntro();startHint();return;}
 entering=true;resetInput();$('#start-button').disabled=true;$('#title-work').disabled=true;const wipe=$('#scene-transition');wipe.hidden=false;
 requestAnimationFrame(()=>{if(entering)wipe.classList.add('closed');});
 enterTimer=setTimeout(()=>{$('#title-screen').hidden=true;$('.app').classList.add('revealing');wipe.classList.remove('closed');revealTimer=setTimeout(()=>{cancelTitleEntry();dismissIntro();startHint();},300);},280);
}
function dismissIntro(){if(welcomed||!content)return;welcomed=true;$('#title-screen').hidden=true;$('.app').inert=false;$('.skip').href='#index-button';$('#lot').classList.add('playing');resetInput();world.paused=document.hidden;ambience.pause(world.paused);$('#world').focus({preventScroll:true});}
function showTitle(){cancelTitleEntry();dismissTreasure();closePanel();if(life.take){life.finishTake(true);handleLifeEvents();}welcomed=false;world.paused=true;world.path=[];world.destination=null;world.arrived=null;resetInput();$('.app').inert=true;$('#title-screen').hidden=false;$('.skip').href='#title-work';ambience.pause(true);resize();$('#start-button').focus({preventScroll:true});}
function mark(id){world.visited.add(id);save('backlot-visited-v1',JSON.stringify([...world.visited]));const count=stages.filter(s=>Number(s.number)<5&&world.visited.has(s.id)).length;$('#visited-count').textContent=`${count} OF 4 SETS VISITED`;}
function openPanel(kind=''){dismissTreasure();if(kind!=='notebook')notebookTurn.cancel();if(kind!=='wrap'){wrapElapsed=null;wrapPlaying=false;}panel.dataset.kind=kind;if(kind!=='build')buildSequence=null;resetInput();world.path=[];world.destination=null;world.arrived=null;world.paused=true;if(!panel.open){previousFocus=document.activeElement;panel.showModal();}panel.scrollTop=0;ambience.pause(true);}
function stopMedia(root){
 root.querySelectorAll('video').forEach(video=>{video.pause();video.removeAttribute('src');video.load();});
 root.querySelectorAll('iframe[data-film-player]').forEach(frame=>{frame.src='about:blank';frame.remove();});
}
function closePanel(){notebookTurn.cancel();if(panel.open)panel.close();}
panel.addEventListener('close',()=>{notebookTurn.cancel();wrapElapsed=null;wrapPlaying=false;buildSequence=null;stopMedia(panelInner);world.paused=!welcomed||document.hidden;resetInput();ambience.pause(world.paused||!!life.take);history.replaceState(null,'',location.pathname+location.search);const focus=!welcomed?$('#start-button'):previousFocus?.isConnected&&!previousFocus.closest('[hidden]')?previousFocus:$('#world');focus.focus({preventScroll:true});});
panel.addEventListener('click',e=>{if(e.target!==panel)return;const r=panel.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closePanel();});
function bar(label,back=''){return `<div class="panel-bar">${back?`<button data-back="${escape(back)}">← ${escape(stage(back)?.name||'Work index')}</button>`:`<span class="panel-label">${escape(label)}</span>`}<span>${escape(displayName())} / THE BACKLOT</span><button class="panel-close" data-close aria-label="Close window and return to the set">×</button></div>`;}
function heading(kicker,title,description,count=''){return `<div class="panel-heading"><div><div class="eyebrow">${escape(kicker)}</div><h2 id="panel-title" tabindex="-1">${escape(title)}</h2><p>${escape(description)}</p></div>${count?`<span class="count-mark" aria-hidden="true">${escape(count)}</span>`:''}</div>`;}
function focusHeading(){requestAnimationFrame(()=>$('#panel-title')?.focus({preventScroll:true}));}
function projectButton(p){return `<button class="project" data-project="${escape(p.id)}"><div class="project-visual"><img src="${escape(pic(thumbnailFor(p))||placeholder)}" alt="${escape(p.title)} — project image" loading="lazy" decoding="async" width="400" height="250"></div><div class="project-meta"><span>${escape(stage(p.category).name)}</span><span>${String(p.order+1).padStart(2,'0')}</span></div><h3>${escape(p.title.trim())}</h3>${p.tags.trim()?`<p>${escape(p.tags.trim())}</p>`:'<p></p>'}</button>`;}
function renderProjects(query=''){const q=query.toLowerCase().trim();const shown=projects.filter(p=>(filter==='all'||p.category===filter)&&(!q||`${p.title} ${p.tags} ${stage(p.category).name}`.toLowerCase().includes(q)));$('#project-list').innerHTML=shown.length?shown.map(projectButton).join(''):'<p class="empty">No matching projects. Try a different title or role.</p>';$('#results-count').textContent=`${shown.length} projects`;}
function openIndex(id='all'){
 if(!content)return;filter=id;const s=stage(id),selected=projects.filter(p=>id==='all'||p.category===id);if(s)mark(id);
 const c=channel(id),reel=c.reel?.kind!=='none'&&safeURL(c.reel?.src)?`<div class="category-reel"><a href="${escape(pic(c.reel.src))}" target="_blank" rel="noopener noreferrer">${escape(c.reel.caption||'WATCH THE REEL')} ↗</a></div>`:'';
 stopMedia(panelInner);panelInner.innerHTML=bar(s?`SET ${s.number} / ${s.place.toUpperCase()}`:'THE WORK / PROJECT INDEX')+heading(s?`LOCATION ${s.number} / ${c.title||s.place.toUpperCase()}`:`${projects.length} PROJECTS / ${categories.length} DEPARTMENTS`,s?s.name:'The work.',s?s.sub:'Explore the finished worlds and the work behind them.',String(selected.length).padStart(2,'0'))+reel+
 `<div class="filter-row" aria-label="Filter work"><button data-filter="all" class="${id==='all'?'active':''}" aria-pressed="${id==='all'}">All work <small>${projects.length}</small></button>${categories.map(c=>`<button data-filter="${escape(c.id)}" class="${id===c.id?'active':''}" aria-pressed="${id===c.id}">${escape(c.label)}<small>${projects.filter(p=>p.category===c.id).length}</small></button>`).join('')}</div><div class="search-row"><label class="sr-only" for="project-search">Search projects by title or role</label><input id="project-search" type="search" placeholder="Find a project or role…" autocomplete="off"><span id="results-count" class="sr-only" aria-live="polite"></span></div><div id="project-list" class="projects"></div>`;
 openPanel();renderProjects();$('#project-search').addEventListener('input',e=>renderProjects(e.target.value));focusHeading();
}
function galleryMarkup(item,p,index,total){
 if(!item)return `<img src="${placeholder}" alt="No project images added yet">`;
 const src=escape(pic(item.src)),label=escape(`${p.title} — item ${index+1} of ${total}`),hosted=hostedVideo(item.src);
 if(hosted)return `<div class="hosted-video"><iframe data-film-player src="${escape(hosted.embedURL)}" title="${label} — ${hosted.provider} video" allow="fullscreen; picture-in-picture; encrypted-media" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe><a class="video-fallback" href="${escape(safeURL(item.src))}" target="_blank" rel="noopener noreferrer">Trouble playing? Open on ${hosted.provider} ↗<span class="sr-only"> (opens in a new tab)</span></a></div>`;
 return item.kind==='video'?`<video id="gallery-video" src="${src}" aria-label="${label}" controls playsinline preload="metadata"></video>`:`<img id="gallery-image" src="${src}" alt="${label}" decoding="async">`;
}
function openProject(id){
 const p=projects.find(p=>p.id===id);if(!p)return;activeProject=p;galleryIndex=0;mark(p.category);const images=photos(p),videos=videoLinks(p);
 const writeup=p.writeup.trim().split(/\n\s*\n/).filter(Boolean).map(t=>`<p class="project-writeup">${escape(t)}</p>`).join('');
 const info=p.meta.filter(m=>m.k||m.v).map(m=>`<div><dt>${escape(m.k)}</dt><dd>${escape(m.v)}</dd></div>`).join('');
 stopMedia(panelInner);panelInner.innerHTML=bar('',p.category)+`<div class="film-title"><div class="eyebrow">SET ${stage(p.category).number} / ${escape(stage(p.category).name.toUpperCase())}</div><h2 id="panel-title" tabindex="-1">${escape(p.title)}</h2><div class="project-notebook-tools"><button class="save-project" data-save-project="${escape(p.id)}" aria-pressed="${notebook.has(p,projects)}">${notebook.has(p,projects)?'✓ SAVED IN NOTEBOOK':'+ SAVE TO NOTEBOOK'}</button><button data-open-notebook>OPEN NOTEBOOK</button></div>${p.tags.trim()?`<p>${escape(p.tags.trim())}</p>`:''}${p.desc.trim()?`<p>${escape(p.desc.trim())}</p>`:''}${writeup}${info?`<dl class="project-info">${info}</dl>`:''}${videos.map((v,i)=>{const index=images.findIndex(item=>item.src===v.src),label=escape(v.caption||(videos.length>1?`WATCH FILM ${i+1}`:'WATCH THE FILM'));return index>=0?`<button class="watch-link" data-watch="${index}">${label} <span>▶</span></button>`:`<a class="watch-link" href="${escape(safeURL(v.src))}" target="_blank" rel="noopener noreferrer">${label} <span>↗</span><span class="sr-only">opens in a new tab</span></a>`;}).join('')}</div><div class="film-body"><div><div class="gallery-main" id="gallery-main">${galleryMarkup(images[0],p,0,images.length)}</div><div class="gallery-nav"><button data-photo-step="-1" aria-label="Previous gallery item" ${images.length<2?'disabled':''}>← PREV</button><span id="gallery-count">${images.length?'01':'00'} / ${String(images.length).padStart(2,'0')}</span><button data-photo-step="1" aria-label="Next gallery item" ${images.length<2?'disabled':''}>NEXT →</button></div><p id="photo-caption" class="photo-note">${escape(images[0]?.caption||'')}</p></div><aside><h3 class="side-title">IN THE FRAME</h3><div class="gallery-thumbs">${images.map((im,i)=>`<button data-photo="${i}" class="${i===0?'active':''}" aria-label="View ${im.kind!=='image'?'video':'photo'} ${i+1}" aria-pressed="${i===0}">${im.kind!=='image'?'<span class="video-thumb">▶<small>VIDEO</small></span>':`<img src="${escape(pic(im.src))}" alt="" loading="lazy" decoding="async" width="160" height="128">`}</button>`).join('')}</div><p class="photo-note">${images.length} GALLERY ITEMS<br>← → to change items<br>ESC to return to the set</p></aside></div>`;
 openPanel();history.replaceState(null,'','#project='+encodeURIComponent(id));focusHeading();
 let startX=0;$('#gallery-main').addEventListener('pointerdown',e=>{startX=e.clientX;});$('#gallery-main').addEventListener('pointerup',e=>{if(e.target.closest('video,iframe,.hosted-video'))return;if(Math.abs(e.clientX-startX)>45)changePhoto(galleryIndex+(e.clientX<startX?1:-1));});
}
function changePhoto(i){if(!activeProject||!$('#gallery-main'))return;const images=photos(activeProject);if(!images.length)return;const next=(i+images.length)%images.length;if(next===galleryIndex)return;stopMedia($('#gallery-main'));galleryIndex=next;$('#gallery-main').innerHTML=galleryMarkup(images[galleryIndex],activeProject,galleryIndex,images.length);$('#gallery-count').textContent=`${String(galleryIndex+1).padStart(2,'0')} / ${String(images.length).padStart(2,'0')}`;$('#photo-caption').textContent=images[galleryIndex].caption||'';panelInner.querySelectorAll('[data-photo]').forEach(b=>{const current=Number(b.dataset.photo)===galleryIndex;b.classList.toggle('active',current);b.setAttribute('aria-pressed',String(current));});}
function openAbout(){const c=channel('about');mark('about');stopMedia(panelInner);panelInner.innerHTML=bar('05 / THE WORKSHOP')+heading(c.role||'CARPENTRY / DESIGN / SCENIC CONSTRUCTION',c.sub||'The guy behind the builds.',c.name||displayName())+`<div class="profile"><img src="${escape(pic(c.portrait?.src)||placeholder)}" alt="${escape(c.name||displayName())}" loading="lazy"><div>${(c.paragraphs||[]).map(p=>`<p>${escape(p)}</p>`).join('')}<dl class="slate">${(c.slate||[]).map(r=>`<div><dt>${escape(r.k)}</dt><dd>${escape(r.v)}</dd></div>`).join('')}</dl><button class="watch-link" data-contact>GET IN TOUCH ↗</button></div></div>`;openPanel();focusHeading();}
function openContact(){if(!content)return;const c=channel('contact');mark('contact');stopMedia(panelInner);panelInner.innerHTML=bar('06 / PRODUCTION OFFICE')+heading(c.sub||'BOOKINGS & ENQUIRIES','Let’s build something.','From first draft to final strike.')+`<div class="contact-layout"><p>Have a set in mind? Let’s talk about making it real.</p>${(c.rows||[]).map(r=>`<div class="contact-row"><div><small>${escape(r.k)}</small>${safeURL(r.href,true)?`<a href="${escape(safeURL(r.href,true))}">${escape(r.label)}</a>`:`<span>${escape(r.label)}</span>`}</div><span aria-hidden="true">↗</span></div>`).join('')}<p>Construction coordination · Design · Scenic construction</p></div>`;openPanel();focusHeading();}
function openStage(id){dismissIntro();if(id==='about')openAbout();else if(id==='contact')openContact();else openIndex(id);}
function openBackstage(category){
 const selected=projects.filter(p=>p.category===category&&photos(p).some(im=>im.kind==='image')).slice(0,3);
 stopMedia(panelInner);panelInner.innerHTML=bar('CREW ACCESS / '+stage(category).name)+heading('THE SERVICE LANE','Behind the scenery.','One side sells the illusion. The other keeps it standing.')+`<div class="backstage-layout"><canvas id="backstage-canvas" class="backstage-drawing" width="720" height="260" role="img" aria-label="A miniature finished set beside its exposed plywood skin, timber frame, braces and sandbags."></canvas><div class="backstage-note"><p>Take a look around the back: timber framing, unfinished skins, braces and sandbags. Then open a project below to explore the real builds.</p><span>FRONT OF HOUSE<br>BACK OF HOUSE</span></div></div><div class="projects">${selected.map(projectButton).join('')||'<p class="empty">The next build is on its way.</p>'}</div>`;
 openPanel();renderer.drawBackstage($('#backstage-canvas'),category);focusHeading();
}
function openLighting(){
 stopMedia(panelInner);panelInner.innerHTML=bar('ELECTRICS / LIGHTING DESK')+heading('THREE LOOKS. SAME LOT.','Chase the light.','Pick a lighting cue. It stays with you while you explore.')+`<div class="department-body"><canvas id="lighting-preview" class="department-scene light-preview" width="640" height="480" role="img" aria-label="The studio lot under the selected lighting"></canvas><div class="lighting-cues" aria-label="Choose the lot lighting">${lightingLooks.map((look,i)=>`<button data-light="${look.id}" aria-pressed="${life.lighting===look.id}"><span class="cue-number">0${i+1}</span><i style="--cue:${look.color}" aria-hidden="true"></i><strong>${look.name}</strong></button>`).join('')}</div><p id="lighting-note" class="department-note" role="status"></p><button class="department-return" data-close>BACK TO THE LOT →</button></div>`;
 openPanel('lighting');syncLighting();focusHeading();
}
function syncLighting(){const look=lightingLooks.find(look=>look.id===life.lighting);$('#lighting-note').textContent=look.note;$('#lighting-preview').setAttribute('aria-label','The studio lot: '+look.name+'. '+look.note);panelInner.querySelectorAll('[data-light]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.light===life.lighting)));renderer.drawLighting($('#lighting-preview'),world,life);renderer.render(world,1,life);}
function openCraft(){notebook.met.add('craft');persistNotebook();
 stopMedia(panelInner);panelInner.innerHTML=bar('CRAFT SERVICES / FIVE-MINUTE BREAK')+heading('THE MOST IMPORTANT DEPARTMENT','Coffee’s on.','A little crew chatter between setups.')+`<div class="department-body"><div class="crew-conversation"><canvas id="crew-portrait" width="128" height="128" aria-hidden="true"></canvas><div class="crew-speech"><span>MARA / CRAFT SERVICES</span><p id="crew-reply" role="status">Grab a cup. There’s always time for a story while they move the lights.</p></div></div><div class="crew-choices"><button data-chat="day">How’s the day going? <span>↵</span></button><button data-chat="rumour">Heard anything around the lot? <span>↵</span></button><button data-chat="coffee">One coffee, please. <span>↵</span></button></div><button class="department-return" data-close>BACK TO WORK →</button></div>`;
 openPanel('craft');drawCrewPortrait($('#crew-portrait'),'craft');focusHeading();
}
function openBuild(){
 stopMedia(panelInner);panelInner.innerHTML=bar('THE WORKSHOP / DRAFTING TABLE')+heading('FROM FIRST PLAN TO FINAL TAKE','Build a little world.','Watch it come together, or choose a step to take a closer look.')+`<div class="department-body"><canvas id="build-preview" class="department-scene" width="720" height="340" role="img" aria-label="A miniature set being built"></canvas><div class="build-steps" aria-label="Design to shoot steps">${buildSteps.map((step,i)=>`<button data-build-step="${i}" aria-pressed="false"><span>0${i+1}</span>${step.title}</button>`).join('')}</div><p id="build-note" class="department-note" role="status"></p><div class="build-actions"><button id="build-play" class="department-return" data-build-play ${settings.reduced?'hidden':''}>PAUSE BUILD</button><button class="department-return" data-close>BACK TO THE LOT →</button></div>${settings.reduced?'<p class="department-footnote">Calmer motion is on. Use the four steps to explore the build.</p>':''}</div>`;
 openPanel('build');buildSequence=new BuildSequence(settings.reduced);buildStep=-1;syncBuild();focusHeading();
}
function syncBuild(){if(!buildSequence||!$('#build-preview'))return;const step=buildSequence.step;if(step!==buildStep){buildStep=step;$('#build-note').textContent=buildSteps[step].note;$('#build-preview').setAttribute('aria-label','Miniature set, step '+(step+1)+': '+buildSteps[step].title+'. '+buildSteps[step].note);panelInner.querySelectorAll('[data-build-step]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.buildStep)===step)));}$('#build-play').textContent=buildSequence.complete?'REPLAY BUILD':buildSequence.playing?'PAUSE BUILD':'PLAY BUILD';renderer.drawConstruction($('#build-preview'),buildSequence);if(buildSequence.complete){life.discover('build');handleLifeEvents();}}
function syncNotebookButton(){const count=$('#notebook-count');if(count)count.textContent=String(notebook.saved.length);}
function persistNotebook(){syncNotebookButton();return save('backlot-notebook-v1',notebook.serialize());}
function openNotebook(tab=notebookTab,index=null,animate=false){
 if(!content)return;
 const leaves=notebookLeaves(),previous=notebookPage;
 const requested=Number.isInteger(index)?index:(leaves[notebookPage]?.section===tab?notebookPage:leaves.findIndex(p=>p.section===tab));
 notebookPage=Math.max(0,Math.min(leaves.length-1,requested));notebookTab=leaves[notebookPage].section;
 const leaf=leaves[notebookPage],pageNumber=notebookPage,sameBook=panel.open&&panel.dataset.kind==='notebook';
 const render=()=>renderNotebookLeaf(leaf,pageNumber,leaves,sameBook);
 if(animate&&sameBook&&pageNumber!==previous)void notebookTurn.turn(()=>$('#notebook-leaf'),render,{direction:pageNumber>previous?1:-1,reduced:settings.reduced,active:()=>panel.open&&panel.dataset.kind==='notebook'});
 else{notebookTurn.cancel();render();}
}
function renderNotebookLeaf(leaf,pageNumber,leaves,focusLeaf=false){
 stopMedia(panelInner);const visited=stages.filter(s=>world.visited.has(s.id));
 const sectionName={saved:'Saved work',lot:'Lot notes',crew:'Crew'}[leaf.section];
 let body='';
 if(leaf.kind==='saved')body=notebook.saved.length?`<div class="notebook-saved">${notebook.saved.map(record=>{const p=resolveBookmark(record,projects);return `<article class="notebook-project">${p?`<button class="notebook-project-open" data-project="${escape(p.id)}"><img src="${escape(pic(thumbnailFor(p))||placeholder)}" alt="" width="160" height="110" loading="lazy"><span><small>${escape(stage(p.category).name)}</small><strong>${escape(p.title)}</strong><em>Open project ↗</em></span></button>`:`<div class="notebook-missing"><strong>${escape(record.title)}</strong><p>This project is no longer in the current index.</p></div>`}<button class="notebook-remove" data-unsave="${escape(record.key)}" aria-label="Remove ${escape(p?.title||record.title)} from notebook">Remove</button></article>`;}).join('')}</div>`:`<div class="notebook-empty"><span class="notebook-bookmark" aria-hidden="true"></span><h3>Keep the builds that catch your eye.</h3><p>Open any project and choose “Save to notebook”. Your shortlist will be waiting here.</p><button data-filter="all">BROWSE THE WORK ↗</button></div>`;
 if(leaf.kind==='lot')body=`<section class="notebook-section"><h3>Places visited <span>${visited.length} / ${stages.length}</span></h3><div class="notebook-places">${stages.map(s=>`<button data-notebook-place="${s.id}"><span class="pencil-check">${world.visited.has(s.id)?'✓':'○'}</span><span><strong>${escape(s.place)}</strong><small>${world.visited.has(s.id)?'Visited':'Still to explore'}</small></span><span>↗</span></button>`).join('')}</div></section>`;
 if(leaf.kind==='lot')body+=`<section class="notebook-section"><h3>Crew discoveries <span>${life.found.size} / ${discoveryEntries.length}</span></h3><div class="notebook-stamps">${discoveryEntries.map(([id,title,note])=>`<div class="notebook-stamp ${life.found.has(id)?'stamped':''}"><span aria-hidden="true">${life.found.has(id)?'✓':'?'}</span><strong>${life.found.has(id)?escape(title):'Undiscovered'}</strong><p>${life.found.has(id)?escape(note):'There’s more around the next corner.'}</p></div>`).join('')}</div></section>`;
 if(leaf.kind==='crew'){const people=[...crew,{id:'craft',name:'Mara',role:'Craft services'}];body=`<div class="notebook-crew">${people.map(p=>`<article><canvas data-notebook-portrait="${p.id}" width="128" height="128" aria-hidden="true"></canvas><div><small>${escape(p.role)}</small><h3>${notebook.met.has(p.id)?escape(p.name):'A face to meet'}</h3><p>${notebook.met.has(p.id)?escape({scenic:'Paint on the apron. A whole world in a sponge.',grip:'Measure twice. Carry it once. Always knows where the sandbags went.',pa:'Four walkies, a full clipboard and one more setup.',craft:'Coffee on the counter, a story for every break.'}[p.id]):'Say hello out on the lot.'}</p></div><span class="crew-met">${notebook.met.has(p.id)?'MET':'—'}</span></article>`).join('')}</div>`;}
 panelInner.innerHTML=`<div class="notebook-cover-label"><span>Pocket field notebook</span><button data-close aria-label="Close window and return to the set">×</button></div><div class="notebook-book"><div class="notebook-heading"><div><span>BENJAMIN TRAN / THE BACKLOT</span><h2 id="panel-title" tabindex="-1">Field notes.</h2><p>A few good builds. A few familiar faces.</p></div><span class="notebook-ribbon" aria-hidden="true"></span></div><div class="notebook-tabs" aria-label="Notebook sections">${[['saved','Saved work',notebook.saved.length],['lot','Lot notes',life.found.size],['crew','Crew',notebook.met.size]].map(([id,label,n])=>`<button data-notebook-tab="${id}" aria-pressed="${leaf.section===id}">${label}<span>${n}</span></button>`).join('')}</div><div class="notebook-well"><div class="notebook-page" id="notebook-leaf" tabindex="-1" aria-label="${sectionName}, page ${pageNumber+1} of ${leaves.length}"><div class="notebook-leaf-label"><span>${sectionName}</span><span>${String(pageNumber+1).padStart(2,'0')} / ${String(leaves.length).padStart(2,'0')}</span></div>${body}</div></div><div class="notebook-pager"><button data-notebook-step="-1" aria-label="Previous notebook page" ${pageNumber===0?'disabled':''}>← <span>Previous</span></button><span role="status" aria-live="polite">Page ${pageNumber+1} of ${leaves.length}</span><button data-notebook-step="1" aria-label="Next notebook page" ${pageNumber===leaves.length-1?'disabled':''}><span>Next</span> →</button></div></div><div class="notebook-foot"><span>Kept on this browser.<br>Come back anytime.</span><button data-close>Close notebook</button></div>`;
 openPanel('notebook');panelInner.querySelectorAll('[data-notebook-portrait]').forEach(canvas=>drawCrewPortrait(canvas,canvas.dataset.notebookPortrait));if(focusLeaf)requestAnimationFrame(()=>$('#notebook-leaf')?.focus({preventScroll:true}));else focusHeading();
}
function openCamera(){
 stopMedia(panelInner);const build=cameraBuilds[cameraIndex],project=projects.find(p=>p.title.toLowerCase().includes(projectTerms[cameraIndex]));
 panelInner.innerHTML=bar('CAMERA / VIDEO VILLAGE')+heading('THROUGH THE LENS',build.title,'A pixel-art interpretation of a real build. Find the shot, then explore the project.')+`<div class="department-body"><canvas id="camera-view" class="department-scene" width="720" height="400" role="img" aria-label="${escape(build.description)}"></canvas><div class="encounter-controls">${cameraBuilds.map((b,i)=>`<button data-camera="${i}" aria-pressed="${i===cameraIndex}">${escape(b.detail)}</button>`).join('')}</div><div class="encounter-controls"><button data-camera-wide aria-pressed="${cameraWide}">${cameraWide?'FRAME THE SHOT':'PULL BACK / SEE THE LIGHTS'}</button>${project?`<button data-project="${escape(project.id)}">EXPLORE THIS BUILD →</button>`:''}</div><button class="department-return" data-close>LEAVE THE VIEWFINDER →</button></div>`;
 openPanel('camera');drawViewfinder($('#camera-view'),cameraIndex,cameraWide);life.discover('camera');handleLifeEvents();focusHeading();
}
function openCrew(id){
 const person=crew.find(p=>p.id===id);if(!person)return;notebook.met.add(id);persistNotebook();
 const count=crewVisits[id]||0;crewVisits[id]=count+1;
 stopMedia(panelInner);panelInner.innerHTML=bar('ON THE CREW / '+person.role.toUpperCase())+heading(person.role,person.name,'Between setups on the backlot.')+`<div class="department-body"><div class="crew-conversation"><canvas id="person-portrait" width="128" height="128" aria-hidden="true"></canvas><div class="crew-speech"><span>${escape(person.role)}</span><p id="person-line" role="status">${escape(person.lines[count%person.lines.length])}</p></div></div><div class="encounter-controls"><button data-person="${person.id}">KEEP CHATTING</button>${id==='pa'?'<button data-call-wrap>CALL WRAP</button>':''}</div><p class="department-note">Fictional backlot crew. Project credits are listed with each build.</p><button class="department-return" data-close>SEE YOU ON SET →</button></div>`;
 openPanel('crew');drawCrewPortrait($('#person-portrait'),id);life.discover('crew');handleLifeEvents();focusHeading();
}
function openWrap(){
 stopMedia(panelInner);wrapCast=createWrapCast(life.routines.people);wrapElapsed=settings.reduced?9:0;wrapPlaying=!settings.reduced;wrapChapter=-1;
 panelInner.innerHTML=bar('END OF DAY / THE BACKLOT')+heading('ONE LAST LOOK','That’s a wrap.','The work is done. Leave the lights for tomorrow.')+`<div class="department-body"><canvas id="wrap-view" class="department-scene" width="720" height="540" role="img" aria-label="The studio winding down at the end of the day"></canvas><div class="wrap-credits" aria-live="polite"><p id="wrap-note"></p><div id="wrap-credit" hidden><small>Construction Coordinator</small><h3>${escape(displayName())}</h3><p>From the first drawing to the final strike.</p><p>Thanks for stopping by the backlot.<br>And to the shop cat: good work today.</p></div></div><div class="encounter-controls"><button data-wrap-play></button><button data-wrap-next>NEXT MOMENT</button><button data-filter="all">WORK INDEX</button></div><button class="department-return" data-close>BACK TO EXPLORING →</button></div>`;
 openPanel('wrap');syncWrap();focusHeading();
}
function syncWrap(){
 if(wrapElapsed===null||!$('#wrap-view'))return;
 const step=wrapStep(wrapElapsed);renderer.drawWrap($('#wrap-view'),wrapElapsed,wrapCast);
 if(step!==wrapChapter){wrapChapter=step;$('#wrap-note').textContent=wrapChapters[step];$('#wrap-credit').hidden=step!==3;$('#wrap-view').setAttribute('aria-label',wrapChapters[step]+': the backlot at dusk.');}
 if(wrapElapsed>=12){wrapPlaying=false;life.discover('wrap');handleLifeEvents();}
 $('#wrap-play')?.removeAttribute('disabled');
 $('[data-wrap-play]').textContent=wrapElapsed>=12?'REPLAY':wrapPlaying?'PAUSE':'PLAY';
 $('[data-wrap-next]').disabled=wrapElapsed>=12;
}
function activateEgg(id){
 const item=life.hotspot(id);if(!item||life.take)return;
 if(distance(world.player,item.point)>item.radius){world.goTo(item.point,'egg:'+id);return;}
 life.interact(id,world);handleLifeEvents();updateLocation();
}
function handleLifeEvents(){for(const event of life.drain()){
 if(event.type==='discovery'){save('backlot-crew-v1',JSON.stringify([...life.found]));$('#crew-seal').hidden=!life.found.has('cat');}
 else if(event.type==='backstage')openBackstage(event.category);
 else if(event.type==='lighting')openLighting();
 else if(event.type==='craft')openCraft();
 else if(event.type==='build')openBuild();
 else if(event.type==='camera')openCamera();
 else if(event.type==='wrap')openWrap();
 else if(crew.some(p=>p.id===event.type))openCrew(event.type);
 else if(event.type==='lighting-change')save('backlot-light-v1',event.id);
 else if(event.type==='cat-follow')toast('Follow the cat. It’ll wait for you.');
 else if(event.type==='cat-arrived')toast('The crew truck. A little peace behind the lift gate.');
 else if(event.type==='cat-approved'){toast('CREW APPROVED ♥ You’ve earned the cat’s trust.');ambience.cue('reward');}
 else if(event.type==='cat-purr')toast('Prrrr. Always happy to see the crew.');
 else if(event.type==='screw-found')showTreasure();
 else if(event.type==='take-start'){resetInput();takePhase='';$('#lot').classList.add('rolling');$('#take-hud').hidden=false;$('#take-number').textContent='TAKE '+String(life.take.number).padStart(2,'0');$('#cut-button').focus({preventScroll:true});ambience.pause(true);}
 else if(event.type==='take-end'){$('#lot').classList.remove('rolling');$('#take-hud').hidden=true;resetInput();ambience.pause(panel.open||document.hidden);if(welcomed&&!panel.open)$('#world').focus({preventScroll:true});if(!event.skipped)toast('That’s a wrap. Back to one.');}
}}
function openMap(){stopMedia(panelInner);panelInner.innerHTML=bar('LOCATION GUIDE / STUDIO LOT')+heading('YOU HAVE THE RUN OF THE PLACE','Pick your next stop.','Choose a location and I’ll walk you there.')+`<div class="map-layout"><canvas id="big-map" class="big-map" width="640" height="480" aria-label="The studio lot, with six numbered destinations"></canvas><div class="map-list">${stages.map(s=>`<button data-walk="${s.id}"><span class="map-number">${s.number}</span><span><strong>${escape(s.name)}</strong><small>${escape(s.place)}${world.visited.has(s.id)?' · VISITED':''}</small></span><span>→</span></button>`).join('')}<div class="map-foot">You can also tap a set directly in the world.<br>All projects are always available in Work index.</div></div></div>`;openPanel();renderer.drawMap($('#big-map'),world);focusHeading();}
function openSettings(){stopMedia(panelInner);panelInner.innerHTML=bar('STUDIO CONTROLS')+heading('MAKE YOURSELF AT HOME','Set the atmosphere.','Display, sound and controls.')+`<div class="settings-list">${[['rain','Light rain','Rain on the backlot.'],['reduced','Calmer motion','Stops decorative weather and crew animation; removes camera easing, notebook page turns and title-screen motion.'],['sound','Studio ambience','Rain, electrical hum and a few tiny game sounds. Always off until you turn it on.']].map(([key,title,desc])=>`<div class="setting"><div><strong>${title}</strong><small>${desc}</small></div><button class="toggle" data-setting="${key}" aria-pressed="${settings[key]}">${settings[key]?'ON':'OFF'}</button></div>`).join('')}${life.found.has('cat')?'<p class="crew-note">CREW PASS / APPROVED ♥<br>The shop cat has vouched for you. Find it strolling by the workshop between visits to the crew truck.</p>':''}<p class="crew-discoveries">${life.found.size} / ${discoveryEntries.length} CREW DISCOVERIES</p><div class="help-copy"><strong>TAKE A WALK</strong><br>Desktop: <kbd>WASD</kbd> or arrow keys to move. <kbd>E</kbd> or <kbd>Enter</kbd> to look. <kbd>M</kbd> for the map. <kbd>N</kbd> for your notebook. Click a set, prop or cat to walk to it.<br><br>Phone: drag the left stick, or tap the ground. Tap <kbd>A</kbd> near a stage, prop or cat to interact. Tap a set to walk there and open it automatically.<br><br>Inside a project: use the thumbnails, arrows or swipe the photo. <kbd>Esc</kbd> closes the window. During a take, <kbd>Esc</kbd> or CUT returns to exploring.<br><br>There’s more to a set than the camera sees. Try the rear service lane.</div><button class="title-return" data-title>← RETURN TO TITLE SCREEN</button></div>`;openPanel();focusHeading();}
panelInner.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
 if(b.hasAttribute('data-close'))closePanel();
 else if(b.hasAttribute('data-open-notebook'))openNotebook();
 else if(b.dataset.notebookTab)openNotebook(b.dataset.notebookTab,null,true);
 else if(b.dataset.notebookStep)openNotebook(notebookTab,notebookPage+Number(b.dataset.notebookStep),true);
 else if(b.dataset.notebookPlace)openStage(b.dataset.notebookPlace);
 else if(b.dataset.unsave){notebook.remove(b.dataset.unsave);persistNotebook();openNotebook('saved');}
 else if(b.dataset.saveProject){const p=projects.find(p=>p.id===b.dataset.saveProject);if(!p)return;const saved=notebook.toggle(p,projects),persisted=persistNotebook();b.setAttribute('aria-pressed',String(saved));b.textContent=saved?'✓ SAVED IN NOTEBOOK':'+ SAVE TO NOTEBOOK';toast(saved?(persisted?'Saved to your field notebook.':'Saved for this visit. Browser storage is unavailable.'):'Removed from your field notebook.');}
 else if(b.hasAttribute('data-camera')){cameraIndex=Number(b.dataset.camera);openCamera();}
 else if(b.hasAttribute('data-camera-wide')){cameraWide=!cameraWide;openCamera();}
 else if(b.dataset.person){const person=crew.find(p=>p.id===b.dataset.person);const count=crewVisits[person.id]||0;crewVisits[person.id]=count+1;$('#person-line').textContent=person.lines[count%person.lines.length];}
 else if(b.hasAttribute('data-call-wrap'))openWrap();
 else if(b.hasAttribute('data-wrap-play')){if(wrapElapsed>=12)wrapElapsed=0;wrapPlaying=!wrapPlaying;syncWrap();}
 else if(b.hasAttribute('data-wrap-next')){wrapPlaying=false;wrapElapsed=Math.min(12,(wrapStep(wrapElapsed)+1)*3);syncWrap();}
 else if(b.dataset.filter)openIndex(b.dataset.filter);
 else if(b.dataset.project)openProject(b.dataset.project);
 else if(b.dataset.back)openIndex(b.dataset.back);
 else if(b.hasAttribute('data-watch')){changePhoto(Number(b.dataset.watch));$('#gallery-main').scrollIntoView({block:'nearest',behavior:settings.reduced?'instant':'smooth'});}
 else if(b.hasAttribute('data-photo'))changePhoto(Number(b.dataset.photo));
 else if(b.dataset.photoStep)changePhoto(galleryIndex+Number(b.dataset.photoStep));
 else if(b.hasAttribute('data-contact'))openContact();
 else if(b.dataset.light){life.selectLight(b.dataset.light);handleLifeEvents();syncLighting();}
 else if(b.dataset.chat){$('#crew-reply').textContent=life.chat(b.dataset.chat);handleLifeEvents();if(b.dataset.chat==='coffee')ambience.cue('reward');}
 else if(b.hasAttribute('data-build-step')&&buildSequence){buildSequence.show(Number(b.dataset.buildStep));syncBuild();}
 else if(b.hasAttribute('data-build-play')&&buildSequence){if(buildSequence.complete)buildSequence.replay();else buildSequence.playing=!buildSequence.playing;syncBuild();}
 else if(b.hasAttribute('data-title'))showTitle();
 else if(b.dataset.walk){const id=b.dataset.walk;closePanel();if(life.take){life.finishTake(true);handleLifeEvents();}dismissIntro();world.goToStage(id);toast(`Walking to ${stage(id).place.toLowerCase()}…`);}
 else if(b.dataset.setting){const k=b.dataset.setting;settings[k]=!settings[k];b.setAttribute('aria-pressed',String(settings[k]));b.textContent=settings[k]?'ON':'OFF';if(k==='sound')ambience.toggle(settings.sound);applySettings();}
});
let notebookSwipe=null;
panelInner.addEventListener('pointerdown',e=>{notebookSwipe=e.pointerType==='touch'&&e.target.closest('#notebook-leaf')&&!e.target.closest('button,a,input')?{x:e.clientX,y:e.clientY,id:e.pointerId}:null;});
panelInner.addEventListener('pointercancel',()=>notebookSwipe=null);
panelInner.addEventListener('pointerup',e=>{const start=notebookSwipe;notebookSwipe=null;if(!start||start.id!==e.pointerId||panel.dataset.kind!=='notebook')return;const dx=e.clientX-start.x,dy=e.clientY-start.y;if(Math.abs(dx)>60&&Math.abs(dy)<40)openNotebook(notebookTab,notebookPage+(dx<0?1:-1),true);});
const ambience={ctx:null,master:null,
 async toggle(on){try{if(on&&!this.ctx){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw new Error('Audio unavailable');this.ctx=new Audio();this.master=this.ctx.createGain();this.master.gain.value=0;this.master.connect(this.ctx.destination);const buffer=this.ctx.createBuffer(1,this.ctx.sampleRate*3,this.ctx.sampleRate),data=buffer.getChannelData(0);let prev=0;for(let i=0;i<data.length;i++){prev=(prev+(Math.random()*2-1)*.04)/1.02;data[i]=prev*3;}const noise=this.ctx.createBufferSource();noise.buffer=buffer;noise.loop=true;const filter=this.ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=900;noise.connect(filter);filter.connect(this.master);noise.start();const osc=this.ctx.createOscillator(),gain=this.ctx.createGain();osc.frequency.value=60;gain.gain.value=.035;osc.connect(gain);gain.connect(this.master);osc.start();}if(on&&this.ctx.state==='suspended')await this.ctx.resume();this.pause((welcomed&&panel.open)||document.hidden||!!life.take);}catch{settings.sound=false;const b=$('[data-setting="sound"]');if(b){b.textContent='OFF';b.setAttribute('aria-pressed','false');}toast('Sound is unavailable in this browser.');}},
 pause(paused){if(!this.ctx||!this.master)return;const enabled=settings.sound&&!paused;this.master.gain.setTargetAtTime(enabled?.13:0,this.ctx.currentTime,.3);},
 cue(kind){if(!settings.sound||!this.ctx||this.ctx.state!=='running')return;const notes=kind==='clap'?[140,60]:kind==='reward'?[523.25,659.25,783.99]:[261.63,392,523.25];notes.forEach((frequency,i)=>{const osc=this.ctx.createOscillator(),gain=this.ctx.createGain(),at=this.ctx.currentTime+i*.1;osc.type=kind==='clap'?'triangle':'square';osc.frequency.value=frequency;gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.025,at+.008);gain.gain.exponentialRampToValueAtTime(.001,at+.14);osc.connect(gain);gain.connect(this.ctx.destination);osc.start(at);osc.stop(at+.15);osc.onended=()=>{osc.disconnect();gain.disconnect();};});}
};
function applySettings(){renderer.rain=settings.rain;renderer.reduced=settings.reduced;life.reduced=settings.reduced;titleScene.reduced=settings.reduced;document.body.classList.toggle('calm',settings.reduced);save('backlot-display-v1',JSON.stringify({rain:settings.rain,reduced:settings.reduced}));$('#weather-button').setAttribute('aria-pressed',String(settings.rain));$('#weather-button').textContent=settings.rain?'☂ LIGHT RAIN':'☀ CLEAR SKIES';$('#title-sound').setAttribute('aria-pressed',String(settings.sound));$('#title-sound').textContent=settings.sound?'SOUND ON':'SOUND OFF';}
function updateFeature(){const choices=featuredProjects(projects,categories);$('#monitor').hidden=!choices.length;if(!choices.length)return;feature=(feature+choices.length)%choices.length;const p=choices[feature],gallery=photos(p).filter(im=>im.kind==='image'),img=gallery[1]||gallery[0];$('#feature-image').src=pic(img?.src)||placeholder;$('#feature-image').alt=`${p.title} — construction portfolio image`;$('#feature-title').textContent=p.title;$('#feature-category').textContent=`${stage(p.category).number} / ${stage(p.category).name}`;$('#feature-open').dataset.project=p.id;$('#feature-open').setAttribute('aria-label','View '+p.title);$('#feature-title').title=p.title;}
$('#feature-toggle').onclick=()=>{const compact=$('#monitor').classList.toggle('monitor-compact');const button=$('#feature-toggle');button.setAttribute('aria-expanded',String(!compact));button.setAttribute('aria-label',compact?'Expand featured project preview':'Collapse featured project preview');button.textContent=compact?'+':'−';};
$('#feature-prev').onclick=()=>{feature--;updateFeature();};$('#feature-next').onclick=()=>{feature++;updateFeature();};$('#feature-open').onclick=()=>openProject($('#feature-open').dataset.project);
$('#index-button').onclick=()=>openIndex();$('#map-button').onclick=$('#minimap-button').onclick=openMap;$('#contact-button').onclick=openContact;$('#settings-button').onclick=openSettings;
$('#weather-button').onclick=()=>{settings.rain=!settings.rain;applySettings();};
$('#notebook-button').onclick=()=>openNotebook();
$('#home-button').onclick=e=>{e.preventDefault();closePanel();if(life.take){life.finishTake(true);handleLifeEvents();}resetInput();world.path=[];world.destination=null;world.arrived=null;world.player.x=472;world.player.y=332;$('#world').focus({preventScroll:true});};
$('#start-button').onclick=enterBacklot;
$('#title-work').onclick=()=>{dismissIntro();openIndex();};
$('#title-sound').onclick=async()=>{settings.sound=!settings.sound;await ambience.toggle(settings.sound);applySettings();};
$('#cut-button').onclick=()=>{life.finishTake(true);handleLifeEvents();};
function interact(){if(panel.open||!content||!welcomed||life.take)return;const egg=life.nearby(world.player);if(egg){activateEgg(egg.id);return;}const s=world.nearby();if(s)openStage(s.id);else toast('Walk up to a set, a prop, or someone on the crew.');}
$('#interact-button').onclick=$('#touch-action').onclick=interact;
const canvas=$('#world');let scenePointer=null;
canvas.addEventListener('pointerdown',e=>{scenePointer={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.focus({preventScroll:true});});
canvas.addEventListener('pointerup',e=>{if(!scenePointer||e.pointerId!==scenePointer.id||Math.hypot(e.clientX-scenePointer.x,e.clientY-scenePointer.y)>12)return;scenePointer=null;if(!content||!welcomed||life.take)return;const bounds=canvas.getBoundingClientRect(),p=renderer.screenToWorld(e.clientX-bounds.left,e.clientY-bounds.top),egg=life.hit(p);if(egg){activateEgg(egg.id);return;}const hit=stages.find(s=>p.x>s.x-10&&p.x<s.x+s.w+10&&p.y>s.y-25&&p.y<s.door.y+15);if(hit){world.goToStage(hit.id);if(world.nearby()?.id===hit.id)openStage(hit.id);}else world.goTo(p);});
canvas.addEventListener('pointercancel',()=>{scenePointer=null;});
window.addEventListener('keydown',e=>{if(entering){e.preventDefault();return;}if(panel.open){if(panel.dataset.kind==='notebook'&&!/INPUT|TEXTAREA/.test(e.target.tagName)&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();openNotebook(notebookTab,notebookPage+(e.key==='ArrowRight'?1:-1),true);return;}if($('#gallery-main')&&!/INPUT|TEXTAREA|VIDEO/.test(e.target.tagName)){if(e.key==='ArrowRight'){e.preventDefault();changePhoto(galleryIndex+1);}if(e.key==='ArrowLeft'){e.preventDefault();changePhoto(galleryIndex-1);}}return;}
 if(!welcomed){if(content&&e.key==='Enter'&&!e.repeat&&!e.target.closest('button,a')){e.preventDefault();$('#start-button').click();}return;}
 if(life.take){if(e.key==='Escape'){e.preventDefault();life.finishTake(true);handleLifeEvents();}return;}
 if(/INPUT|TEXTAREA/.test(e.target.tagName))return;const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d'].includes(k)){e.preventDefault();keys.add(k);dismissIntro();}if(e.repeat)return;if(k==='e'||(k==='enter'&&e.target===canvas)){e.preventDefault();interact();}if(k==='m'){e.preventDefault();openMap();}if(k==='n'){e.preventDefault();openNotebook();}if(k==='escape'){resetInput();world.path=[];world.destination=null;}
});window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
const joy=$('#joystick');let joyId=null;
function updateStick(e){const r=joy.getBoundingClientRect(),dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2),len=Math.hypot(dx,dy),cap=28,k=Math.min(1,cap/(len||1));stick.x=len<7?0:dx*k/cap;stick.y=len<7?0:dy*k/cap;$('#stick-knob').style.transform=`translate(${dx*k}px,${dy*k}px)`;}
joy.addEventListener('pointerdown',e=>{if(!welcomed||life.take)return;e.preventDefault();joyId=e.pointerId;joy.setPointerCapture(e.pointerId);updateStick(e);});joy.addEventListener('pointermove',e=>{if(e.pointerId===joyId)updateStick(e);});
function releaseJoy(){joyId=null;stick.x=stick.y=0;$('#stick-knob').style.transform='';}for(const type of ['pointerup','pointercancel','lostpointercapture'])joy.addEventListener(type,releaseJoy);
window.addEventListener('blur',()=>{resetInput();releaseJoy();world.paused=true;world.path=[];world.destination=null;ambience.pause(true);});window.addEventListener('focus',()=>{world.paused=!welcomed||panel.open||document.hidden;ambience.pause(world.paused||!!life.take);});document.addEventListener('visibilitychange',()=>{resetInput();releaseJoy();world.paused=!welcomed||document.hidden||panel.open;ambience.pause(world.paused||!!life.take);});
function resize(){const r=$('#lot').getBoundingClientRect();if(r.width&&r.height)renderer.resize(r.width,r.height);resetInput();releaseJoy();renderer.render(world,1,life);renderer.drawMap($('#minimap'),world);if(!welcomed&&!entering){const title=$('#title-screen').getBoundingClientRect();titleScene.resize(title.width,title.height);titleScene.render(titleClock*1000);fitTitle();}}const resizer=new ResizeObserver(resize);resizer.observe($('#lot'));resizer.observe($('#title-screen'));
function updateLocation(){const s=world.nearby(),egg=life.nearby(world.player),id=egg?'egg:'+egg.id+':'+egg.caption:s?.id||'';if(id!==nearbyId){nearbyId=id;$('#interaction').hidden=!id||!!life.take;$('#place-number').textContent=egg?(egg.id==='screw'?'PROP':'CREW'):s?s.number:'EXT.';$('#place-name').textContent=egg?egg.caption:s?s.place.toUpperCase():'THE BACKLOT';if(id){$('#interaction-caption').textContent=egg?egg.caption:s.place.toUpperCase();$('#interact-label').textContent=egg?egg.label:s.id==='about'?'Meet Ben':s.id==='contact'?'Get in touch':'View '+s.name;}}}
function frame(now){const dt=Math.min((now-last)/1000||.016,.05);last=now;if(wrapPlaying&&panel.open&&panel.dataset.kind==='wrap'&&!document.hidden&&document.hasFocus()){wrapElapsed=Math.min(12,wrapElapsed+dt);syncWrap();}if(buildSequence?.playing&&panel.open&&!document.hidden&&document.hasFocus()){buildSequence.update(dt);syncBuild();}if(!welcomed&&!document.hidden&&!$('#title-screen').hidden){titleClock+=dt;titleScene.render(titleClock*1000);}if(!world.paused){const x=stick.x+(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),y=stick.y+(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);world.update(dt,life.take?{x:0,y:0}:{x,y});life.update(dt,world);handleLifeEvents();if(world.arrived){const id=world.arrived;world.arrived=null;if(id.startsWith('egg:'))activateEgg(id.slice(4));else openStage(id);}if(life.take&&takePhase!==life.phase){takePhase=life.phase;$('#take-call').textContent={quiet:'QUIET ON SET',action:'ACTION!',cut:'CUT. THAT’S A WRAP.'}[takePhase];if(takePhase==='action')ambience.cue('clap');}updateLocation();renderer.render(world,dt,life);mapClock+=dt;if(mapClock>.15){mapClock=0;renderer.drawMap($('#minimap'),world);}}requestAnimationFrame(frame);}
applySettings();resize();document.fonts.ready.then(fitTitle);requestAnimationFrame(frame);
try{
 const response=await fetch('content.json',{cache:'no-store'});if(!response.ok)throw new Error('Portfolio content could not be loaded');contentLoaded(await response.json());updateFeature();markCount();$('#loading').hidden=true;$('#title-screen').classList.remove('is-loading');
 $('#start-button').disabled=false;$('#title-work').disabled=false;
 const hash=new URLSearchParams(location.hash.slice(1)),id=hash.get('project');if(id&&projects.some(p=>p.id===id)){dismissIntro();openProject(id);}
 // Do not autofocus on load: touch visitors should not start with a focus ring.
 // Enter still starts the lot from the page, and Tab exposes visible keyboard focus.
}catch(error){$('#loading').innerHTML='<div>THE STUDIO IS TAKING A MOMENT.<br><br><button id="retry-load">Try again ↻</button><br><br><a href="mailto:contact@benjamintran.ca">Contact Ben ↗</a></div>';$('#retry-load').onclick=()=>location.reload();console.error(error);}
function markCount(){const count=stages.slice(0,4).filter(s=>world.visited.has(s.id)).length;$('#visited-count').textContent=`${count} OF 4 SETS VISITED`;}

document.addEventListener('error',e=>{if(e.target.tagName==='IMG'&&!e.target.dataset.fallback){e.target.dataset.fallback='true';e.target.src=placeholder;}},true);

