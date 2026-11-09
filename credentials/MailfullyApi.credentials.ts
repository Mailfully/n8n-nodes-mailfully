import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class MailfullyApi implements ICredentialType {
	name = 'mailfullyApi';

	displayName = 'Mailfully API';

	icon: Icon = { light: 'file:../icons/mailfully.svg', dark: 'file:../icons/mailfully.svg' };

	documentationUrl =
		'https://github.com/Mailfully/n8n-nodes-mailfully?tab=readme-ov-file#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			placeholder: 'mf_live_...',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'hidden',
			default: 'https://api.mailfully.com',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/v1/domains',
			method: 'GET',
		},
	};
}
