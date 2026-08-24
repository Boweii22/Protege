import assert from 'node:assert/strict';
import {routeFor,routingManifest} from '../server/ai-router.js';

const routes=routingManifest();
for(const purpose of ['topic','student','examiner','diagnosis']){
  assert.equal(routes[purpose].length,4,`${purpose} should have four recovery models`);
  assert.equal(routes[purpose].at(-1),'google/gemini-2.5-flash-lite',`${purpose} must end with the continuity model`);
  assert.equal(new Set(routes[purpose].map(model=>model.split('/')[0])).size,3,`${purpose} must span three providers`);
}
process.env.AI_STUDENT_MODELS='openai/gpt-5.4-mini, anthropic/claude-haiku-4.5';
assert.deepEqual(routeFor('student').slice(0,2),['openai/gpt-5.4-mini','anthropic/claude-haiku-4.5']);
console.log('Paid routing policy verified across all generation purposes.');
