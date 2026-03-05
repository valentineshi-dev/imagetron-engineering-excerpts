'use strict';

import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import fixtures from '@fixtures/index.js';

import { wrap } from '@mikro-orm/core';
import { v4 } from 'uuid';
import { container } from 'tsyringe';
import nock from 'nock';

import database from '@tests/foundation/.ancillary/bootstrap/database.js';
import application from '@tests/foundation/.ancillary/bootstrap/application.js';

import MidjourneyImagineCommandService from '@src/ddriven/domain/images/services/commands/MidjourneyImagineCommand.service.js';
import { ImageGenerationPromptFactory } from '@src/database/seeding/ImageGenerationPrompt.factory.js';
import { ImageGenerationPromptEO } from '@src/database/schema/ImageGenerationPrompt.schema.js';
import { EDomainErrorCodes, ImagetronException } from '@wherejuly/imagetron-shared';
import { CGoAPI, CImages, CPrompts } from '@wherejuly/imagetron-backend-contract';
import { MidjourneyTaskConditionsFactory } from '@src/database/seeding/MidjourneyTaskConditions.factory.js';
import ConfigVO from '@src/ddriven/application/configuration/Config.valueobject.js';
import GoAPIErrorVO from '@src/ddriven/ports/adapters/outgoing/http/goapi/GoAPIError.valueobject.js';

const { orm, em } = await database();
const { server } = await application(orm);

let promptsFixture: ImageGenerationPromptEO[] = [];

const config = container.resolve(ConfigVO).get('apis');

const base = config.goapi.base_url;
const path = '/api/v1/task';
const nockServer = nock(base);

