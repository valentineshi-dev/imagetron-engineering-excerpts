'use strict';

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import nock from 'nock';
import { container } from 'tsyringe';
import * as Sentry from "@sentry/node";

import fixtures from '@fixtures/index.js';
import { BASE, provideImageMock, VARIATIONS } from '@tests/foundation/.ancillary/helpers/provideImageMock.js';
import { seedMockPromptWithTask } from '@tests/foundation/.ancillary/helpers/helpers.js';

import database from '@tests/foundation/.ancillary/bootstrap/database.js';
import application from '@tests/foundation/.ancillary/bootstrap/application.js';

import MidjourneyImagineResultsService from '@src/ddriven/domain/images/services/results/MidjourneyImagineResults.service.js';
import { ImageGenerationPromptFactory } from '@src/database/seeding/ImageGenerationPrompt.factory.js';
import { ImageGenerationPromptEO } from '@src/database/schema/ImageGenerationPrompt.schema.js';
import { CGoAPI, CImages, CPrompts } from '@wherejuly/imagetron-backend-contract';
import { GoAPITaskReturnedEventVO } from '@src/ddriven/application/events/GoAPITaskReturnedEvent.valueobject.js';
import { MidjourneyTaskConditionsFactory } from '@src/database/seeding/MidjourneyTaskConditions.factory.js';
import { MidjourneyTaskConditionsEO } from '@src/database/schema/MidjourneyTaskConditions.schema.js';
import { MidjourneyImageEO } from '@src/database/schema/MidjourneyImage.schema.js';
import { APPLICATION_EVENT_BUS } from '@src/ddriven/application/abstractions/events.types.js';
import S3Adapter from '@src/ddriven/ports/adapters/outgoing/s3/S3.adapter.js';
import { GoAPITaskProcessedEventVO } from '@wherejuly/imagetron-shared';

const { orm, em } = await database();
const { server } = await application(orm);

const nockServer = nock(BASE);
const contentType = { 'Content-Type': 'image/jpeg' };

