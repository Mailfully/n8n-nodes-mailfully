# n8n-nodes-mailfully

This is an n8n community node for [Mailfully](https://mailfully.com), a transactional email API. You can use it to send email from a workflow, read sent and received mail, manage suppressions, and start a workflow when an email is delivered, bounced, opened, clicked or received.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

- [Installation](#installation)
- [Credentials](#credentials)
- [Operations](#operations)
- [Trigger](#trigger)
- [Compatibility](#compatibility)
- [Resources](#resources)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation and install `n8n-nodes-mailfully`.

## Credentials

1. Sign in to the [Mailfully dashboard](https://dashboard.mailfully.com) and create an API key.
2. In n8n, create a **Mailfully API** credential and paste the key.

A key that starts with `mf_test_` sends in test mode: the full send path runs, but no mail reaches a real inbox and nothing is billed. Use an `mf_live_` key to send real mail.

The trigger needs a key that can manage webhooks. Keys created by `mailfully login --web` can't, so create one in the dashboard.

## Operations

| Resource | Operations |
|---|---|
| Email | Send, Send Batch, Get, Get Many, Get Events, Cancel |
| Received Email | Get, Get Many, Get Attachments |
| Domain | Get, Get Many |
| Template | Get, Get Many |
| Suppression | Create, Delete, Get Many |

**Send** sends one email per input item. **Send Batch** sends the same emails in requests of up to 100 items. If the API refuses a batch, it refuses the whole request, so every item in it fails together.

The From address must be on a domain you have verified in Mailfully. To, CC, BCC and Reply To take addresses separated by commas.

To attach files, put the names of the item's binary properties in **Attachments**, separated by commas (for example `data, invoice`).

Each send carries an idempotency key, built from the workflow, execution, node and item, so if n8n retries a failed step, the email isn't sent twice. A custom **Idempotency Key** must be different for every item, for example `{{ $json.orderId }}`. Mailfully remembers keys for 24 hours.

**Get Attachments** downloads each attachment of a received email as a binary property, named `attachment_0`, `attachment_1` and so on.

## Trigger

**Mailfully Trigger** starts a workflow when one of the selected events happens:

`email.delivered`, `email.bounced`, `email.complained`, `email.failed`, `email.delivery_delayed`, `email.opened`, `email.clicked`, `email.suppressed`, `email.unsubscribed`, `email.received`

When you activate the workflow, the node registers a webhook in Mailfully, and it removes the webhook when you deactivate it. Every delivery is checked against its signature, and a request with a bad or old signature is refused.

Mailfully only delivers webhooks to public addresses, so the trigger doesn't work with n8n running on `localhost`. Use n8n Cloud, a public server, or a tunnel (for example `n8n start --tunnel`).

Turn on **Download Attachments** to get the attachments of received emails as binary data.

## Compatibility

Built with `@n8n/node-cli` 0.55.6 against `n8n-workflow` 2.46.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Mailfully API documentation](https://mailfully.com/docs)
- [Mailfully MCP server](https://mailfully.com/docs/sdks/mcp), which also works with n8n's MCP Client Tool

## License

[MIT](LICENSE.md)
