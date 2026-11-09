import {
	NodeApiError,
	NodeOperationError,
	type IDataObject,
	type IExecuteFunctions,
	type IHookFunctions,
	type IHttpRequestMethods,
	type IHttpRequestOptions,
	type ILoadOptionsFunctions,
	type IWebhookFunctions,
	type JsonObject,
} from 'n8n-workflow';

type Context = IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions | IWebhookFunctions;

const DEFAULT_BASE_URL = 'https://api.mailfully.com';
const PAGE_SIZE = 100;

// Pull Mailfully's `{ error: { type, message, param } }` envelope out of a
// failed request so n8n shows the API's own words.
function errorEnvelope(error: unknown): { type?: string; message?: string; param?: string } {
	const candidates = [
		(error as IDataObject)?.response,
		(error as IDataObject)?.cause,
		((error as IDataObject)?.cause as IDataObject)?.response,
	] as IDataObject[];
	for (const source of candidates) {
		const raw = source?.body ?? source?.data;
		const parsed = typeof raw === 'string' ? safeParse(raw) : raw;
		const envelope = (parsed as IDataObject)?.error as IDataObject | undefined;
		if (envelope && typeof envelope.message === 'string') {
			return {
				type: typeof envelope.type === 'string' ? envelope.type : undefined,
				message: envelope.message,
				param: typeof envelope.param === 'string' ? envelope.param : undefined,
			};
		}
	}
	return {};
}

function safeParse(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		return undefined;
	}
}

// Errors from mailfullyApiRequest are already NodeApiErrors; anything else is
// wrapped so n8n shows it with the node's context.
export function asNodeError(
	node: ReturnType<Context['getNode']>,
	error: unknown,
	itemIndex?: number,
): NodeApiError | NodeOperationError {
	if (error instanceof NodeApiError || error instanceof NodeOperationError) return error;
	return new NodeOperationError(node, error as Error, { itemIndex });
}

export async function mailfullyApiRequest(
	this: Context,
	method: IHttpRequestMethods,
	path: string,
	options: { body?: IDataObject | IDataObject[]; qs?: IDataObject; headers?: IDataObject } = {},
	itemIndex?: number,
): Promise<IDataObject> {
	const credentials = await this.getCredentials('mailfullyApi');
	const baseUrl = String(credentials.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');

	const request: IHttpRequestOptions = {
		method,
		url: `${baseUrl}${path}`,
		json: true,
		headers: { Accept: 'application/json', ...options.headers },
	};
	if (options.body !== undefined) request.body = options.body;
	if (options.qs && Object.keys(options.qs).length > 0) request.qs = options.qs;

	try {
		return (await this.helpers.httpRequestWithAuthentication.call(
			this,
			'mailfullyApi',
			request,
		)) as IDataObject;
	} catch (error) {
		const envelope = errorEnvelope(error);
		throw new NodeApiError(this.getNode(), error as JsonObject, {
			itemIndex,
			message: envelope.message
				? envelope.type
					? `${envelope.type}: ${envelope.message}`
					: envelope.message
				: undefined,
			description: envelope.param ? `Field: ${envelope.param}` : undefined,
		});
	}
}

// Walks a Mailfully list endpoint. Most lists continue with `cursor`; the
// received-mail list continues with `after`. Both return `next_cursor`.
export async function mailfullyApiRequestAllItems(
	this: IExecuteFunctions,
	path: string,
	options: { qs?: IDataObject; cursorParam?: 'cursor' | 'after'; limit?: number },
	itemIndex: number,
): Promise<IDataObject[]> {
	const results: IDataObject[] = [];
	const cursorParam = options.cursorParam ?? 'cursor';
	let cursor: string | undefined;

	do {
		const remaining = options.limit === undefined ? PAGE_SIZE : options.limit - results.length;
		const qs: IDataObject = { ...options.qs, limit: Math.min(PAGE_SIZE, remaining) };
		if (cursor) qs[cursorParam] = cursor;

		const page = await mailfullyApiRequest.call(this, 'GET', path, { qs }, itemIndex);
		results.push(...((page.data as IDataObject[] | undefined) ?? []));

		cursor =
			page.has_more === true && typeof page.next_cursor === 'string' ? page.next_cursor : undefined;
	} while (cursor && (options.limit === undefined || results.length < options.limit));

	return options.limit === undefined ? results : results.slice(0, options.limit);
}
