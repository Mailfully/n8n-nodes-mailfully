import {
	NodeConnectionTypes,
	NodeOperationError,
	type IBinaryKeyData,
	type IDataObject,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';
import { fieldProperties, operationProperties, resourceProperty } from './descriptions';
import {
	buildEmailBody,
	chunk,
	splitAddresses,
	toUtcIso,
	type AttachmentInput,
	type NameValue,
} from './shared/send';
import { downloadAttachments } from './shared/attachments';
import { asNodeError, mailfullyApiRequest, mailfullyApiRequestAllItems } from './shared/transport';

const BATCH_SIZE = 100;

export class Mailfully implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Mailfully',
		name: 'mailfully',
		icon: { light: 'file:../../icons/mailfully.svg', dark: 'file:../../icons/mailfully.svg' },
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Send email and read sent and received mail with Mailfully',
		defaults: { name: 'Mailfully' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'mailfullyApi', required: true }],
		properties: [resourceProperty, ...operationProperties, ...fieldProperties],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		if (resource === 'email' && operation === 'sendBatch') {
			return [await sendBatch.call(this, items)];
		}

		const out: INodeExecutionData[] = [];
		for (let i = 0; i < items.length; i++) {
			try {
				const result = await runItem.call(this, resource, operation, i);
				const results = Array.isArray(result) ? result : [result];
				for (const entry of results) {
					out.push({ ...entry, pairedItem: { item: i } });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					out.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				throw asNodeError(this.getNode(), error, i);
			}
		}
		return [out];
	}
}

async function runItem(
	this: IExecuteFunctions,
	resource: string,
	operation: string,
	i: number,
): Promise<INodeExecutionData | INodeExecutionData[]> {
	const id = () => encodeURIComponent((this.getNodeParameter('id', i) as string).trim());
	const json = (data: IDataObject): INodeExecutionData => ({ json: data });
	const list = (rows: IDataObject[]): INodeExecutionData[] => rows.map(json);

	if (resource === 'email') {
		switch (operation) {
			case 'send': {
				const body = await emailBody.call(this, i);
				const headers = { 'Idempotency-Key': idempotencyKey.call(this, i) };
				return json(
					await mailfullyApiRequest.call(this, 'POST', '/v1/emails', { body, headers }, i),
				);
			}
			case 'get':
				return json(await mailfullyApiRequest.call(this, 'GET', `/v1/emails/${id()}`, {}, i));
			case 'cancel':
				return json(
					await mailfullyApiRequest.call(this, 'POST', `/v1/emails/${id()}/cancel`, {}, i),
				);
			case 'getEvents': {
				const page = await mailfullyApiRequest.call(
					this,
					'GET',
					`/v1/emails/${id()}/events`,
					{},
					i,
				);
				return list((page.data as IDataObject[] | undefined) ?? []);
			}
			case 'getAll':
				return list(await getAll.call(this, '/v1/emails', 'cursor', i));
		}
	}

	if (resource === 'receivedEmail') {
		switch (operation) {
			case 'get':
				return json(
					await mailfullyApiRequest.call(this, 'GET', `/v1/emails/receiving/${id()}`, {}, i),
				);
			case 'getAll':
				return list(await getAll.call(this, '/v1/emails/receiving', 'after', i));
			case 'getAttachments': {
				const page = await mailfullyApiRequest.call(
					this,
					'GET',
					`/v1/emails/receiving/${id()}/attachments`,
					{},
					i,
				);
				const attachments = (page.data as IDataObject[] | undefined) ?? [];
				const binary: IBinaryKeyData = await downloadAttachments.call(this, attachments);
				return { json: { attachments }, binary };
			}
		}
	}

	if (resource === 'domain') {
		if (operation === 'get') {
			return json(await mailfullyApiRequest.call(this, 'GET', `/v1/domains/${id()}`, {}, i));
		}
		const page = await mailfullyApiRequest.call(this, 'GET', '/v1/domains', {}, i);
		return list((page.data as IDataObject[] | undefined) ?? []);
	}

	if (resource === 'template') {
		if (operation === 'get') {
			return json(await mailfullyApiRequest.call(this, 'GET', `/v1/templates/${id()}`, {}, i));
		}
		const page = await mailfullyApiRequest.call(this, 'GET', '/v1/templates', {}, i);
		return list((page.data as IDataObject[] | undefined) ?? []);
	}

	if (resource === 'suppression') {
		switch (operation) {
			case 'create': {
				const email = (this.getNodeParameter('email', i) as string).trim();
				return json(
					await mailfullyApiRequest.call(this, 'POST', '/v1/suppressions', { body: { email } }, i),
				);
			}
			case 'delete':
				return json(
					await mailfullyApiRequest.call(this, 'DELETE', `/v1/suppressions/${id()}`, {}, i),
				);
			case 'getAll':
				return list(await getAll.call(this, '/v1/suppressions', 'cursor', i));
		}
	}

	throw new NodeOperationError(
		this.getNode(),
		`Unsupported operation "${operation}" for "${resource}"`,
		{
			itemIndex: i,
		},
	);
}

