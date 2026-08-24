import assert from 'node:assert/strict';
import {reportError} from '../server/observability.js';
import {getSql} from '../server/db.js';

const incidentId=await reportError(new Error('provider token=do-not-store-this'),{requestId:'observability-test',route:'/api/test',started:Date.now()},{status:500,kind:'test'});const sql=getSql();const rows=await sql`SELECT * FROM error_events WHERE incident_id=${incidentId}`;
assert.equal(rows.length,1);assert.equal(rows[0].message.includes('do-not-store-this'),false);assert.equal(rows[0].message.includes('[redacted]'),true);assert.equal(rows[0].fingerprint.length,24);
await sql`DELETE FROM error_events WHERE incident_id=${incidentId}`;
console.log('Structured incident capture, correlation, persistence, and secret redaction verified.');
