'use strict';

import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { container } from 'tsyringe';

import { CImages, ConsumerContractOutlet, ImplementationContractOutlet } from '@wherejuly/imagetron-backend-contract';

import application from '@tests/foundation/.ancillary/bootstrap/application.js';
import database from '@tests/foundation/.ancillary/bootstrap/database.js';

import ConfigVO from '@src/ddriven/application/configuration/Config.valueobject.js';
import { ImageGenerationPromptFactory } from '@src/database/seeding/ImageGenerationPrompt.factory.js';
import { MidjourneyImageEO } from '@src/database/schema/MidjourneyImage.schema.js';
import { MidjourneyImageFactory } from '@src/database/seeding/MidjourneyImage.factory.js';
import { InjectOptions } from 'fastify';
import { v4 } from 'uuid';
import { EDomainErrorCodes, StructuredErrorVO } from '@wherejuly/imagetron-shared';

const config = container.resolve(ConfigVO).get();

const { orm, em } = await database();
const { server } = await application(orm);

const contract = container.resolve(ImplementationContractOutlet);
const consumerContract = new ConsumerContractOutlet();

const apiKey = config.imagetron.api_key;

describe('[integration] ImagesRetrieveHTTPAdapterTest', () => {

    beforeEach(async () => {
        await orm.schema.refreshDatabase();

        em.clear();
    });

    afterAll(async () => {
        await orm.close(true);
        await server.close();
    });

    it('[200] GET /images/prompt/{uuid}/retrieve/list: Should retrieve images', async () => {
        const expected = await new ImageGenerationPromptFactory(em).createOne();
        const randomizer = (image: MidjourneyImageEO) => {
            image.prompt_uuid = expected.uuid!;
        };
        const images = await new MidjourneyImageFactory(em).each(randomizer).create(4);

        expect(expected.uuid).not.toBeNull();
        expect(images).toHaveLength(4);

        const { verb, route } = consumerContract.actualFor(contract.retrievePromptImagesList, { uuid: expected.uuid });

        const response = await server.inject({
            method: verb,
            url: route,
            headers: { 'x-api-key': apiKey }
        } as InjectOptions);

        expect(response.statusCode).toEqual(200);

        const actual = response.json<CImages.ImageItem[]>();

        expect(actual).toHaveLength(4);

        // Assert 3 computed properties exist and of expected value
        expect(actual[0]!.url).toEqual(expect.stringContaining(actual[0]!.name));
        expect(actual[0]!.is_locked).toEqual(false);
        expect(actual[0]!.timestamp).not.toBeNull();
    });

    it('[204] GET /images/prompt/{uuid}/retrieve/list: Should retrieve no images', async () => {
        const expected = await new ImageGenerationPromptFactory(em).createOne();

        const { verb, route } = consumerContract.actualFor(contract.retrievePromptImagesList, { uuid: expected.uuid });

        const response = await server.inject({
            method: verb,
            url: route,
            headers: { 'x-api-key': apiKey }
        } as InjectOptions);

        expect(response.statusCode).toEqual(204);
    });

    it('[404] GET /images/prompt/{uuid}/retrieve/list: No given prompt exists', async () => {
        const uuid = v4();
        const { verb, route } = consumerContract.actualFor(contract.retrievePromptImagesList, { uuid });

        const response = await server.inject({
            method: verb,
            url: route,
            headers: { 'x-api-key': apiKey }
        } as InjectOptions);

        expect(response.statusCode).toEqual(404);

        const actual = response.json<StructuredErrorVO>();

        expect(actual.status).toEqual(404);
        expect(actual.code).toEqual(EDomainErrorCodes.PROMPT_NOT_FOUND);
    });

});
