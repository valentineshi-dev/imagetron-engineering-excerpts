'use strict';

import { describe, expect, it } from 'vitest';

import { container } from 'tsyringe';

import { CGoAPI, CImages, ImplementationContractOutlet } from '@wherejuly/imagetron-backend-contract';
import GoAPIImagineTaskPayload, { ASPECT_RATIO, TImagineData } from '@src/ddriven/ports/adapters/outgoing/http/goapi/payload/GoAPIImagineTaskPayload.valueobject.js';
import { MODEL, SERVICE_MODE } from '@src/ddriven/ports/adapters/outgoing/http/goapi/payload/GoAPIBaseTaskPayload.valueobject.js';
import ConfigVO from '@src/ddriven/application/configuration/Config.valueobject.js';

import { contract as _bootstrap } from '@tests/foundation/.ancillary/bootstrap/contract.js';

_bootstrap();

const config = container.resolve(ConfigVO).get('imagetron');
const contract = container.resolve(ImplementationContractOutlet);

// REFACTOR: Move to integration tests
describe('[integration] GoAPIImagineTaskPayloadTest', () => {

    it('+constructor(): Should create GoAPIImagineTaskPayload expected object', () => {
        const { route } = contract.webhookHandleMidjourneyCommandTaskResults;

        const expected: TImagineData = {
            webhook_route: route,
            prompt: 'prompt',
            process_mode: CImages.EMidjourneyImageGenerationMode.Fast
        };

        const actual = new GoAPIImagineTaskPayload(expected);

        expect(actual).toBeInstanceOf(GoAPIImagineTaskPayload);

        expect(actual.model).toEqual(MODEL);
        expect(actual.task_type).toEqual(CGoAPI.ETaskType.Imagine);
        expect(actual.config.webhook_config.endpoint).toEqual(expect.stringContaining(route));
        expect(actual.config.webhook_config.secret).toEqual(config.api_key);
        expect(actual.config.service_mode).toEqual(SERVICE_MODE);
        expect(actual.input.prompt).toEqual('prompt --v 6');
        expect(actual.input.aspect_ratio).toEqual(ASPECT_RATIO);
        expect(actual.input.process_mode).toEqual(expected.process_mode);
    });

});