describe('[integration] MidjourneyImagineResultsServiceTest', () => {

    beforeEach(async () => {
        await orm.schema.refreshDatabase();

        await new MidjourneyTaskConditionsFactory(em).createOne();
        await new ImageGenerationPromptFactory(em).create(5);

        em.clear();

        // NB: Arrange
        // Mock endpoints matching the images in webhook request payload mock to use by SUT. 
        VARIATIONS.forEach((imageName: string) => {
            const imageFixture = () => { return provideImageMock(imageName); };
            nockServer.get(`/${imageName}`).reply(200, imageFixture, contentType);
        });
    });

    afterEach(async () => {
        nock.cleanAll();
        container.clearInstances();

        // NB: This is only for seeing errors in tests
        await Sentry.flush();
    });

    afterAll(async () => {
        await orm.close(true);
        await server.close();
    });

    it('+constructor(): Should create MidjourneyImagineResultsService expected object', () => {
        const actual = new MidjourneyImagineResultsService(em);

        expect(actual).toBeInstanceOf(MidjourneyImagineResultsService);

        expect(actual.run).toBeInstanceOf(Function);
    });


    // REFACTOR: In future to use PromptMockSeeder instead of manual seeds, 
    // see MidjourneyRerollResultsService.test.ts as example
    it('+run() #1: Should create MidjourneyImagineResultsService expected object', async () => {
        // INFO: Arrange

        // Mock S3Adapter
        const mockSave = vi.fn().mockResolvedValue({ httpStatusCode: 200 });
        const mockPreSignedURL = vi.fn().mockResolvedValueOnce('https://s3-presigned-url.com');
        container.registerInstance(S3Adapter, { saveAsImageType: mockSave, preSignedURLFor: mockPreSignedURL } as unknown as S3Adapter);

        const prompt = await seedMockPromptWithTask(em);
        // Verify the mock is in place
        const ensured = await em.findOne(ImageGenerationPromptEO, { uuid: prompt.uuid }, { populate: ['*'] });

        // NB: Must be called after prompt has been created
        const conditions = await em.findOne(MidjourneyTaskConditionsEO, { id: 1 });

        expect(conditions).not.toEqual(null);
        expect(conditions!.active_tasks_counter).toEqual(1);
        expect(conditions!.fast_mode_task_counter).toEqual(1);

        expect(ensured).not.toEqual(null);
        expect(ensured!.uuid).toBeDefined();
        expect(ensured!.tasks).toHaveLength(1);

        const expected = {
            prompt_uuid: prompt.uuid!,
            payload: fixtures.goapi.webhook_request_payloadFn(false, ensured!.tasks[0]?.goapi_task_uuid),
        };

        // NB: Catch the actual 'processed' event
        let actualProcessedEvent: GoAPITaskProcessedEventVO | null = null;
        const bus = container.resolve(APPLICATION_EVENT_BUS);
        bus.on(GoAPITaskProcessedEventVO.identity, (event) => {
            actualProcessedEvent = event as GoAPITaskProcessedEventVO;
        });

        // INFO: Act
        const event = new GoAPITaskReturnedEventVO(bus, expected.prompt_uuid, CImages.EMidjourneyCommands.Imagine, expected.payload);

        const service = new MidjourneyImagineResultsService(em);
        await service.run(event);

        // INFO: Assert
        // NB: Check changes are in the DB
        em.clear();

        const actual = {
            prompt: await em.findOne(ImageGenerationPromptEO, { uuid: prompt.uuid }, { populate: ['*'] }),
            images: await em.find(MidjourneyImageEO, { prompt_uuid: prompt.uuid })
        };

        expect(actual.prompt).not.toEqual(null);
        expect(actual.prompt?.status).toEqual(CPrompts.EImageGenerationPromptStatus.HasVariations);
        expect(actual.prompt?.tasks[0]?.status).toEqual(CGoAPI.ETaskResultStatus.Completed);

        expect(actual.images).not.toEqual([]);
        expect(actual.images).toHaveLength(expected.payload.data.output.temporary_image_urls.length);
        expect(actual.images[0]?.is_persisted).toEqual(true);
        expect(actual.images[0]?.error_message).toEqual(null);
        expect(actual.images[0]?.type).toEqual(CImages.EImageType.Variation);
        expect(actual.images[0]?.source_url).toEqual(expected.payload.data.output.temporary_image_urls[0]);
        expect(actual.images[0]?.task_uuid).toEqual(expected.payload.data.task_id);

        // NB: Check the events are fired with expected payload
        expect(actualProcessedEvent).toBeInstanceOf(GoAPITaskProcessedEventVO);
        expect(actualProcessedEvent!.payload.active_generation_tasks_counter).toEqual(0);
        expect(actualProcessedEvent!.payload.prompt.uuid).toEqual(expected.prompt_uuid);
    });

    it('+run() #2: Should emit GoAPITaskProcessedEventVO for GoAPI task failure with "generation:failure" prompt status', async () => {
        // INFO: Arrange

        // Mock S3Adapter
        const mockSave = vi.fn().mockResolvedValue({ httpStatusCode: 200 });
        container.registerInstance(S3Adapter, { saveAsImageType: mockSave } as unknown as S3Adapter);

        // Verify the mock is in place
        const prompt = await seedMockPromptWithTask(em);
        const ensured = await em.findOne(ImageGenerationPromptEO, { uuid: prompt.uuid }, { populate: ['*'] });

        const expected = {
            prompt_uuid: prompt.uuid!,
            payload: fixtures.goapi.webhook_request_payloadFn(false, ensured!.tasks[0]?.goapi_task_uuid, CGoAPI.ETaskResultStatus.Failed),
        };

        // NB: Catch the actual 'processed' event
        let actualProcessedEvent: GoAPITaskProcessedEventVO | null = null;
        const bus = container.resolve(APPLICATION_EVENT_BUS);
        bus.on(GoAPITaskProcessedEventVO.identity, (event) => {
            actualProcessedEvent = event as GoAPITaskProcessedEventVO;
        });

        // INFO: Act
        const event = new GoAPITaskReturnedEventVO(bus, expected.prompt_uuid, CImages.EMidjourneyCommands.Imagine, expected.payload);

        const service = new MidjourneyImagineResultsService(em);
        await service.run(event);

        // NB: Check the events are fired with expected payload
        expect(actualProcessedEvent).toBeInstanceOf(GoAPITaskProcessedEventVO);
        expect(actualProcessedEvent!.payload.active_generation_tasks_counter).toEqual(0);
        expect(actualProcessedEvent!.payload.prompt.uuid).toEqual(expected.prompt_uuid);
        expect(actualProcessedEvent!.payload.prompt.status).toEqual(CPrompts.EImageGenerationPromptStatus.GenerationFailure);
    });

    // WRITE: These errors are caught with Pino & Sentry logging.
    // Implement the tests when the loggers are implemented,
    it.todo('+run() #3: Should log "missing prompt" eror', async () => {
    });

    it.todo('+run() #4: Should log "prompt found but the respective task is not" error', async () => {
    });

    it.todo('+run() #5: Should log "GoAPI task failed" error', async () => {
    });

});
