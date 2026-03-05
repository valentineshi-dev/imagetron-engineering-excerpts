'use strict';

import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import fixtures from '@fixtures/index.js';

import PromptMockSeeder from '@tests/foundation/.ancillary/helpers/PromptMockSeeder.js';

import { container } from 'tsyringe';
import nock from 'nock';
import { InjectOptions } from 'fastify';

import { CGoAPI, CImages, ConsumerContractOutlet, CPrompts, ImplementationContractOutlet } from '@wherejuly/imagetron-backend-contract';

import application from '@tests/foundation/.ancillary/bootstrap/application.js';
import database from '@tests/foundation/.ancillary/bootstrap/database.js';

import ConfigVO from '@src/ddriven/application/configuration/Config.valueobject.js';
import { ImageGenerationPromptEO } from '@src/database/schema/ImageGenerationPrompt.schema.js';

const config = container.resolve(ConfigVO).get();

const { orm, em } = await database();
const { server } = await application(orm);

const contract = container.resolve(ImplementationContractOutlet);
const consumerContract = new ConsumerContractOutlet();

const base = config.apis.goapi.base_url;
const path = '/api/v1/task';
const nockServer = nock(base);

const apiKey = config.imagetron.api_key;

let seeder: PromptMockSeeder;

describe('[integration] VariationsImagesHTTPAdapterTest', () => {

    beforeEach(async () => {
        await orm.schema.refreshDatabase();

        seeder = await PromptMockSeeder.create(em);

        em.clear();
    });

    afterAll(async () => {
        await orm.close(true);
        await server.close();
    });

    it('[201] POST /images/prompt/{prompt_uuid}/midjourney/task/{task_uuid}/variations/{choice}: Should run "variations" command via GoAPI', async () => {
        const fixture = fixtures.goapi.status_pending_response;
        fixture.data.task_type = CGoAPI.ETaskType.Variation;
        nockServer.post(path).reply(200, fixture);

        const expected = await seeder.afterImagineCompleted();

        const { verb, route } = consumerContract.actualFor(contract.runMidjourneyVariationsCommand,
            { prompt_uuid: expected.uuid, task_uuid: expected.tasks[0]?.goapi_task_uuid, choice: CGoAPI.EVariationIndex.V1 }
        );

        const response = await server.inject({
            method: verb,
            url: route,
            headers: { 'x-api-key': apiKey }
        } as InjectOptions);

        expect(response.statusCode).toEqual(201);

        const actual = await em.findOneOrFail(ImageGenerationPromptEO, { uuid: expected.uuid }, { populate: ['*'] });

        expect(actual).toBeInstanceOf(ImageGenerationPromptEO);
        expect(actual.uuid).toEqual(expected.uuid);
        expect(actual.mode).toEqual(CImages.EMidjourneyImageGenerationMode.Fast);
        expect(actual.status).toEqual(CPrompts.EImageGenerationPromptStatus.GenerationAwait);
        expect(actual.midjourney_commands.latest).toEqual(CImages.EMidjourneyLatestCommands.Variations);
        expect(actual.midjourney_commands.allowed_root).toEqual(CImages.EMidjourneyRootCommands.Reroll);

        expect(actual.tasks).toHaveLength(2);
        expect(actual.tasks[1]?.command).toEqual(CGoAPI.ETaskType.Variation);
        expect(actual.tasks[1]?.status).toEqual(CGoAPI.ETaskResultStatus.Pending);
    });

    // NB: Omit errors redundant assertions as they are actually tested with the reroll service
    // and the imagine endpoint handler that as well uses `.runCommand()` method.

});

