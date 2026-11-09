import {
	NodeConnectionTypes,
	NodeOperationError,
	type IDataObject,
	type IHookFunctions,
	type INodeType,
	type INodeTypeDescription,
	type IWebhookFunctions,
	type IWebhookResponseData,
} from 'n8n-workflow';
import { downloadAttachments } from '../Mailfully/shared/attachments';
import { asNodeError, mailfullyApiRequest } from '../Mailfully/shared/transport';
import { verifyWebhookSignature } from './signature';

const EVENTS = [
	{ name: 'Email Bounced', value: 'email.bounced' },
	{ name: 'Email Clicked', value: 'email.clicked' },
	{ name: 'Email Complained', value: 'email.complained' },
	{ name: 'Email Delivered', value: 'email.delivered' },
	{ name: 'Email Delivery Delayed', value: 'email.delivery_delayed' },
	{ name: 'Email Failed', value: 'email.failed' },
	{ name: 'Email Opened', value: 'email.opened' },
	{ name: 'Email Received', value: 'email.received' },
	{ name: 'Email Suppressed', value: 'email.suppressed' },
	{ name: 'Email Unsubscribed', value: 'email.unsubscribed' },
];

interface RegisteredWebhook {
	id: string;
	secret: string;
}

// Keyed by webhook URL: the production URL and n8n's test URL each get their
// own Mailfully webhook, so listening for a test event never replaces the
// production one.
interface StaticData {
	webhooks?: Record<string, RegisteredWebhook>;
}

function registered(data: StaticData): Record<string, RegisteredWebhook> {
	data.webhooks ??= {};
	return data.webhooks;
}

function header(value: string | string[] | undefined): string {
	return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function isNotFound(error: unknown): boolean {
	return String((error as IDataObject)?.httpCode ?? '') === '404';
}

export class MailfullyTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Mailfully Trigger',
		name: 'mailfullyTrigger',
		icon: { light: 'file:../../icons/mailfully.svg', dark: 'file:../../icons/mailfully.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["events"].join(", ")}}',
		description: 'Starts the workflow when Mailfully sends an email event',
		defaults: { name: 'Mailfully Trigger' },
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'mailfullyApi', required: true }],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				required: true,
				default: ['email.delivered'],
				options: EVENTS,
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Download Attachments',
						name: 'downloadAttachments',
						type: 'boolean',
						default: false,
						description: 'Whether to download the attachments of received emails as binary data',
					},
				],
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const hooks = registered(this.getWorkflowStaticData('node') as StaticData);
				const url = this.getNodeWebhookUrl('default') as string;
				const mine = hooks[url];
				if (!mine) return false;

				const events = [...(this.getNodeParameter('events') as string[])].sort();
				const page = await mailfullyApiRequest.call(this, 'GET', '/v1/webhooks');
				const existing = ((page.data as IDataObject[] | undefined) ?? []).find(
					(w) => w.id === mine.id,
				);

				const same =
					existing !== undefined &&
					existing.url === url &&
					existing.status === 'enabled' &&
					JSON.stringify([...((existing.events as string[]) ?? [])].sort()) ===
						JSON.stringify(events);
				if (same) return true;

				// Changed events or disabled: replace this URL's webhook only.
				if (existing !== undefined) {
					await mailfullyApiRequest.call(this, 'DELETE', `/v1/webhooks/${mine.id}`);
				}
				delete hooks[url];
				return false;
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const url = this.getNodeWebhookUrl('default');
				const events = this.getNodeParameter('events') as string[];
				if (events.length === 0) {
					throw new NodeOperationError(this.getNode(), 'Select at least one event');
				}

				const webhook = await mailfullyApiRequest.call(this, 'POST', '/v1/webhooks', {
					body: { url, events },
				});
				if (typeof webhook.id !== 'string' || typeof webhook.signing_secret !== 'string') {
					throw new NodeOperationError(
						this.getNode(),
						'Mailfully did not return a webhook ID and secret',
					);
				}

				const hooks = registered(this.getWorkflowStaticData('node') as StaticData);
				hooks[url as string] = { id: webhook.id, secret: webhook.signing_secret };
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const hooks = registered(this.getWorkflowStaticData('node') as StaticData);
				const url = this.getNodeWebhookUrl('default') as string;
				const mine = hooks[url];
				if (mine) {
					try {
						await mailfullyApiRequest.call(this, 'DELETE', `/v1/webhooks/${mine.id}`);
					} catch (error) {
						// Already gone is the state we wanted; anything else is a real failure.
						if (!isNotFound(error)) throw asNodeError(this.getNode(), error);
					}
				}
				delete hooks[url];
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const req = this.getRequestObject();
		const res = this.getResponseObject();
		const hooks = registered(this.getWorkflowStaticData('node') as StaticData);

		const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
		const body = rawBody ? rawBody.toString('utf8') : JSON.stringify(this.getBodyData());

		// Production and test webhooks have different secrets; either may sign.
		const nowSec = Math.floor(Date.now() / 1000);
		const valid = Object.values(hooks).some(({ secret }) =>
			verifyWebhookSignature({
				secret,
				id: header(req.headers['webhook-id']),
				timestamp: header(req.headers['webhook-timestamp']),
				signature: header(req.headers['webhook-signature']),
				body,
				nowSec,
			}),
		);
		if (!valid) {
			res.status(401).send('Invalid signature');
			return { noWebhookResponse: true };
		}

		const event = this.getBodyData();
		const options = this.getNodeParameter('options', {}) as IDataObject;
		const emailId = (event.data as IDataObject | undefined)?.email_id;

		if (
			options.downloadAttachments === true &&
			event.type === 'email.received' &&
			typeof emailId === 'string'
		) {
			const page = await mailfullyApiRequest.call(
				this,
				'GET',
				`/v1/emails/receiving/${encodeURIComponent(emailId)}/attachments`,
			);
			const binary = await downloadAttachments.call(this, (page.data as IDataObject[]) ?? []);
			return { workflowData: [[{ json: event, binary }]] };
		}

		return { workflowData: [this.helpers.returnJsonArray(event)] };
	}
}
