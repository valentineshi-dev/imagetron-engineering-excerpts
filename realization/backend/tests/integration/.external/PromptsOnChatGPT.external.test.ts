'use strict';

import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { container } from 'tsyringe';
import { InjectOptions } from 'fastify';

import { CPrompts, ImplementationContractOutlet } from '@wherejuly/imagetron-backend-contract';

import application from '@tests/foundation/.ancillary/bootstrap/application.js';
import database from '@tests/foundation/.ancillary/bootstrap/database.js';

import ConfigVO from '@src/ddriven/application/configuration/Config.valueobject.js';
import { ImageGenerationPromptEO } from '@src/database/schema/ImageGenerationPrompt.schema.js';
import { SubjectsChatMessageEO } from '@src/database/schema/SubjectsChatMessage.schema.js';
import { ImageGenerationPromptFactory } from '@src/database/seeding/ImageGenerationPrompt.factory.js';

// NB: vitest setup calls the BootstrapService.run().

const contract = container.resolve(ImplementationContractOutlet);
const config = container.resolve(ConfigVO).get();

const { orm, em } = await database();
const { server } = await application(orm);

describe('[external] PromptsOnChatGPTTest', () => {

    beforeEach(async () => {
        await orm.schema.refreshDatabase();
    });

    afterAll(async () => {
        await orm.close(true);
        await server.close();
    });


    it(`"POST /prompts/prompts/obtain": Should obtain the Image Generation Prompt(s) via actual ChatGPT`, async () => {
        const { verb, route } = contract.obtainImagePrompts;
        const expected = {
            length: 2,
            status: CPrompts.EImageGenerationPromptStatus.New,
        };

        const response = await server.inject({
            method: verb,
            url: route,
            headers: { 'x-api-key': config.imagetron.api_key },
            body: { subject: 'Two prompts. One for dragon, another for cat.' }
        } as InjectOptions);

        expect(response.statusCode).toEqual(201);

        const actual = {
            response: response.json<CPrompts.ImageGenerationPrompt[]>(),
            persisted: await em.findAll(ImageGenerationPromptEO)
        };

        // NB: assert response
        expect(actual.response.length).toEqual(expected.length);
        expect(actual.response[0]!.status).toEqual(expected.status);

        // NB: Assert persisted
        expect(actual.persisted.length).toEqual(expected.length);
        expect(actual.persisted[0]!.uuid).toEqual(actual.response[0]!.uuid);
        expect(actual.persisted[0]!.status).toEqual(CPrompts.EImageGenerationPromptStatus.New);
    }, 20000);

    it(`"POST /prompts/subjects/obtain": Obtain Prompt Subject via actual ChatGPT`, async () => {
        const { verb, route } = contract.obtainPromptSubjectsInChat;

        const response = await server.inject({
            method: verb,
            url: route,
            headers: { 'x-api-key': config.imagetron.api_key },
            body: { content: 'What is the weather like today?' },
        } as InjectOptions);

        expect(response.statusCode).toEqual(200);

        const actual = {
            response: response.json<{ history: CPrompts.ChatGPTMessageItem[]; }>(),
            persisted: await em.findAll(SubjectsChatMessageEO)
        };

        // NB: Assert the response
        expect(actual.response.history).toHaveLength(2);
        expect(actual.response.history[1]?.role).toEqual(CPrompts.EChatGPTMessageRole.Assistant);
        expect(actual.response.history[1]?.content).toBeTruthy();
        expect(actual.response.history[1]?.content.length).toBeGreaterThan(10);

        expect(actual.persisted.length).toEqual(actual.response.history.length);

        actual.persisted.forEach((persisted: SubjectsChatMessageEO, index: number) => {
            expect(persisted).toMatchObject(actual.response.history[index]!);
        });

    }, 20000);

    it(`"PATCH /prompts/prompt/title/obtain": Obtain Image Prompt Title via actual ChatGPT`, async () => {
        const { verb, route } = contract.obtainImagePromptTitle;
        const prompts = new ImageGenerationPromptFactory(em).make(3);
        await em.flush();

        const fixture = {
            uuid: prompts[1]!.uuid,
            title: prompts[1]!.title
        };

        const response = await server.inject({
            method: verb,
            url: route,
            headers: { 'x-api-key': config.imagetron.api_key },
            body: { prompt_uuid: fixture.uuid }
        } as InjectOptions);

        expect(response.statusCode).toEqual(200);

        // WARNING: Forgetting this would keep the old title returned by the following em calls.
        em.clear();

        const actual = {
            response: response.json<CPrompts.ImageGenerationPrompt>(),
            persisted: await em.findOneOrFail(ImageGenerationPromptEO, { uuid: fixture.uuid })
        };

        // NB: assert response
        expect(actual.response.uuid).toEqual(fixture.uuid);
        expect(actual.response.title).not.toEqual(fixture.title);

        // NB: Assert persisted
        expect(actual.persisted.uuid).toEqual(fixture.uuid);
        expect(actual.persisted.title).not.toEqual(fixture.title);
        expect(actual.persisted.title).toBeTruthy();
        expect(actual.persisted.title.length).toBeGreaterThan(10);
    }, 20000);

});
