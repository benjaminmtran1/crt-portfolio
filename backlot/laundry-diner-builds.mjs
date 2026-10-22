/** Two photographed scenic builds, rasterised on the native 360 × 180 plate.
 * Gain Flings × Wicked: ../assets/img_3583.jpg and img_3586.jpg.
 * IHOP Go All Out: ../assets/img_7360.dng.jpg and img_7349.dng.jpg.
 * No photo textures, external assets, labels, animation, or cast shadows.
 */
const R=(c,x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
function P(c,points,color){
 const p=points.map(([x,y])=>[Math.round(x),Math.round(y)]);
 for(let y=Math.min(...p.map(a=>a[1]));y<Math.max(...p.map(a=>a[1]));y++){
  const xs=[];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];if((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y))xs.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));}
  xs.sort((a,b)=>a-b);for(let i=0;i+1<xs.length;i+=2){const l=Math.ceil(xs[i]),r=Math.floor(xs[i+1]);if(r>=l)R(c,l,y,r-l+1,1,color);}
 }
}
function L(c,x,y,xx,yy,color,w=1){
 x=Math.round(x);y=Math.round(y);xx=Math.round(xx);yy=Math.round(yy);
 const dx=Math.abs(xx-x),sx=x<xx?1:-1,dy=-Math.abs(yy-y),sy=y<yy?1:-1;let e=dx+dy;
 for(;;){R(c,x,y,w,w,color);if(x===xx&&y===yy)break;const e2=e*2;if(e2>=dy){e+=dy;x+=sx;}if(e2<=dx){e+=dx;y+=sy;}}
}
function E(c,x,y,rx,ry,color){for(let j=-ry;j<=ry;j++){const h=Math.floor(rx*Math.sqrt(1-j*j/(ry*ry)));R(c,x-h,y+j,h*2+1,1,color);}}
const lerp=(a,b,t)=>a+(b-a)*t;
const right=(u,z)=>[147+u,114+u*28/182-z];
const left=(u,z)=>[31+u,140-u*26/116-z];
function face(c,at,points,color){P(c,points.map(([u,z])=>at(u,z)),color);}
function line(c,at,u,z,v,h,color,w=1){L(c,...at(u,z),...at(v,h),color,w);}
function panel(c,at,u,z,w,h,color){face(c,at,[[u,z],[u+w,z],[u+w,z+h],[u,z+h]],color);}
function arch(c,at,u,z,w,h,color){
 const radius=w/2, rise=Math.min(h*.55,radius*1.08),spring=z+h-rise;
 const points=[[u,z],[u+w,z],[u+w,spring]];
 for(let i=0;i<=24;i++){const a=i*Math.PI/24;points.push([u+radius+Math.cos(a)*radius,spring+Math.sin(a)*rise]);}
 points.push([u,z]);face(c,at,points,color);
}
function cabinet(c,at,u,z,w,h){
 panel(c,at,u,z,w,h,'#C5BCA1');panel(c,at,u+2,z+2,w-4,h-4,'#E2D9BC');
 panel(c,at,u+4,z+4,w-8,h-8,'#C5B99D');panel(c,at,u+5,z+5,w-10,h-10,'#DDD2B5');
 line(c,at,u+3,z+h-2,u+w-3,z+h-2,'#F0E6CC');line(c,at,u+w-3,z+3,u+w-3,z+h-3,'#AAA18A');
 line(c,at,u+w-6,z+h*.48,u+w-6,z+h*.72,'#756F5C');line(c,at,u+w-5,z+h*.48,u+w-5,z+h*.72,'#B8B39C');
}
function basket(c,at,u,z,w,h){
 face(c,at,[[u+2,z],[u+w-2,z],[u+w,z+h],[u,z+h]],'#8E9775');
 for(let a=u+3;a<u+w-1;a+=3)line(c,at,a,z+1,a,z+h-1,'#C5C5A3');
 for(let h1=2;h1<h;h1+=3)line(c,at,u+2,z+h1,u+w-2,z+h1,'#646E57');
 line(c,at,u,z+h,u+w,z+h,'#DFD9B7',2);
}
function towels(c,at,u,z,w){for(const [dy,col] of [[0,'#9FAF95'],[3,'#E6DFC5'],[6,'#C5B6BE']]){panel(c,at,u,z+dy,w-(dy===6?3:0),3,col);line(c,at,u+1,z+dy+2,u+w-2-(dy===6?3:0),z+dy+2,'#F0E8D2');}}