async function getAll(
	this: IExecuteFunctions,
	path: string,
	cursorParam: 'cursor' | 'after',
	i: number,
): Promise<IDataObject[]> {
	const returnAll = this.getNodeParameter('returnAll', i) as boolean;
	const limit = returnAll ? undefined : (this.getNodeParameter('limit', i) as number);
	const filters = this.getNodeParameter('filters', i, {}) as IDataObject;

	const qs: IDataObject = {};
	for (const [key, value] of Object.entries(filters)) {
		if (value === '' || value === false || value === undefined || value === null) continue;
		if (key === 'from' || key === 'to') {
			qs[key] = toUtcIso(String(value), this.getTimezone());
			continue;
		}
		qs[key] = value === true ? 'true' : value;
	}
	return mailfullyApiRequestAllItems.call(this, path, { qs, cursorParam, limit }, i);
}

// The API remembers a key for 24 hours across the whole organization, so the
// default key names the workflow, execution, node, node run and item. Batches
// add their request number to a custom key, since one custom key would
// otherwise repeat across requests.
function idempotencyKey(this: IExecuteFunctions, i: number, batch?: number): string {
	const fields = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
	const custom = typeof fields.idempotencyKey === 'string' ? fields.idempotencyKey.trim() : '';
	const suffix = batch === undefined ? '' : `-batch-${batch}`;
	if (custom !== '') return `${custom}${suffix}`;

	const runIndex = String(this.evaluateExpression('{{$runIndex}}', i) ?? 0);
	const parts = [
		'n8n',
		this.getWorkflow().id ?? 'workflow',
		this.getExecutionId(),
		this.getNode().id,
		`r${runIndex}`,
		batch === undefined ? `i${i}` : `b${batch}`,
	];
	return parts.join('-');
}

async function emailBody(this: IExecuteFunctions, i: number): Promise<IDataObject> {
	const fields = this.getNodeParameter('additionalFields', i, {}) as IDataObject;

	const rows = (key: string, inner: string): NameValue[] =>
		((fields[key] as IDataObject | undefined)?.[inner] as NameValue[] | undefined) ?? [];

	let templateVariables: IDataObject | undefined;
	if (fields.templateVariables !== undefined && fields.templateVariables !== '') {
		const raw = fields.templateVariables;
		try {
			templateVariables = (typeof raw === 'string' ? JSON.parse(raw) : raw) as IDataObject;
		} catch {
			throw new NodeOperationError(this.getNode(), 'Template Variables must be valid JSON', {
				itemIndex: i,
			});
		}
	}

	const attachments: AttachmentInput[] = [];
	for (const property of splitAddresses(fields.attachments as string | undefined)) {
		const meta = this.helpers.assertBinaryData(i, property);
		attachments.push({
			filename: meta.fileName ?? property,
			content: await this.helpers.getBinaryDataBuffer(i, property),
			contentType: meta.mimeType,
		});
	}

	return buildEmailBody({
		from: this.getNodeParameter('from', i) as string,
		to: this.getNodeParameter('to', i) as string,
		subject: this.getNodeParameter('subject', i, '') as string,
		html: this.getNodeParameter('html', i, '') as string,
		text: this.getNodeParameter('text', i, '') as string,
		cc: fields.cc as string | undefined,
		bcc: fields.bcc as string | undefined,
		replyTo: fields.replyTo as string | undefined,
		scheduledAt: fields.scheduledAt
			? toUtcIso(String(fields.scheduledAt), this.getTimezone())
			: undefined,
		type: fields.type as string | undefined,
		tags: rows('tags', 'tag'),
		headers: rows('headers', 'header'),
		templateId: (fields.templateId as string | undefined)?.trim(),
		templateVariables,
		attachments,
	});
}

// One request per 100 input items. The API accepts or refuses a batch whole,
// so a failure applies to every item in that request.
async function sendBatch(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
): Promise<INodeExecutionData[]> {
	const out: INodeExecutionData[] = [];
	const groups = chunk(
		items.map((_, index) => index),
		BATCH_SIZE,
	);

	for (const [groupIndex, group] of groups.entries()) {
		try {
			const body: IDataObject[] = [];
			for (const i of group) body.push(await emailBody.call(this, i));

			const first = group[0];
			const headers = {
				'Idempotency-Key': idempotencyKey.call(this, first, groupIndex),
			};
			const response = await mailfullyApiRequest.call(
				this,
				'POST',
				'/v1/emails/batch',
				{ body, headers },
				first,
			);
			const accepted = (response.data as IDataObject[] | undefined) ?? [];
			group.forEach((i, position) => {
				out.push({ json: accepted[position] ?? {}, pairedItem: { item: i } });
			});
		} catch (error) {
			if (!this.continueOnFail()) throw asNodeError(this.getNode(), error, group[0]);
			for (const i of group) {
				out.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
			}
		}
	}
	return out;
}
