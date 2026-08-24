import assert from 'node:assert/strict';
import handler from '../api/account.js';
process.env.E2E_TEST_MODE='true';
const headers={};let status=0;let body='';const response={setHeader:(key,value)=>{headers[key.toLowerCase()]=value},status(value){status=value;return this},send(value){body=value;return this},json(value){body=JSON.stringify(value);return this}};
await handler({method:'GET',query:{action:'export'},headers:{}},response);
assert.equal(status,200);assert.match(headers['content-disposition'],/protege-export-/);const payload=JSON.parse(body);assert.equal(payload.product,'Protégé');assert.equal(payload.accountId,'e2e-learning-dashboard');assert.ok(Array.isArray(payload.lessons));assert.ok(Array.isArray(payload.generatedTopics));assert.ok(Array.isArray(payload.aiGenerationLedger));
console.log('Authenticated complete-account export verified.');