describe('[integration] MidjourneyImagineCommandServiceTest', () => {

    beforeEach(async () => {
        await orm.schema.refreshDatabase();

        promptsFixture = await (new ImageGenerationPromptFactory(em)).create(5);

        em.clear();
    });

    afterAll(async () => {
        await orm.close(true);
        await server.close();
    });

    it('+constructor(): Should create MidjourneyImagineCommandService expected object', () => {
        const actual = new MidjourneyImagineCommandService(em);

        expect(actual).toBeInstanceOf(MidjourneyImagineCommandService);

        expect(actual.imagine).toBeInstanceOf(Function);
    });

    // WRITE: Gradually write the method constructing the underlying functionality
    // WARNING: Skip if throws false negatives.
    it('+imagine() #1: Should return ImageGenerationPromptEO expected object', async () => {
        const expected = fixtures.goapi.status_pending_response;
        nockServer.post(path).reply(200, expected);
        await new MidjourneyTaskConditionsFactory(em).createOne();
        const prompt = wrap(promptsFixture[2]!).toJSON(); // NB: Take one of seeded prompts
        const service = new MidjourneyImagineCommandService(em);

        const actual = await service.imagine(prompt.uuid!);

        // WRITE: Check the actual instance and content of the object is as expected
        expect(actual).toBeInstanceOf(ImageGenerationPromptEO);

        expect(actual.mode).toEqual(CImages.EMidjourneyImageGenerationMode.Fast);
        expect(actual.status).toEqual(CPrompts.EImageGenerationPromptStatus.GenerationAwait);
        expect(actual.midjourney_commands.latest).toEqual(CImages.EMidjourneyLatestCommands.Imagine);
        expect(actual.midjourney_commands.allowed_root).toEqual(CImages.EMidjourneyRootCommands.Reroll);
    });

    it('+imagine() #2: Should make the respective changes in the DB', async () => {
        const fixture = fixtures.goapi.status_pending_response;
        nockServer.post(path).reply(200, fixture);
        await new MidjourneyTaskConditionsFactory(em).createOne();
        const expected = wrap(promptsFixture[2]!).toJSON(); // NB: Take one of seeded prompts
        const service = new MidjourneyImagineCommandService(em);

        em.clear();

        // REFACTOR: Suggest to remove redundant `warp` and hence entire `db`.
        const db = async () => {
            const prompt = await em.findOne(ImageGenerationPromptEO, { uuid: expected.uuid }, { populate: ['*'] });
            return wrap(prompt!).toJSON();
        };

        const actual = {
            prompt: await service.imagine(expected.uuid!),
            db: await db()
        };

        expect(actual.prompt).toBeInstanceOf(ImageGenerationPromptEO);
        expect(actual.prompt.uuid).toEqual(expected.uuid);
        expect(actual.prompt.mode).toEqual(CImages.EMidjourneyImageGenerationMode.Fast);
        expect(actual.prompt.status).toEqual(CPrompts.EImageGenerationPromptStatus.GenerationAwait);
        expect(actual.prompt.tasks).toHaveLength(1);
        expect(actual.prompt.tasks[0]?.command).toEqual(CGoAPI.ETaskType.Imagine);
        expect(actual.prompt.tasks[0]?.status).toEqual(CGoAPI.ETaskResultStatus.Pending);

        expect(actual.db.uuid).toEqual(actual.prompt.uuid);
        expect(actual.db.mode).toEqual(actual.prompt.mode);
        expect(actual.db.status).toEqual(actual.prompt.status);
        expect(actual.db.tasks).toHaveLength(1);
        expect(actual.db.tasks[0]?.command).toEqual(CGoAPI.ETaskType.Imagine);
        expect(actual.db.tasks[0]?.status).toEqual(CGoAPI.ETaskResultStatus.Pending);
    });

    describe('+imagine() #3: Should throw expected prompt errors (409)', () => {

        it.each(dataProvider_imagine_prompt_errors())('Case #%# $name:', async (data) => {
            em.clear();
            const expected = await data.prepare();
            const service = new MidjourneyImagineCommandService(em);

            // NB: This is the correct way to call it once but check result multiple times
            const actual_ = async () => { await service.imagine(expected.uuid!); };
            const actual = actual_();

            await expect(actual).rejects.toThrowError(ImagetronException);
            await expect(actual).rejects.toThrowError(data.message);
        });

        function dataProvider_imagine_prompt_errors() {
            const config = container.resolve(ConfigVO).get('domain').midjourney;
            const uuid = v4();
            const notFound = () => { return new ImageGenerationPromptFactory(em).makeEntity({ uuid }); };
            const invalidStatus = async () => {
                return await new ImageGenerationPromptFactory(em).createOne({ uuid: v4(), status: CPrompts.EImageGenerationPromptStatus.GenerationAwait });
            };
            const imagineNotAllowed = async () => {
                return await new ImageGenerationPromptFactory(em).createOne({ uuid: v4(), midjourney_commands: { latest: CImages.EMidjourneyLatestCommands.Reroll, allowed_root: CImages.EMidjourneyRootCommands.None } });
            };
            const taskQueueIsFull = async () => {
                await new MidjourneyTaskConditionsFactory(em).createOne({ active_tasks_counter: config.maximum_active_tasks });
                return await new ImageGenerationPromptFactory(em).createOne({ uuid: v4() });
            };
            return [
                { name: '404', prepare: notFound, message: `Prompt with UUID ${uuid} not found` },
                { name: '409 Invalid prompt status', prepare: invalidStatus, message: `invalid status transition attempt: "generation:await->generation:await"` },
                { name: '409 Command not allowed', prepare: imagineNotAllowed, message: 'command is not allowed: "imagine"' },
                { name: '409 Task queue is full', prepare: taskQueueIsFull, message: 'Wait a little for a queue to drain' },
            ];
        }
    });

    describe('+imagine() #4: Should throw expected GoAPI errors (424: [400, 401, 500])', () => {

        it.each(dataProvider_imagine_goapi_errors())('Case #%# $name:', async (data) => {
            // WRITE: Make 3 responses with nock on a test GoAPI server
            nockServer.post(path).reply(data.code, { data: data.payload });

            await new MidjourneyTaskConditionsFactory(em).createOne();
            const prompt = wrap(promptsFixture[2]!).toJSON(); // NB: Take one of seeded prompts
            const service = new MidjourneyImagineCommandService(em);

            // NB: This is the correct way to call it once but check result multiple times
            const actual_ = async () => { await service.imagine(prompt.uuid!); };
            const actual = actual_();

            try {
                await actual;
                expect.fail('The test was expected to catch an error, but no error was thrown.');
            } catch (error) {
                const actual = error as ImagetronException;

                expect(actual).toBeInstanceOf(ImagetronException);
                expect(actual.code).toEqual(EDomainErrorCodes.GOAPI_UNEXPECTED_FAILURE);
                expect(actual.metadata).toBeInstanceOf(GoAPIErrorVO);
                expect((actual.metadata as GoAPIErrorVO).goapi_http_code).toEqual(data.code);
                expect((actual.metadata as GoAPIErrorVO).goapi_error).toEqual(data.payload.error);
            }
        });

        // WARNING: These are all assumed errors. Maybe will have to revise the test upon actual GoAPI interactions. 
        function dataProvider_imagine_goapi_errors() {
            return [
                { name: '400', code: 400, payload: { error: { message: 'GoAPI mocked bad request message' } } },
                { name: '401', code: 401, payload: { error: { message: 'GoAPI mocked unauthorized message' } } },
                { name: '500', code: 500, payload: { error: { message: 'GoAPI mocked 500 message' } } },
            ];
        }

        it('Should throw for formally success http status (200) with "response.data.status==failure"', async () => {
            const expected = fixtures.goapi.status_failure_response;
            nockServer.post(path).reply(200, expected);

            await new MidjourneyTaskConditionsFactory(em).createOne();
            const prompt = wrap(promptsFixture[2]!).toJSON(); // NB: Take one of seeded prompts
            const service = new MidjourneyImagineCommandService(em);

            // NB: This is the correct way to call it once but check result multiple times
            const actual_ = async () => { await service.imagine(prompt.uuid!); };
            const actual = actual_();

            try {
                await actual;
                expect.fail('The test was expected to catch an error, but no error was thrown.');
            } catch (error) {
                const actual = error as ImagetronException;

                expect(actual).toBeInstanceOf(ImagetronException);
                expect(actual.code).toEqual(EDomainErrorCodes.GOAPI_TASK_FAILURE);
                // WRITE: Add actual metadata test after defining its structure based on actual GoAPI response.
            }
        });

    });


});
