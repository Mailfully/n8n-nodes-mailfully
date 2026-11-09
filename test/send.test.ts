import { describe, expect, it } from 'vitest';
import { buildEmailBody, chunk, splitAddresses, toUtcIso } from '../nodes/Mailfully/shared/send';

describe('splitAddresses', () => {
	it('splits on commas and trims', () => {
		expect(splitAddresses(' a@x.com, b@y.com ,,')).toEqual(['a@x.com', 'b@y.com']);
	});

	it('keeps a display name that contains no comma', () => {
		expect(splitAddresses('Ann Lee <ann@x.com>')).toEqual(['Ann Lee <ann@x.com>']);
	});

	it('returns an empty list for blank input', () => {
		expect(splitAddresses('  ')).toEqual([]);
	});
});

describe('buildEmailBody', () => {
	it('builds the minimum send body', () => {
		expect(
			buildEmailBody({
				from: 'hi@x.com',
				to: 'a@y.com',
				subject: 'Hi',
				html: '<p>Hi</p>',
				text: '',
			}),
		).toEqual({ from: 'hi@x.com', to: ['a@y.com'], subject: 'Hi', html: '<p>Hi</p>' });
	});

	it('maps optional fields to the snake_case wire names', () => {
		const body = buildEmailBody({
			from: 'hi@x.com',
			to: 'a@y.com',
			subject: 'Hi',
			html: '',
			text: 'Hi',
			cc: 'c@y.com',
			bcc: 'd@y.com, e@y.com',
			replyTo: 'r@x.com',
			scheduledAt: '2026-12-01T09:00:00.000Z',
			type: 'marketing',
			tags: [{ name: 'flow', value: 'welcome' }],
			headers: [{ name: 'X-Campaign', value: 'nov' }],
			templateId: 'tmpl_1',
			templateVariables: { name: 'Ann' },
		});
		expect(body).toEqual({
			from: 'hi@x.com',
			to: ['a@y.com'],
			subject: 'Hi',
			text: 'Hi',
			cc: ['c@y.com'],
			bcc: ['d@y.com', 'e@y.com'],
			reply_to: ['r@x.com'],
			scheduled_at: '2026-12-01T09:00:00.000Z',
			type: 'marketing',
			tags: [{ name: 'flow', value: 'welcome' }],
			headers: { 'X-Campaign': 'nov' },
			template: { id: 'tmpl_1', variables: { name: 'Ann' } },
		});
	});

	it('sends a template with no subject or body', () => {
		expect(
			buildEmailBody({
				from: 'hi@x.com',
				to: 'a@y.com',
				subject: '',
				html: '',
				text: '',
				templateId: 'tmpl_1',
			}),
		).toEqual({ from: 'hi@x.com', to: ['a@y.com'], template: { id: 'tmpl_1' } });
	});

	it('encodes attachments as bare base64 with camelCase contentType', () => {
		const body = buildEmailBody({
			from: 'hi@x.com',
			to: 'a@y.com',
			subject: 'Hi',
			html: '',
			text: 'Hi',
			attachments: [
				{ filename: 'a.txt', content: Buffer.from('hello'), contentType: 'text/plain' },
				{ filename: 'b.bin', content: Buffer.from([0, 1, 2]) },
			],
		});
		expect(body.attachments).toEqual([
			{ filename: 'a.txt', content: 'aGVsbG8=', contentType: 'text/plain' },
			{ filename: 'b.bin', content: 'AAEC' },
		]);
	});

	it('drops tag and header rows with an empty name', () => {
		const body = buildEmailBody({
			from: 'hi@x.com',
			to: 'a@y.com',
			subject: 'Hi',
			html: '',
			text: 'Hi',
			tags: [{ name: '', value: 'x' }],
			headers: [{ name: ' ', value: 'x' }],
		});
		expect(body).not.toHaveProperty('tags');
		expect(body).not.toHaveProperty('headers');
	});
});

describe('toUtcIso', () => {
	it('reads a zone-less date in the workflow time zone', () => {
		expect(toUtcIso('2026-12-01T09:00:00', 'America/New_York')).toBe('2026-12-01T14:00:00.000Z');
	});

	it('keeps an explicit offset', () => {
		expect(toUtcIso('2026-12-01T09:00:00+01:00', 'America/New_York')).toBe(
			'2026-12-01T08:00:00.000Z',
		);
	});

	it('refuses a value that is not a date', () => {
		expect(() => toUtcIso('tomorrow', 'UTC')).toThrow();
	});
});

describe('chunk', () => {
	it('splits into groups of at most the given size', () => {
		expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
		expect(chunk([], 100)).toEqual([]);
	});
});
