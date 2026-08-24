import assert from 'node:assert/strict';
import {acquireLease,enforceRateLimit,RateLimitError} from '../server/guardrails.js';
import {getSql} from '../server/db.js';

const sql=getSql();const identity=`guardrail-test-${Date.now()}`;const headers={};const response={setHeader:(key,value)=>{headers[key]=value}};
await enforceRateLimit(response,{identity,key:'test:guardrails',limit:2,windowSeconds:60});
await enforceRateLimit(response,{identity,key:'test:guardrails',limit:2,windowSeconds:60});
await assert.rejects(()=>enforceRateLimit(response,{identity,key:'test:guardrails',limit:2,windowSeconds:60}),RateLimitError);
assert.equal(headers['RateLimit-Remaining'],'0');assert.ok(Number(headers['Retry-After'])>0);
const release=await acquireLease(identity,'test',10);await assert.rejects(()=>acquireLease(identity,'test',10),RateLimitError);await release();const releaseAgain=await acquireLease(identity,'test',10);await releaseAgain();
await sql`DELETE FROM rate_limit_windows WHERE bucket='test:guardrails:60'`;
console.log('Atomic rate limits, headers, and duplicate-generation leases verified.');