export function paintWicked(c){
 // A small open-top room: two real scenic walls and one shared timber floor.
 P(c,[[31,140],[147,114],[329,142],[213,168]],'#9C7954');
 P(c,[[31,140],[213,168],[329,142],[329,148],[213,174],[31,146]],'#584A37');
 for(let t=0;t<=1;t+=.09)L(c,lerp(31,147,t),lerp(140,114,t),lerp(213,329,t),lerp(168,142,t),t%.18<.09?'#B58E60':'#795E43');
 for(let i=1;i<8;i++){const t=i/8;L(c,lerp(31,213,t),lerp(140,168,t),lerp(147,329,t),lerp(114,142,t),'#8A694A');}
 // Pale wall returns keep the open room recognisable as a physical stage flat.
 face(c,left,[[0,0],[116,0],[116,106],[0,106]],'#D8D0B3');
 face(c,right,[[0,0],[182,0],[182,106],[0,106]],'#DED2B2');
 line(c,left,0,106,116,106,'#F0E8CD',2);line(c,right,0,106,182,106,'#F0E6C8',2);
 line(c,left,0,0,0,106,'#9D947B',3);line(c,right,182,0,182,106,'#9C947E',3);
 line(c,left,116,0,116,104,'#B2A88D');line(c,left,0,2,116,2,'#F0E5CB',3);line(c,right,0,2,182,2,'#B4A88A',3);
 // Large sage arched window, with genuinely curved top and deep trim.
 arch(c,right,38,38,101,64,'#626F50');arch(c,right,42,41,93,57,'#9AA984');
 arch(c,right,45,43,87,53,'#B5CFD0');
 // The photographed window has pale blue daylight, foliage low in the panes.
 for(const [u,z,w,h,col] of [[48,45,16,8,'#9EAF8C'],[66,44,15,5,'#7C9472'],[83,44,14,9,'#A7B997'],[104,44,11,6,'#869B77'],[117,44,11,12,'#B6B99A']])panel(c,right,u,z,w,h,col);
 for(const [u,z] of [[49,51],[69,47],[89,50],[106,47],[120,51]]){line(c,right,u,z,u+3,z+7,'#7E9175');line(c,right,u+3,z+4,u+7,z+6,'#9AA485');}
 for(const u of [63,86,109]){const dx=(u-88.5)/43.5,top=70+26*Math.sqrt(1-dx*dx);line(c,right,u,43,u,top,'#667A55',3);line(c,right,u-1,45,u-1,top-1,'#D0D1AA');}
 line(c,right,46,62,131,62,'#657650',3);line(c,right,48,79,129,79,'#66784F',2);
 line(c,right,42,40,136,40,'#84916A',3);line(c,right,42,41,136,41,'#B9BC91');
 // Smaller arched glazed garden door on the return wall, not a second window.
 arch(c,left,63,2,37,76,'#657657');arch(c,left,66,4,31,71,'#9AA586');arch(c,left,68,6,27,67,'#52644A');
 arch(c,left,69,26,25,46,'#B2C7BC');
 for(const [u,z,w,h,col] of [[70,26,7,12,'#687F65'],[83,26,10,9,'#879E7B'],[75,29,5,15,'#8CA47F']])panel(c,left,u,z,w,h,col);
 line(c,left,80,27,80,70,'#53674C',2);line(c,left,69,46,94,46,'#53674C',2);line(c,left,69,27,94,27,'#93A27B',2);
 panel(c,left,69,8,24,15,'#748360');line(c,left,70,22,92,22,'#A5AF86');line(c,left,92,22,92,8,'#475A42');line(c,left,92,29,92,33,'#D6C9A0',2);
 // A cream wall cabinet and green shelf, as in the back corner photograph.
 cabinet(c,right,5,56,25,28);line(c,right,3,55,32,55,'#778363',3);line(c,right,2,85,30,85,'#9D9D7A',2);
 basket(c,right,10,86,15,8);line(c,left,101,59,114,59,'#7B8666',3);towels(c,left,103,61,10);
 line(c,left,18,76,54,76,'#758366',4);line(c,left,18,77,54,77,'#ACAE88');
 basket(c,left,20,79,15,10);towels(c,left,39,79,12);
 // L-shaped cream lower cabinetry. The end panel exposes its build depth.
 cabinet(c,left,101,4,14,31);
 P(c,[[149,115],[319,141],[319,109],[149,83]],'#A79E82');
 for(const [u,w] of [[3,29],[35,27],[102,28],[133,27],[163,17]]){
  cabinet(c,right,u,4,w,24);panel(c,right,u,29,w,7,'#D9CEAF');panel(c,right,u+3,31,w-6,3,'#C2B597');line(c,right,u+w*.35,32,u+w*.6,32,'#77725C');
 }
 // Front-loading washer under the arched window, round dark porthole and dial.
 panel(c,right,65,3,34,33,'#D9D7C0');panel(c,right,67,4,30,31,'#EEE8CF');
 panel(c,right,68,29,28,5,'#C7C8B2');panel(c,right,69,30,9,2,'#798478');
 const [wx,wy]=right(82,17);E(c,wx,wy,11,12,'#929C8E');E(c,wx,wy,8,10,'#4F615B');E(c,wx,wy,6,8,'#253E41');
 L(c,wx-3,wy-6,wx+2,wy-7,'#849F95',2);L(c,wx+5,wy-3,wx+5,wy+4,'#A1B0A0');
 const dial=right(91,32);E(c,...dial,2,2,'#6E7C70');
 // Continuous pale worktop covers the cabinet run and meets the rear sink.
 face(c,right,[[0,36],[181,36],[181,40],[0,40]],'#F1E7CC');line(c,right,1,36,181,36,'#B8B195');
 face(c,left,[[100,35],[116,35],[116,39],[100,39]],'#E9E1C5');
 // Sink/faucet and characteristic woven baskets, towels, bright detergent tub.
 panel(c,right,7,40,20,2,'#758375');line(c,right,16,41,16,50,'#A3A997',2);line(c,right,16,50,19,52,'#BDC0A8');line(c,right,19,52,22,50,'#BDC0A8');line(c,right,22,50,22,47,'#838F7C');
 towels(c,right,34,41,18);basket(c,right,113,41,24,11);towels(c,right,113,53,17);
 const [tx,ty]=right(93,48);R(c,tx-4,ty,9,10,'#79A344');R(c,tx-3,ty+1,7,7,'#A0C25A');R(c,tx-2,ty+3,5,3,'#E0D87A');R(c,tx-3,ty-2,7,2,'#BED276');
 // Two simple floating shelves at the right-hand end of the photographed wall.
 for(const z of [61,85]){line(c,right,145,z,178,z,'#667458',4);line(c,right,145,z+1,178,z+1,'#99A17D');}
 basket(c,right,150,88,22,11);panel(c,right,150,65,9,10,'#9FAE91');panel(c,right,163,65,12,8,'#A9B79A');
 for(const u of [151,154,165,169])panel(c,right,u,74,2,3,'#B59AB3');
 // Low timber bench, coat rail and a small striped mat occupy the open side.
 const bench=[[39,126],[79,117],[106,122],[66,132]];P(c,bench,'#DCD4B8');P(c,[[39,126],[66,132],[66,144],[39,138]],'#775536');P(c,[[66,132],[106,122],[106,134],[66,144]],'#674D33');
 L(c,41,126,65,132,'#ECE4CE');L(c,41,136,64,142,'#A37B4D');L(c,69,133,69,141,'#503C2D');L(c,86,128,86,138,'#503C2D');
 line(c,left,12,59,49,59,'#6B7658',3);line(c,left,18,55,43,55,'#9D9E7C');
 for(const [u,col] of [[22,'#9BA274'],[31,'#DCDCC1'],[39,'#6E9C80']]){face(c,left,[[u,54],[u+5,56],[u+10,52],[u+8,33],[u,33],[u-2,51]],col);line(c,left,u,37,u+8,37,'#C5D8BA');line(c,left,u,42,u+8,42,'#C5D8BA');}
 P(c,[[166,141],[220,149],[203,157],[149,148]],'#9DA87C');
 for(let i=0;i<5;i++)L(c,164-i*3,142+i*2,214-i*3,150+i*2,'#687952');
 // Single contact lip. Its bottom is exactly y174, shared with every plate.
 L(c,31,146,213,174,'#66543D');L(c,213,174,329,148,'#66543D');L(c,32,141,213,169,'#C09B6B');L(c,213,169,329,143,'#B8A17A');
}

