'use strict';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { container } from 'tsyringe';
import { EventSource } from 'eventsource';
import { wrap } from '@mikro-orm/core';

import { CApplication, ImplementationContractOutlet } from '@wherejuly/imagetron-backend-contract';

import application from '@tests/foundation/.ancillary/bootstrap/application.js';
import database from '@tests/foundation/.ancillary/bootstrap/database.js';

import ConfigVO from '@src/ddriven/application/configuration/Config.valueobject.js';
import { ImageGenerationPromptFactory } from '@src/database/seeding/ImageGenerationPrompt.factory.js';
import { GoAPITaskProcessedEventVO } from '@wherejuly/imagetron-shared';
import { APPLICATION_EVENT_BUS } from '@src/ddriven/application/abstractions/events.types.js';

const config = container.resolve(ConfigVO).get();

const { orm, em } = await database();
const { server } = await application(orm);

const contract = container.resolve(ImplementationContractOutlet);

let serverBaseURL: string;

describe('[integration] SSEFrontendMockTest', () => {

    // INFO: Arrange server and response once
    beforeAll(async () => {
        // Start Fastify normally
        await server.listen({ port: 0 }); // Bind to a random available port
        const address = server.server.address();
        if (typeof address !== 'object' || !address) throw new Error('Server not listening');
        const port = address.port;
        serverBaseURL = `http://localhost:${port}`;
    });

    afterAll(async () => {
        await orm.close(true);
    });

    it('GET /application/sse: Should connect to the SSE endpoint as frontend and receive desired event', async () => {
        const bus = container.resolve(APPLICATION_EVENT_BUS);
        const { route } = contract.sse;

        // Simulate the EventSource client connection
        const apiKey = config.imagetron.api_key;
        const es = new EventSource(`${serverBaseURL}${route}?token=${apiKey}`);

        es.onerror = (error) => {
            console.error('EventSource failed:', error);
            throw new Error('EventSource error');
        };

        es.addEventListener('connected', (event) => {
            expect(event.data).toEqual('Connected');
        });

        es.addEventListener('application', (event) => {
            const data = JSON.parse(event.data as string) as GoAPITaskProcessedEventVO;
            expect(data.identity).toBe('goapi.task.processed');
            expect(data.payload.active_generation_tasks_counter).toBe(1);

            // End test after receiving expected data
            es.close();
        });

        // Add a timeout to avoid hanging indefinitely
        await new Promise((resolve, reject) => {
            setTimeout(() => {
                console.log('closing after 3 seconds of no events...');
                reject(new Error('Test timed out'));
            }, 3000); // 3-second timeout

            es.onopen = () => { resolve(true); }; // Call resolve when connection is opened
        });


        // INFO: Arrange
        // NB: Prepare the event
        const fixture = wrap(new ImageGenerationPromptFactory(em).makeEntity()).toJSON() as CApplication.GoAPITaskProcessedEvent['payload']['prompt'];
        const expected = new GoAPITaskProcessedEventVO(bus, 1, fixture);

        // INFO: Act
        await expected.emit();

        await server.close(); // Ensure Fastify is closed at the end
    });

});

