import type { APIRoute } from 'astro'
import {
  adminMailWebhookConfiguration,
  readMailWebhookConfiguration,
  saveMailWebhookConfiguration,
} from '../../../../utils/mail-config'
import { adminMailRoute, mailSuccess, readMailJson } from '../../../../utils/mail-api'

export const prerender = false

export const GET: APIRoute = (context) => adminMailRoute(context, async (_context, bindings) => {
  const configuration = await readMailWebhookConfiguration(bindings)
  return mailSuccess(adminMailWebhookConfiguration(configuration))
})

export const PUT: APIRoute = (context) => adminMailRoute(context, async ({ request }, bindings) => {
  const configuration = await saveMailWebhookConfiguration(bindings, await readMailJson(request))
  return mailSuccess(adminMailWebhookConfiguration(configuration))
})
