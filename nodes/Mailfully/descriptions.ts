import type { INodeProperties } from 'n8n-workflow';

const email = { resource: ['email'] };
const sendOps = { resource: ['email'], operation: ['send', 'sendBatch'] };

export const resourceProperty: INodeProperties = {
	displayName: 'Resource',
	name: 'resource',
	type: 'options',
	noDataExpression: true,
	options: [
		{ name: 'Domain', value: 'domain' },
		{ name: 'Email', value: 'email' },
		{ name: 'Received Email', value: 'receivedEmail' },
		{ name: 'Suppression', value: 'suppression' },
		{ name: 'Template', value: 'template' },
	],
	default: 'email',
};

export const operationProperties: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: email },
		options: [
			{
				name: 'Cancel',
				value: 'cancel',
				action: 'Cancel a scheduled email',
				description: 'Cancel an email that has not been sent yet',
			},
			{ name: 'Get', value: 'get', action: 'Get an email', description: 'Get a sent email by ID' },
			{
				name: 'Get Events',
				value: 'getEvents',
				action: 'Get the events of an email',
				description: 'Get the delivery events of a sent email',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many emails',
				description: 'List sent emails',
			},
			{
				name: 'Send',
				value: 'send',
				action: 'Send an email',
				description: 'Send one email per input item',
			},
			{
				name: 'Send Batch',
				value: 'sendBatch',
				action: 'Send emails in a batch',
				description: 'Send one email per input item, up to 100 per request',
			},
		],
		default: 'send',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['receivedEmail'] } },
		options: [
			{
				name: 'Get',
				value: 'get',
				action: 'Get a received email',
				description: 'Get a received email by ID',
			},
			{
				name: 'Get Attachments',
				value: 'getAttachments',
				action: 'Get the attachments of a received email',
				description: 'Download the attachments of a received email',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many received emails',
				description: 'List received emails',
			},
		],
		default: 'getAll',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['domain'] } },
		options: [
			{ name: 'Get', value: 'get', action: 'Get a domain', description: 'Get a domain by ID' },
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many domains',
				description: 'List domains',
			},
		],
		default: 'getAll',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['template'] } },
		options: [
			{ name: 'Get', value: 'get', action: 'Get a template', description: 'Get a template by ID' },
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many templates',
				description: 'List templates',
			},
		],
		default: 'getAll',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['suppression'] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create a suppression',
				description: 'Stop sending to an address',
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a suppression',
				description: 'Allow sending to an address again',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many suppressions',
				description: 'List suppressed addresses',
			},
		],
		default: 'getAll',
	},
];

const sendFields: INodeProperties[] = [
	{
		displayName: 'From',
		name: 'from',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'Acme <hello@acme.com>',
		description: 'Sender address on a verified domain, with an optional display name',
		displayOptions: { show: sendOps },
	},
	{
		displayName: 'To',
		name: 'to',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'ann@example.com',
		description: 'Recipient addresses, separated by commas',
		displayOptions: { show: sendOps },
	},
	{
		displayName: 'Subject',
		name: 'subject',
		type: 'string',
		default: '',
		displayOptions: { show: sendOps },
	},
	{
		displayName: 'HTML',
		name: 'html',
		type: 'string',
		typeOptions: { rows: 6 },
		default: '',
		displayOptions: { show: sendOps },
	},
	{
		displayName: 'Text',
		name: 'text',
		type: 'string',
		typeOptions: { rows: 4 },
		default: '',
		description: 'Plain-text version of the email',
		displayOptions: { show: sendOps },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: sendOps },
		options: [
			{
				displayName: 'Attachments',
				name: 'attachments',
				type: 'string',
				default: 'data',
				description: 'Names of the binary properties to attach, separated by commas',
			},
			{
				displayName: 'BCC',
				name: 'bcc',
				type: 'string',
				default: '',
				description: 'Addresses separated by commas',
			},
			{
				displayName: 'CC',
				name: 'cc',
				type: 'string',
				default: '',
				description: 'Addresses separated by commas',
			},
			{
				displayName: 'Headers',
				name: 'headers',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				default: {},
				options: [
					{
						displayName: 'Header',
						name: 'header',
						values: [
							{ displayName: 'Name', name: 'name', type: 'string', default: '' },
							{ displayName: 'Value', name: 'value', type: 'string', default: '' },
						],
					},
				],
			},
			{
				displayName: 'Idempotency Key',
				name: 'idempotencyKey',
				type: 'string',
				default: '',
				description:
					'Key that stops a retried request from sending twice. Defaults to the execution ID and item index.',
			},
			{
				displayName: 'Reply To',
				name: 'replyTo',
				type: 'string',
				default: '',
				description: 'Addresses separated by commas',
			},
			{
				displayName: 'Scheduled At',
				name: 'scheduledAt',
				type: 'dateTime',
				default: '',
				description: 'Send the email at this time instead of now',
			},
			{
				displayName: 'Tags',
				name: 'tags',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				default: {},
				options: [
					{
						displayName: 'Tag',
						name: 'tag',
						values: [
							{ displayName: 'Name', name: 'name', type: 'string', default: '' },
							{ displayName: 'Value', name: 'value', type: 'string', default: '' },
						],
					},
				],
			},
			{
				displayName: 'Template ID',
				name: 'templateId',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Template Variables',
				name: 'templateVariables',
				type: 'json',
				default: '{}',
			},
			{
				displayName: 'Type',
				name: 'type',
				type: 'options',
				options: [
					{ name: 'Transactional', value: 'transactional' },
					{ name: 'Marketing', value: 'marketing' },
				],
				default: 'transactional',
			},
		],
	},
];

