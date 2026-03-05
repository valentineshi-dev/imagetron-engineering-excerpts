'use strict';

import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import fixtures from '@fixtures/index.js';

import { seedMockPromptWithTask } from '@tests/foundation/.ancillary/helpers/helpers.js';

import { container } from 'tsyringe';
import nock from 'nock';

import database from '@tests/foundation/.ancillary/bootstrap/database.js';
import application from '@tests/foundation/.ancillary/bootstrap/application.js';

import ConfigVO from '@src/ddriven/application/configuration/Config.valueobject.js';
import MidjourneyRerollCommandService from '@src/ddriven/domain/images/services/commands/MidjourneyRerollCommand.service.js';
import { CGoAPI, CImages, CPrompts } from '@wherejuly/imagetron-backend-contract';
import { MidjourneyTaskConditionsEO } from '@src/database/schema/MidjourneyTaskConditions.schema.js';
import { EDomainErrorCodes, ImagetronException } from '@wherejuly/imagetron-shared';
import { dataProvider_reroll_prompt_errors } from '@tests/foundation/.ancillary/helpers/data-providers.js';
import GoAPIResponseErrorVO from '@src/ddriven/ports/adapters/outgoing/http/goapi/GoAPIError.valueobject.js';
import PromptMockSeeder from '@tests/foundation/.ancillary/helpers/PromptMockSeeder.js';

const { orm, em } = await database();
const { server } = await application(orm);

const config = container.resolve(ConfigVO).get('apis');

const base = config.goapi.base_url;
const path = '/api/v1/task';
const nockServer = nock(base);

let seeder: PromptMockSeeder;

describe('[integration] MidjourneyRerollCommandServiceTest', () => {

    beforeEach(async () => {
        await orm.schema.refreshDatabase();

        seeder = await PromptMockSeeder.create(em);

        em.clear();
    });

    afterAll(async () => {
        await orm.close(true);
        await server.close();
    });

    it('+constructor(): Should create MidjourneyRerollCommandService expected object', () => {
        const actual = new MidjourneyRerollCommandService(em);

        expect(actual).toBeInstanceOf(MidjourneyRerollCommandService);

        expect(actual.reroll).toBeInstanceOf(Function);
    });

    it('+reroll() #1: Should return ImageGenerationPromptEO expected object', async () => {
        // INFO: Arrange

        // NB: Set the GoAPI mock to respond with 'reroll' command pending
        const expected = fixtures.goapi.status_pending_response;
        expected.data.task_type = CGoAPI.ETaskType.Reroll;
        nockServer.post(path).reply(200, expected);

        // NB: Seed prompt with 'imagine' task completed
        const seeded = await seeder.afterImagineCompleted();

        // INFO: Act
        const service = new MidjourneyRerollCommandService(em);

        const actual = {
            prompt: await service.reroll(seeded.uuid!),
            conditions: await em.findOne(MidjourneyTaskConditionsEO, { id: 1 })
        };

        // INFO: Assert
        expect(actual.prompt.uuid).toEqual(seeded.uuid);
        expect(actual.prompt.status).toEqual(CPrompts.EImageGenerationPromptStatus.GenerationAwait);
        expect(actual.prompt.midjourney_commands.latest).toEqual(CImages.EMidjourneyLatestCommands.Reroll);
        expect(actual.prompt.midjourney_commands.allowed_root).toEqual(CImages.EMidjourneyRootCommands.Reroll);

        expect(actual.prompt.tasks.count()).toEqual(2);
        expect(actual.prompt.tasks[1]!.status).toEqual(CGoAPI.ETaskResultStatus.Pending);

        expect(actual.conditions?.active_tasks_counter).toEqual(1);
        expect(actual.conditions?.fast_mode_task_counter).toEqual(2);
        expect(actual.conditions?.relaxed_mode_task_counter).toEqual(0);
    });

    describe('+reroll() #3: Should throw expected prompt errors (404, 409)', () => {

        it.each(dataProvider_reroll_prompt_errors(em))('Case #%# $name', async (data) => {
            const expected = await data.prepare();

            // INFO: Act
            const service = new MidjourneyRerollCommandService(em);

            // NB: This is the correct way to call it once but check result multiple times
            const actual_ = async () => { await service.reroll(expected.uuid!); };
            const actual = actual_();

            // INFO: Assert
            await expect(actual).rejects.toThrowError(ImagetronException);
            await expect(actual).rejects.toThrowError(data.message);
        });

    });

    describe('+reroll() #4: Should throw expected GoAPI errors (424: [400, 401, 500])', () => {

        it.each(dataProvider_reroll_goapi_errors())('Case #%# $name', async (data) => {
            // INFO: Arrange
            nockServer.post(path).reply(data.code, { data: data.payload });

            // NB: Seed prompt with 'imagine' task completed
            const seeded = await seeder.afterImagineCompleted();

            // INFO: Act
            const service = new MidjourneyRerollCommandService(em);

            // NB: This is the correct way to call it once but check result multiple times
            const actual_ = async () => { await service.reroll(seeded.uuid!); };
            const actual = actual_();

            // INFO: Assert
            try {
                await actual;
                expect.fail('The test was expected to catch an error, but no error was thrown.');
            } catch (error) {
                const actual = error as ImagetronException;

                expect(actual).toBeInstanceOf(ImagetronException);
                expect(actual.code).toEqual(EDomainErrorCodes.GOAPI_UNEXPECTED_FAILURE);
                expect(actual.metadata).toBeInstanceOf(GoAPIResponseErrorVO);
                expect((actual.metadata as GoAPIResponseErrorVO).goapi_http_code).toEqual(data.code);
                expect((actual.metadata as GoAPIResponseErrorVO).goapi_error).toEqual(data.payload.error);
            }
        });

        function dataProvider_reroll_goapi_errors() {
            return [
                { name: '400', code: 400, payload: { error: { message: 'GoAPI mocked bad request message' } } },
                { name: '401', code: 401, payload: { error: { message: 'GoAPI mocked unauthorized message' } } },
                { name: '500', code: 500, payload: { error: { message: 'GoAPI mocked 500 message' } } },
            ];
        }

        it('Should throw for formally success http status (200) with "response.data.status==failure"', async () => {
            // INFO: Arrange
            const expected = fixtures.goapi.status_failure_response;
            nockServer.post(path).reply(200, expected);

            // NB: Obtain prompt with 'imagine' task completed?
            const prompt = await seedMockPromptWithTask(em);

            // NB: Update prompt status as if after 'imagine' command completed and task as 'complete'
            em.merge(prompt);
            prompt.tasks[0]!.status = CGoAPI.ETaskResultStatus.Completed;
            // WARNING: Must update in 2 places to make it behave
            prompt.status = CPrompts.EImageGenerationPromptStatus.HasVariations;
            // @ts-expect-error hack assignment
            prompt._status.status = CPrompts.EImageGenerationPromptStatus.HasVariations;

            await em.flush();

            // INFO: Act
            const service = new MidjourneyRerollCommandService(em);

            // NB: This is the correct way to call it once but check result multiple times
            const actual_ = async () => { await service.reroll(prompt.uuid!); };
            const actual = actual_();

            try {
                await actual;
                expect.fail('The test was expected to catch an error, but no error was thrown.');
            } catch (error) {
                const actual = error as ImagetronException;

                expect(actual).toBeInstanceOf(ImagetronException);
                expect(actual.code).toEqual(EDomainErrorCodes.GOAPI_TASK_FAILURE);
            }
        });

    });

});
