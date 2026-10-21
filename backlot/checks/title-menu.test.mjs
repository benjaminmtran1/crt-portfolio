// Source and Canvas regressions. Actual browser/touch QA is a separate check.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { TitleScene } from '../title-scene.mjs';
const html=fs.readFileSync(new URL('../../index.html',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../title.css',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../app.mjs',import.meta.url),'utf8');
assert.equal((html.match(/id="start-button"/g)||[]).length,1,'Exactly one real entry button');
assert.equal((html.match(/ENTER BACKLOT/g)||[]).length,1,'No duplicate entry text');
assert.doesNotMatch(html,/class="(?:cartridge-frame|title-rule|title-shade)"/,'No retired decorative frame in the live title');
assert.match(css,/\.title-screen button:focus-visible\{outline:3px solid #35d6c5;outline-offset:7px\}/,'Keyboard-only focus stays visible');
assert.doesNotMatch(css,/button:focus\s*\{/,'Do not show the keyboard outline on all pointer focus');
assert.doesNotMatch(app,/else if\(document\.activeElement===document\.body\).*start-button.*focus/,'Initial loading no longer forces keyboard focus');
assert.match(app,/function showTitle\(\).*start-button.*focus/,'Returning to the title still restores appropriate focus');
for(const match of css.matchAll(/\.title-screen \.title-work\{([^}]*)\}/g)){
 const size=match[1].match(/font-size:(\d+)px/);
 if(size)assert.ok(Number(size[1])>=12,'Direct-work label stays readable at every breakpoint');
 const height=match[1].match(/min-height:(\d+)px/);
 if(height)assert.ok(Number(height[1])>=44,'Work shortcut keeps a 44px touch target');
}
for(const match of css.matchAll(/\.title-work span\{([^}]*)\}/g)){
 const size=match[1].match(/font-size:(\d+)px/);
 if(size)assert.ok(Number(size[1])>=8,'Pixel-font Work Index stays readable at every breakpoint');
}
function canvas(w,h){
 const c={paints:[],fillStyle:'',globalAlpha:1,imageSmoothingEnabled:true};
 c.fillRect=(...args)=>c.paints.push({color:c.fillStyle,args});
 for(const method of ['beginPath','moveTo','lineTo','closePath','fill','drawImage','clearRect'])c[method]=()=>{};
 return{width:w,height:h,clientWidth:w,clientHeight:h,style:{},ownerDocument:{createElement:()=>canvas(1,1)},getContext:()=>c};
}
for(const [w,h] of [[1440,900],[1188,761],[390,844],[360,667],[844,390],[320,568]]){
 const scene=new TitleScene(canvas(w,h));
 assert.ok(!scene.back.getContext('2d').paints.some(p=>p.color==='#FFD39A'),'No cream spike mark remains behind the title CTA');
}
assert.match(html,/title\.css\?v=titlemenu2/);assert.match(html,/app\.mjs\?v=titlemenu2/);assert.match(app,/title-scene\.mjs\?v=titlemenu2/);
console.log('Title menu passed: one entry label, no legacy frame, keyboard focus preserved without startup autofocus, larger work shortcut at every breakpoint, 44px touch target, removed Canvas spike at six viewport sizes, and cache refresh chain. Browser layout remains a separate check.');