const arc=(cx,cy,rx,ry,from=Math.PI,to=Math.PI*2,n=32)=>Array.from({length:n+1},(_,i)=>{const a=lerp(from,to,i/n);return[cx+Math.cos(a)*rx,cy+Math.sin(a)*ry];});
function curveLine(c,pts,col,w=1){for(let i=0;i<pts.length-1;i++)L(c,...pts[i],...pts[i+1],col,w);}
function post(c,x,top,bottom,w=13){
 R(c,x,top,w,bottom-top,'#497BB7');R(c,x,top+1,2,bottom-top-1,'#6A99CC');
 P(c,[[x+w,top],[x+w+4,top-3],[x+w+4,bottom-3],[x+w,bottom]],'#2F5E96');
 P(c,[[x,top],[x+4,top-3],[x+w+4,top-3],[x+w,top]],'#6494C5');
}
function beam(c,a,b,width=11){
 P(c,[[a[0],a[1]],[b[0],b[1]],[b[0],b[1]+width],[a[0],a[1]+width]],'#4D82BE');
 L(c,...a,...b,'#6C9AC9',2);L(c,a[0],a[1]+width,b[0],b[1]+width,'#294E7C',2);
}
export function paintIhop(c){
 // A single finished timber plinth under the booth, not the studio floor.
 P(c,[[31,162],[126,120],[329,145],[234,174]],'#514B3D');
 P(c,[[31,158],[126,116],[329,141],[234,168]],'#93907A');
 P(c,[[31,158],[234,168],[234,174],[31,164]],'#5C594B');P(c,[[234,168],[329,141],[329,147],[234,174]],'#6B6856');
 for(let i=0;i<=8;i++){const t=i/8;L(c,lerp(31,126,t),lerp(158,116,t),lerp(234,329,t),lerp(168,141,t),i%2?'#AEA68B':'#747463');}
 for(let i=1;i<9;i++){const t=i/9;L(c,lerp(31,234,t),lerp(158,168,t),lerp(126,329,t),lerp(116,141,t),'#777461');}
 // The very tall, open four-post blue frame is the build's signature.
 // Back members go behind the banquette; front members come last.
 post(c,139,57,131,10);post(c,307,32,145,12);
 beam(c,[49,71],[144,82],10);beam(c,[144,82],[311,68],11);
 // Rounded timber enclosure, with a thin red upholstered cap visible above.
 const outer=arc(168,123,111,27),inner=arc(168,124,101,22);
 P(c,[...outer,...outer.slice().reverse().map(([x,y])=>[x,y+32])],'#715A41');
 P(c,[...outer,...inner.slice().reverse()],'#AD926B');curveLine(c,outer,'#B69A72',2);
 for(let i=0;i<outer.length-1;i+=3){const [x,y]=outer[i];L(c,x,y+4,x,y+30,'#8D7251');L(c,x+2,y+4,x+2,y+28,'#63513C');}
 // Deep blue padded back, with vertical seams following the true curve.
 const back=arc(168,124,101,23),backBase=back.map(([x,y])=>[x,y+26]);
 P(c,[...back,...backBase.slice().reverse()],'#2D5686');curveLine(c,back,'#A95750',2);
 curveLine(c,back.map(([x,y])=>[x,y+3]),'#5783AE');curveLine(c,backBase,'#182F4E',2);
 for(let i=1;i<back.length;i+=3){const[x,y]=back[i];L(c,x,y+4,x,y+23,'#1E3E66');L(c,x+1,y+4,x+1,y+22,'#4C73A0');}
 // Seat ring and its exposed inside fascia are genuinely curved, not two boxes.
 const seatOuter=arc(168,143,103,23),seatInner=arc(168,150,63,20);
 P(c,[...seatOuter,...seatInner.slice().reverse()],'#3D6B9F');
 P(c,[...seatInner,...seatInner.slice().reverse().map(([x,y])=>[x,y+11])],'#234877');
 curveLine(c,seatOuter,'#6B90B6');curveLine(c,seatInner,'#193A62',2);
 curveLine(c,seatInner.map(([x,y])=>[x,y+10]),'#375D87');
 for(let i=2;i<seatOuter.length-1;i+=4)L(c,...seatOuter[i],...seatInner[i],'#284D78');
 // Square open ends of the horseshoe retain their thick blue cushions.
 P(c,[[65,143],[105,150],[105,163],[65,157]],'#315D91');P(c,[[231,150],[271,143],[271,157],[231,163]],'#315D91');
 L(c,66,143,104,150,'#7198BC',2);L(c,232,150,269,143,'#7398BC',2);
 L(c,66,156,104,163,'#1D3A61');L(c,232,163,269,156,'#1D3A61');
 // Round timber café table with a black single pedestal and elliptical foot.
 E(c,163,159,24,6,'#303C3B');E(c,162,158,21,4,'#4B5350');R(c,160,133,6,25,'#273636');R(c,161,134,2,23,'#6B7470');
 E(c,163,132,48,13,'#6B5840');E(c,163,130,48,12,'#BDA577');
 for(const[yy,x1,x2]of [[124,134,191],[128,121,204],[132,120,205],[136,133,194]])L(c,x1,yy,x2,yy,'#AF9366');
 L(c,132,121,179,119,'#D3BD91');L(c,141,136,174,138,'#C7AE7F');
 // Near-side walnut enclosure: a broad visible panel, not a solid booth block.
 P(c,[[224,124],[317,109],[317,147],[224,169]],'#684D36');P(c,[[228,126],[313,112],[313,145],[228,164]],'#806345');
 for(let y=129;y<160;y+=4){const endY=y-15;if(y<=148)L(c,231,y,310,endY,'#967650');else L(c,231,y,279,y-9,'#75563D');}
 L(c,227,127,227,164,'#AE8C60');L(c,313,113,313,146,'#493B2D',2);L(c,229,162,312,144,'#5F4935',2);
 P(c,[[220,121],[313,106],[320,110],[227,127]],'#9C7C55');L(c,221,121,313,106,'#BA9969');L(c,227,127,319,110,'#5E4833');
 // Open front corner posts and high horizontal beams, as in img_7360.
 post(c,47,35,155,12);post(c,216,11,166,16);
 beam(c,[53,70],[222,48],13);beam(c,[222,48],[313,67],13);
 // Lighter front-edge faces make the blue scenic lumber read at native size.
 L(c,217,15,217,163,'#75A2D1');L(c,231,16,231,165,'#335D94');L(c,48,40,48,153,'#79A3CD');
 R(c,46,154,15,3,'#64543E');R(c,215,165,18,4,'#5B4833');
 L(c,31,164,234,174,'#6F6852');L(c,234,174,329,147,'#6F6852');
}
