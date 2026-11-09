import { createHmac, timingSafeEqual } from 'crypto';

// Mailfully signs webhooks with the Standard Webhooks (Svix) scheme: HMAC-SHA256
// over `id.timestamp.body`, keyed by the bytes after `whsec_`, sent as
// `v1,<base64>` in `webhook-signature` (space-separated during secret rotation).

const SECRET_PREFIX = 'whsec_';
const TOLERANCE_SEC = 300;

function equal(a: string, b: string): boolean {
	const ab = Buffer.from(a, 'utf8');
	const bb = Buffer.from(b, 'utf8');
	return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function verifyWebhookSignature(input: {
	secret: string;
	id: string;
	timestamp: string;
	signature: string;
	body: string;
	nowSec: number;
}): boolean {
	const { secret, id, signature, body, nowSec } = input;
	if (!secret.startsWith(SECRET_PREFIX) || !id || !signature) return false;

	if (!/^\d+$/.test(input.timestamp)) return false;
	const timestamp = Number(input.timestamp);
	if (!Number.isFinite(timestamp) || Math.abs(nowSec - timestamp) > TOLERANCE_SEC) return false;

	const key = Buffer.from(secret.slice(SECRET_PREFIX.length), 'base64url');
	const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64');

	return signature
		.split(' ')
		.map((token) => token.split(','))
		.some(([version, value]) => version === 'v1' && value !== undefined && equal(value, expected));
}
