'use strict';

import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import fixtures from '@fixtures/index.js';

import { InjectOptions } from 'fastify';
import { v4 } from 'uuid';
import { container } from 'tsyringe';

import application from '@tests/foundation/.ancillary/bootstrap/application.js';
import database from '@tests/foundation/.ancillary/bootstrap/database.js';

import { CGoAPI, CImages, ConsumerContractOutlet, ImplementationContractOutlet } from '@wherejuly/imagetron-backend-contract';
import { ApplicationEventBus, TEvents } from '@wherejuly/imagetron-shared';

import ConfigVO from '@src/ddriven/application/configuration/Config.valueobject.js';
import { APPLICATION_EVENT_BUS } from '@src/ddriven/application/abstractions/events.types.js';
import { GoAPITaskReturnedEventVO } from '@src/ddriven/application/events/GoAPITaskReturnedEvent.valueobject.js';

const config = container.resolve(ConfigVO).get();

const { orm } = await database();
const { server } = await application(orm);

const contract = container.resolve(ImplementationContractOutlet);
const consumerContract = new ConsumerContractOutlet();

describe('[integration] VariationsWebhookHTTPAdapterTest', () => {

    beforeEach(() => {
        // NB: Register new instance of the bus clean form the actual event handler registered
        // by the application to avoid triggering the actual event handler.
        container.registerInstance(APPLICATION_EVENT_BUS, new ApplicationEventBus());
    });

    afterEach(() => {
        container.clearInstances();
    });

    afterAll(async () => {
        await orm.close(true);
        await server.close();
    });

    describe('[200] POST /webhooks/images/goapi/prompt/{uuid}/midjourney/variations', () => {

        it(`Should pass both authorizations successfully`, async () => {
            const { verb, route } = consumerContract.actualFor(contract.webhookHandleMidjourneyCommandTaskResults, { uuid: v4(), command: CImages.EMidjourneyCommands.Variations });

            const expected = fixtures.goapi.webhook_request_payloadFn(false, undefined, undefined, route, config.imagetron.api_key);
            expected.data.task_type = CGoAPI.ETaskType.Variation;

            const response = await server.inject({
                method: verb,
                url: route,
                body: expected
            } as InjectOptions);

            expect(response.statusCode).toEqual(200);
        });

        it(`Should pass the expected GoAPITaskReturnedEventVO over the event bus successfully`, async () => {
            const { verb, route } = consumerContract.actualFor(
                contract.webhookHandleMidjourneyCommandTaskResults,
                { uuid: v4(), command: CImages.EMidjourneyCommands.Variations }
            );
            const bus = container.resolve(APPLICATION_EVENT_BUS);
            const expected = fixtures.goapi.webhook_request_payloadFn(false, undefined, undefined, route, config.imagetron.api_key);

            const eventPromise = new Promise<GoAPITaskReturnedEventVO>((resolve, reject) => {
                bus.once(GoAPITaskReturnedEventVO.identity)
                    .then((event: TEvents[keyof TEvents]) => { resolve(event as GoAPITaskReturnedEventVO); })
                    .catch((err) => reject(new Error(`${err}`)));
            });

            const response = await server.inject({
                method: verb,
                url: route,
                body: expected
            } as InjectOptions);

            expect(response.statusCode).toEqual(200);

            const actual = await eventPromise;

            expect(actual).toBeDefined();
            expect(actual).toBeInstanceOf(GoAPITaskReturnedEventVO);
            expect(actual.command).toEqual(CImages.EMidjourneyCommands.Variations);

            const { timestamp, ...expectedWithoutTimestamp } = expected;
            expect(actual.payload).toMatchObject(expectedWithoutTimestamp);
        });

    });

});
