// A transport-only regression harness. No credentials or real GitHub writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '../..');
const html = fs.readFileSync(path.join(root, 'admin.html'), 'utf8');
const source = html.slice(html.indexOf('async function ghRead('), html.indexOf("$('btnPublish').onclick"));
const response = (status, body) => ({ok:status >= 200 && status < 300, status, json:async()=>body});
const payload = Buffer.from('draft').toString('base64');
let transport;
const context = vm.createContext({fetch:(...args)=>transport(...args), encodeURIComponent, Error, JSON});
vm.runInContext(source, context);
const put = (file = 'content.json', branch = 'main') => context.ghPut('test-owner', 'test-repo', branch, 'fake-test-token', file, payload, 'Test');

// Model a browser retaining the first GET. A successful PUT changes the file
// SHA, but does not invalidate a separate GET URL containing ?ref=main.
let current = 'first-sha', cached = null, writes = 0;
transport = async (url, options = {}) => {
  if (options.method === 'PUT') {
    writes++;
    if (JSON.parse(options.body).sha !== current) return response(409, {message:'content.json does not match ' + current});
    current = 'sha-after-' + writes;
    return response(200, {content:{sha:current}});
  }
  const sha = options.cache === 'no-store' ? current : (cached ||= current);
  return response(200, {sha});
};
await put();
await put();
assert.equal(writes, 2, 'Sequential publishing must use the latest SHA, not a cached first GET');

// An actual race remains a conflict: do not silently refetch and overwrite it.
let attempts = 0;
transport = async (url, options = {}) => {
  if (options.method === 'PUT') { attempts++; return response(409, {message:'content.json does not match concurrent-sha'}); }
  assert.equal(options.cache, 'no-store');
  assert.ok(url.endsWith('?ref=work%2Feditor%26qa'), 'Branch names must be encoded');
  return response(200, {sha:'before-race'});
};
await assert.rejects(put('content.json', 'work/editor&qa'), error => error.status === 409 && /does not match/.test(error.message));
assert.equal(attempts, 1, 'No automatic conflict retry');

// Older/large-file metadata fallback must be fresh too.
let gets = 0;
transport = async (url, options = {}) => {
  if (options.method === 'PUT') { assert.equal(JSON.parse(options.body).sha, 'large-current-sha'); return response(200, {}); }
  gets++;
  assert.equal(options.cache, 'no-store');
  return gets === 1 ? response(403, {message:'File too large'}) : response(200, [{path:'assets/large.jpg', sha:'large-current-sha'}]);
};
await put('assets/large.jpg');
assert.equal(gets, 2);

// Failed metadata is not evidence that a file is absent; never attempt a blind write.
attempts = 0;
transport = async (url, options = {}) => {
  if (options.method === 'PUT') { attempts++; return response(200, {}); }
  return response(403, {message:'Forbidden'});
};
await assert.rejects(put(), /read|version|metadata/i);
assert.equal(attempts, 0);

// A verified 404 can still create new media without a SHA.
transport = async (url, options = {}) => {
  if (options.method === 'PUT') { assert.equal('sha' in JSON.parse(options.body), false); return response(201, {}); }
  return response(404, {message:'Not Found'});
};
await put('assets/new.jpg');
console.log('Admin publish transport passed: repeated saves bypass stale cache, encoded refs, fresh large-file metadata, real conflicts never auto-retry, failed reads never blindly write, and new-file creation.');
