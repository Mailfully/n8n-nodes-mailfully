import type {
	IBinaryKeyData,
	IDataObject,
	IExecuteFunctions,
	IWebhookFunctions,
} from 'n8n-workflow';

// Download URLs are short-lived signed links, so they are fetched without the
// Mailfully API key. Attachments with no stored file have a null URL and are
// listed in the JSON but get no binary property.
export async function downloadAttachments(
	this: IExecuteFunctions | IWebhookFunctions,
	attachments: IDataObject[],
): Promise<IBinaryKeyData> {
	const binary: IBinaryKeyData = {};
	for (const [index, attachment] of attachments.entries()) {
		const url = attachment.download_url;
		if (typeof url !== 'string' || url === '') continue;

		const content = (await this.helpers.httpRequest({
			method: 'GET',
			url,
			encoding: 'arraybuffer',
			json: false,
		})) as ArrayBuffer;

		binary[`attachment_${index}`] = await this.helpers.prepareBinaryData(
			Buffer.from(content),
			typeof attachment.filename === 'string' ? attachment.filename : undefined,
			typeof attachment.content_type === 'string' ? attachment.content_type : undefined,
		);
	}
	return binary;
}
