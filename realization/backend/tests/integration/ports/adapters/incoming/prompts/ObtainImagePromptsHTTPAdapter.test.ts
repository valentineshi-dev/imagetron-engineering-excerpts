'use strict';

import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FastifyError, InjectOptions } from 'fastify';
import nock from 'nock';

import fixtures from '@tests/foundation/.ancillary/fixtures/index.js';

import { container } from 'tsyringe';

import { CPrompts, ImplementationContractOutlet } from '@wherejuly/imagetron-backend-contract';

import application from '@tests/foundation/.ancillary/bootstrap/application.js';
import database from '@tests/foundation/.ancillary/bootstrap/database.js';

import ConfigVO from '@src/ddriven/application/configuration/Config.valueobject.js';
import { ImageGenerationPromptEO } from '@src/database/schema/ImageGenerationPrompt.schema.js';
import ChatGPTUnexpectedFailureResponseVO from '@src/ddriven/domain/prompts/ChatGPTUnexpectedFailureResponse.valueobject.js';

const { orm, em } = await database();
const { server } = await application(orm);

const contract = container.resolve(ImplementationContractOutlet);
const config = container.resolve(ConfigVO).get();

const base = config.chatgpt.base_url;
const nockServer = nock(base);

describe('[integration] ObtainImagePromptsHTTPAdapterTest', () => {

    beforeEach(async () => {
        await orm.schema.refreshDatabase();
    });

    afterEach(() => {
        container.clearInstances();
    });

    afterAll(async () => {
        await orm.close(true);
        await server.close();
    });

    const { verb, route } = contract.obtainImagePrompts;

    const path = '/chat/completions';

    it(`${verb} ${route}: Should obtain the Image Generation Prompt(s) via ChatGPT (mocked)`, async () => {
        const expected = JSON.parse(fixtures.chatgpt_completions_image_prompts.choices[0]!.message.content) as CPrompts.ImageGenerationPromptResponseItem[];

        nockServer.post(path).reply(200, fixtures.chatgpt_completions_image_prompts);

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
        expect(actual.response[0]!.content).toEqual(expected[0]!.content);
        expect(actual.response[0]!.status).toEqual(CPrompts.EImageGenerationPromptStatus.New);

        // NB: Assert persisted
        expect(actual.persisted.length).toEqual(expected.length);
        expect(actual.persisted[0]!.uuid).toEqual(actual.response[0]!.uuid);
        expect(actual.persisted[0]!.content).toEqual(expected[0]!.content);
        expect(actual.persisted[0]!.status).toEqual(CPrompts.EImageGenerationPromptStatus.New);
        expect(actual.persisted[0]!.midjourney_commands).toEqual(ImageGenerationPromptEO.midjourneyCommandsDefaults);
    });

    it(`${verb} ${route}: Should return the failure response (424) of ChatGPT (mocked)`, async () => {
        nockServer.post(path).reply(400, fixtures.chatgpt_completions_image_prompts);

        const response = await server.inject({
            method: verb,
            url: route,
            headers: { 'x-api-key': config.imagetron.api_key },
            body: { subject: 'anything' }
        } as InjectOptions);

        expect(response.statusCode).toEqual(424);

        const actual = response.json<ChatGPTUnexpectedFailureResponseVO>();

        expect(actual.http.status).toEqual(400);
        expect(actual.http.message).toEqual('Bad Request');
        expect(actual.finish_reason).toEqual('stop');
    });

    it(`${verb} ${route}: Should return the server error (500) with "Unexpected error parsing the Chat GPT image prompts response" on ChatGPT (mocked)`, async () => {
        nockServer.post(path).reply(200, fixtures.chatgpt_completions_image_invalid_prompts);

        const response = await server.inject({
            method: verb,
            url: route,
            headers: { 'x-api-key': config.imagetron.api_key },
            body: { subject: 'anything' }
        } as InjectOptions);

        const actual = response.json<FastifyError>();

        expect(actual.statusCode).toEqual(500);
        expect(actual.message).toEqual(expect.stringContaining('Unexpected error parsing the Chat GPT image prompts response'));
        expect(actual.message).toEqual(expect.stringContaining('properties: "prompt,title,keywords'));
    });

});
