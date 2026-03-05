'use strict';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { container } from 'tsyringe';
import { createParser, EventSourceMessage } from 'eventsource-parser';
import { wrap } from '@mikro-orm/core';

import { CApplication, ImplementationContractOutlet } from '@wherejuly/imagetron-backend-contract';

import application from '@tests/foundation/.ancillary/bootstrap/application.js';
import database from '@tests/foundation/.ancillary/bootstrap/database.js';

import ConfigVO from '@src/ddriven/application/configuration/Config.valueobject.js';
import { ImageGenerationPromptFactory } from '@src/database/seeding/ImageGenerationPrompt.factory.js';
import { APPLICATION_EVENT_BUS } from '@src/ddriven/application/abstractions/events.types.js';
import { GoAPITaskProcessedEventVO } from '@wherejuly/imagetron-shared';

const config = container.resolve(ConfigVO).get();

const { orm, em } = await database();
const { server } = await application(orm);

const contract = container.resolve(ImplementationContractOutlet);
const { verb, route } = contract.sse;

let serverBaseURL: string;
let response: Response;

describe('[integration] SSEHTTPAdapterTest', () => {

    // INFO: Arrange server and response once
    beforeAll(async () => {
        // Start Fastify normally
        await server.listen({ port: 0 }); // Bind to a random available port
        const address = server.server.address();
        if (typeof address !== 'object' || !address) throw new Error('Server not listening');
        const port = address.port;
        serverBaseURL = `http://localhost:${port}`;

        // NB: Connect to the endpoint
        const apiKey = config.imagetron.api_key;
        response = await fetch(`${serverBaseURL}${route}?token=${apiKey}`, {
            method: verb
        });

        // Check all is fine
        expect(response.status).toEqual(200);
        expect(response.body).not.toBeNull();
    });

    afterAll(async () => {
        await orm.close(true);
        await server.close();
    });

    it('GET /application/sse: Should connect to the SSE endpoint and trigger the expected event', async () => {
        const bus = container.resolve(APPLICATION_EVENT_BUS);

        // IMPORTANT: --- test the SSE endpoint is connected
        // INFO: Act

        const reader = response.body!.getReader();

        // INFO: Assert
        const { value: connected } = await reader.read() as { value: ArrayBuffer; }; // Read the first chunk
        expect(new TextDecoder().decode(connected)).toContain('data: Connected');

        // IMPORTANT: --- test the SSE triggered & its payload

        // INFO: Arrange
        // NB: Prepare the event
        const fixture = wrap(new ImageGenerationPromptFactory(em).makeEntity()).toJSON() as CApplication.GoAPITaskProcessedEvent['payload']['prompt'];
        const expected = new GoAPITaskProcessedEventVO(bus, 1, fixture);

        // NB: Prepare the sse parser that asserts actual values
        function parseSSE(event: EventSourceMessage) {
            const actual = JSON.parse(event.data) as GoAPITaskProcessedEventVO;

            expect(actual.identity).toEqual(expected.identity);
            expect(actual.payload).toEqual(expected.payload);
        }

        const parser = createParser({ onEvent: parseSSE });

        // INFO: Act
        await expected.emit();

        // INFO: Assert
        const { value: event } = await reader.read() as { value: ArrayBuffer; }; // Read the first chunk
        parser.feed(new TextDecoder().decode(event));

        parser.reset();
        await reader.cancel(); // Close the connection
        await server.close(); // End the test
    });

});

