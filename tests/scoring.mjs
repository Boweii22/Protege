import assert from 'node:assert/strict';
import {normalizeExam} from '../server/scoring.js';
const exam={total:0,verdict:'',questions:[20,18,17,19,16].map(score=>({score}))};
assert.equal(normalizeExam(exam).total,90);
assert.equal(normalizeExam(exam).questions,exam.questions);
console.log('Scoring normalization passed.');
