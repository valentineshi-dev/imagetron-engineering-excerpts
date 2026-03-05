'use strict';

import { FastifyReply, FastifyRequest } from 'fastify';
import { container } from 'tsyringe';
import { Logger } from 'pino';

import { CGoAPI } from '@wherejuly/imagetron-backend-contract';

import { NAPIAuth } from '@src/ddriven/application/abstractions/NAPIAuth.types.js';
import { LOGGER } from '@src/ddriven/application/abstractions/di.types.js';

export type TRequestHeaderAPIKey = { 'x-api-key': string; };
export type TRequestBody = { timestamp: number; data: Partial<CGoAPI.TaskResultData>; };

export default class WebhookAuthorizationMiddleware {

    private logger: Logger;

    constructor() {
        this.run = this.run.bind(this);
        this.logger = container.resolve(LOGGER);
    }

    /**
     * The GoAPI webhook authorization middleware.
     * 
     * Re-write the GoAPI webhook config secret to the `x-api-key` request header for the
     * following validation by the Imagetron {@link APIKeyFastifyMiddleware}.
     * 
     * Extracts the secret and route from the request body's nested configuration
     * {@link CGoAPI.TaskResultData} and performs the following validations:
     * 
     * 1. Checks if the API key is present. If absent, responds with a `401 Unauthorized` status.
     * 2. Verifies that the extracted route matches the request URL.
     *    If there's a mismatch, responds with a `401 Unauthorized (route mismatch)` status.
     * 
     * If both validations pass, the API key is written to `x-api-key` request header.
     */
    public async run(request: FastifyRequest<NAPIAuth.IRouteDescriptor<TRequestHeaderAPIKey, TRequestBody>>, reply: FastifyReply): Promise<NAPIAuth.IRouteDescriptor<TRequestHeaderAPIKey, TRequestBody> | undefined> {
        // NB: There can be absent body or any of the nested parts
        const apiKey = request?.body?.data?.config?.webhook_config?.secret;
        const webhookRoute = request?.body?.data?.config?.webhook_config?.endpoint;

        // WRITE: Structured logging "webhook accessed"
        this.logger.debug({ route: webhookRoute }, 'Webhook Accessed (%s)', webhookRoute);
        // logger.error({ userId }, 'Login failed for user %d: %s', userId, errorDetails);

        if (!apiKey) {
            // WRITE: Structured logging "webhook unauthorized (secret)"
            this.logger.error('Webhook Unauthorized (invalid secret)', { route: webhookRoute });

            return reply.code(401).send({ error: 'Unauthorized' });
        }

        // NB: webhookRoute is full URL whereas `request.url` is just a path. Thus `includes` comparison.
        if (!webhookRoute?.includes(request.url)) {
            // WRITE: Structured logging "webhook unauthorized (route mismatch)"
            this.logger.error('Webhook Unauthorized (route mismatch)', { route: webhookRoute });

            return reply.code(401).send({ error: 'Unauthorized (route mismatch)' });
        }

        request.headers['x-api-key'] = apiKey;
    }

}