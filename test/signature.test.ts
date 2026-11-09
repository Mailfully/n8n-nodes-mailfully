import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyWebhookSignature } from '../nodes/MailfullyTrigger/signature';

// Same secret shape the API mints: `whsec_` + base64url key bytes.
const keyBytes = Buffer.from('0123456789abcdef0123456789abcdef', 'utf8');
const secret = `whsec_${keyBytes.toString('base64url')}`;
const id = 'msg_01J8ZQ2Y3X';
const timestamp = 1_794_240_000;
const body =
	'{"type":"email.delivered","created_at":"2026-11-09T16:00:00.000Z","data":{"id":"e_1"}}';

function sign(content: { id: string; timestamp: number; body: string }, key = keyBytes): string {
	const digest = createHmac('sha256', key)
		.update(`${content.id}.${content.timestamp}.${content.body}`)
		.digest('base64');
	return `v1,${digest}`;
}

const valid = { secret, id, timestamp: String(timestamp), body, nowSec: timestamp };

describe('verifyWebhookSignature', () => {
	it('accepts a correctly signed delivery', () => {
		expect(verifyWebhookSignature({ ...valid, signature: sign({ id, timestamp, body }) })).toBe(
			true,
		);
	});

	it('accepts when one of several space-separated signatures matches', () => {
		const header = `v1,AAAA ${sign({ id, timestamp, body })}`;
		expect(verifyWebhookSignature({ ...valid, signature: header })).toBe(true);
	});

	it('rejects a signature made with a different secret', () => {
		const other = Buffer.from('ffffffffffffffffffffffffffffffff', 'utf8');
		expect(
			verifyWebhookSignature({ ...valid, signature: sign({ id, timestamp, body }, other) }),
		).toBe(false);
	});

	it('rejects a tampered body', () => {
		const signature = sign({ id, timestamp, body });
		expect(verifyWebhookSignature({ ...valid, signature, body: body.replace('e_1', 'e_2') })).toBe(
			false,
		);
	});

	it('rejects a tampered id', () => {
		const signature = sign({ id, timestamp, body });
		expect(verifyWebhookSignature({ ...valid, signature, id: 'msg_other' })).toBe(false);
	});

	it('rejects a timestamp outside the five-minute window, either direction', () => {
		const signature = sign({ id, timestamp, body });
		expect(verifyWebhookSignature({ ...valid, signature, nowSec: timestamp + 301 })).toBe(false);
		expect(verifyWebhookSignature({ ...valid, signature, nowSec: timestamp - 301 })).toBe(false);
		// Negative control: inside the window the same signature passes.
		expect(verifyWebhookSignature({ ...valid, signature, nowSec: timestamp + 299 })).toBe(true);
	});

	it('rejects a non-numeric timestamp', () => {
		const signature = sign({ id, timestamp, body });
		expect(verifyWebhookSignature({ ...valid, signature, timestamp: 'soon' })).toBe(false);
	});

	it('rejects missing headers and a non-v1 scheme', () => {
		const signature = sign({ id, timestamp, body });
		expect(verifyWebhookSignature({ ...valid, signature: '' })).toBe(false);
		expect(verifyWebhookSignature({ ...valid, signature, id: '' })).toBe(false);
		expect(verifyWebhookSignature({ ...valid, signature: signature.replace('v1,', 'v2,') })).toBe(
			false,
		);
	});

	it('rejects a secret without the whsec_ prefix', () => {
		const signature = sign({ id, timestamp, body });
		expect(verifyWebhookSignature({ ...valid, signature, secret: 'not-a-secret' })).toBe(false);
	});
});