function idField(resource: string, operations: string[], displayName: string): INodeProperties {
	return {
		displayName,
		name: 'id',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: [resource], operation: operations } },
	};
}

function listFields(resource: string): INodeProperties[] {
	return [
		{
			displayName: 'Return All',
			name: 'returnAll',
			type: 'boolean',
			default: false,
			description: 'Whether to return all results or only up to a given limit',
			displayOptions: { show: { resource: [resource], operation: ['getAll'] } },
		},
		{
			displayName: 'Limit',
			name: 'limit',
			type: 'number',
			typeOptions: { minValue: 1 },
			default: 50,
			description: 'Max number of results to return',
			displayOptions: { show: { resource: [resource], operation: ['getAll'], returnAll: [false] } },
		},
	];
}

export const fieldProperties: INodeProperties[] = [
	...sendFields,

	idField('email', ['get', 'cancel', 'getEvents'], 'Email ID'),
	...listFields('email'),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['email'], operation: ['getAll'] } },
		options: [
			{ displayName: 'Created After', name: 'from', type: 'dateTime', default: '' },
			{ displayName: 'Created Before', name: 'to', type: 'dateTime', default: '' },
			{ displayName: 'Recipient', name: 'recipient', type: 'string', default: '' },
			{ displayName: 'Recipient Domain', name: 'domain', type: 'string', default: '' },
			{ displayName: 'Search', name: 'q', type: 'string', default: '' },
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				default: 'delivered',
				options: [
					{ name: 'Bounced', value: 'bounced' },
					{ name: 'Canceled', value: 'canceled' },
					{ name: 'Complained', value: 'complained' },
					{ name: 'Delivered', value: 'delivered' },
					{ name: 'Failed', value: 'failed' },
					{ name: 'Held', value: 'held' },
					{ name: 'Queued', value: 'queued' },
					{ name: 'Sending', value: 'sending' },
					{ name: 'Sent', value: 'sent' },
				],
			},
			{ displayName: 'Tag', name: 'tag', type: 'string', default: '' },
			{
				displayName: 'Type',
				name: 'type',
				type: 'options',
				default: 'transactional',
				options: [
					{ name: 'Transactional', value: 'transactional' },
					{ name: 'Marketing', value: 'marketing' },
				],
			},
		],
	},

	idField('receivedEmail', ['get', 'getAttachments'], 'Received Email ID'),
	...listFields('receivedEmail'),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['receivedEmail'], operation: ['getAll'] } },
		options: [
			{ displayName: 'Domain', name: 'domain', type: 'string', default: '' },
			{
				displayName: 'Has Attachments',
				name: 'has_attachments',
				type: 'boolean',
				default: false,
				description: 'Whether to return only emails with attachments',
			},
			{ displayName: 'Search', name: 'q', type: 'string', default: '' },
			{
				displayName: 'Spam Only',
				name: 'spam',
				type: 'boolean',
				default: false,
				description: 'Whether to return only emails marked as spam',
			},
		],
	},

	idField('domain', ['get'], 'Domain ID'),
	idField('template', ['get'], 'Template ID'),

	{
		displayName: 'Email',
		name: 'email',
		type: 'string',
		placeholder: 'name@email.com',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['suppression'], operation: ['create'] } },
	},
	idField('suppression', ['delete'], 'Suppression ID'),
	...listFields('suppression'),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['suppression'], operation: ['getAll'] } },
		options: [
			{
				displayName: 'Email',
				name: 'email',
				type: 'string',
				placeholder: 'name@email.com',
				default: '',
			},
		],
	},
];
