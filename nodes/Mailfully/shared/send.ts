import { DateTime } from 'luxon';
import type { IDataObject } from 'n8n-workflow';

export interface NameValue {
	name: string;
	value: string;
}

export interface AttachmentInput {
	filename: string;
	content: Buffer;
	contentType?: string;
}

export interface EmailInput {
	from: string;
	to: string;
	subject: string;
	html: string;
	text: string;
	cc?: string;
	bcc?: string;
	replyTo?: string;
	scheduledAt?: string;
	type?: string;
	tags?: NameValue[];
	headers?: NameValue[];
	templateId?: string;
	templateVariables?: IDataObject;
	attachments?: AttachmentInput[];
}

export function splitAddresses(value: string | undefined): string[] {
	return (value ?? '')
		.split(',')
		.map((part) => part.trim())
		.filter((part) => part !== '');
}

function filled(rows: NameValue[] | undefined): NameValue[] {
	return (rows ?? []).filter((row) => row.name.trim() !== '');
}

// Builds the POST /v1/emails body (snake_case on the wire; attachments keep
// the API's one camelCase key, `contentType`).
export function buildEmailBody(input: EmailInput): IDataObject {
	const body: IDataObject = { from: input.from.trim(), to: splitAddresses(input.to) };

	if (input.subject) body.subject = input.subject;
	if (input.html) body.html = input.html;
	if (input.text) body.text = input.text;

	const lists: Array<[string, string | undefined]> = [
		['cc', input.cc],
		['bcc', input.bcc],
		['reply_to', input.replyTo],
	];
	for (const [key, value] of lists) {
		const addresses = splitAddresses(value);
		if (addresses.length > 0) body[key] = addresses;
	}

	if (input.scheduledAt) body.scheduled_at = input.scheduledAt;
	if (input.type) body.type = input.type;

	const tags = filled(input.tags);
	if (tags.length > 0) body.tags = tags.map(({ name, value }) => ({ name: name.trim(), value }));

	const headers = filled(input.headers);
	if (headers.length > 0) {
		body.headers = Object.fromEntries(headers.map(({ name, value }) => [name.trim(), value]));
	}

	if (input.templateId) {
		const template: IDataObject = { id: input.templateId };
		if (input.templateVariables && Object.keys(input.templateVariables).length > 0) {
			template.variables = input.templateVariables;
		}
		body.template = template;
	}

	if (input.attachments && input.attachments.length > 0) {
		body.attachments = input.attachments.map((a) => {
			const out: IDataObject = { filename: a.filename, content: a.content.toString('base64') };
			if (a.contentType) out.contentType = a.contentType;
			return out;
		});
	}

	return body;
}

// n8n date fields often carry no zone. Read them in the workflow's time zone
// and send UTC, so the API never guesses.
export function toUtcIso(value: string, timeZone: string): string {
	const parsed = DateTime.fromISO(value, { zone: timeZone });
	if (!parsed.isValid) throw new Error(`"${value}" is not a valid date`);
	return parsed.toUTC().toISO() as string;
}

export function chunk<T>(items: T[], size: number): T[][] {
	const groups: T[][] = [];
	for (let i = 0; i < items.length; i += size) groups.push(items.slice(i, i + size));
	return groups;
}
