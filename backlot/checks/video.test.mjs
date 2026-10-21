import assert from 'node:assert/strict';
import fs from 'node:fs';
import {hostedVideo,mediaKind,galleryFor,watchLinks,normalizeContent,thumbnailFor} from '../content.mjs';
const id='PiSPYPvDHnY';
for(const src of [`https://www.youtube.com/watch?v=${id}&feature=share`,`https://youtu.be/${id}?si=abc`,`https://m.youtube.com/watch?v=${id}`,`https://youtube.com/shorts/${id}`,`https://youtube.com/live/${id}`,`https://www.youtube.com/embed/${id}`,`https://www.youtube-nocookie.com/embed/${id}`]){
 const item=hostedVideo(src);assert.equal(item.provider,'YouTube');assert.equal(item.id,id);assert.equal(item.embedURL,`https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0`);assert.equal(mediaKind(src),'embed');
}
for(const src of ['https://vimeo.com/123456789','https://www.vimeo.com/123456789/','https://player.vimeo.com/video/123456789'])assert.equal(hostedVideo(src).embedURL,'https://player.vimeo.com/video/123456789?playsinline=1');
for(const src of ['https://vimeo.com/123456789/abcdef1234','https://vimeo.com/123456789?h=abcdef1234','https://player.vimeo.com/video/123456789?h=abcdef1234'])assert.equal(hostedVideo(src).embedURL,'https://player.vimeo.com/video/123456789?playsinline=1&h=abcdef1234');
for(const src of ['',null,'javascript:alert(1)','data:text/html,video',`http://youtube.com/watch?v=${id}`,`https://youtube.com.evil.test/watch?v=${id}`,`https://youtube.com@evil.test/watch?v=${id}`,`https://evil.test@youtube.com/watch?v=${id}`,`https://youtube.com:8443/watch?v=${id}`,`https://evil.test/embed/${id}`,`https://youtu.be/${id}/other`,'https://youtube.com/watch?v=too-short','https://youtube.com/playlist?list=abc','https://youtube.com/embed/%22%3E%3Cscript%3E','https://vimeo.com/channels','https://vimeo.com/1234/bad-hash','https://player.vimeo.com/video/1234?h=%22%3E','https://vimeo.com/0'])assert.equal(hostedVideo(src),null,String(src));
assert.ok(hostedVideo(`https://youtube.com/watch?v=${id}&t=1m13s`).embedURL.endsWith('&start=73'));
assert.ok(hostedVideo(`https://youtube.com/embed/${id}?start=73`).embedURL.endsWith('&start=73'));
assert.ok(hostedVideo('https://vimeo.com/12345#t=1m13s').embedURL.endsWith('#t=73s'));
assert.ok(!hostedVideo(`https://youtube.com/watch?v=${id}&t=%22%3E`).embedURL.includes('start='));
const raw=JSON.parse(fs.readFileSync(new URL('../../content.json',import.meta.url),'utf8')),data=normalizeContent(raw),films=data.projects.filter(p=>watchLinks(p).length);
assert.equal(films.length,18);assert.equal(films.reduce((n,p)=>n+watchLinks(p).length,0),19);
for(const p of films){const items=galleryFor(p);assert.equal(items.filter(item=>item.kind==='embed').length,watchLinks(p).length);assert.ok(thumbnailFor(p));for(const film of watchLinks(p))assert.ok(hostedVideo(film.src));}
const p={image:'assets/cover.jpg',gallery:[{src:'assets/film.mp4'},{src:'https://example.com/film.webm?x=1'},{src:`https://youtu.be/${id}`},{src:'https://youtube.com/playlist?list=unsupported'}]};
assert.deepEqual(galleryFor(p).map(x=>x.kind),['image','video','video','embed']);assert.equal(watchLinks(p).length,2);assert.equal(mediaKind('assets/film.mp4'),'video');
console.log('Video URL/data checks passed: current films, YouTube URL forms, Vimeo/unlisted hashes, allowlisted iframe origins, credentials/ports/injection rejection, fallback-only unsupported links, images and native MP4/WebM unchanged.');
