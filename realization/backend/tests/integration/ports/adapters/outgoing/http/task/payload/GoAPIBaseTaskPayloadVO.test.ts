'use strict';

import { describe, expect, it } from 'vitest';

import { container } from 'tsyringe';

import { CGoAPI, ImplementationContractOutlet } from '@wherejuly/imagetron-backend-contract';
import GoAPIBaseTaskPayloadVO, { MODEL, SERVICE_MODE, TData } from '@src/ddriven/ports/adapters/outgoing/http/goapi/payload/GoAPIBaseTaskPayload.valueobject.js';
import ConfigVO from '@src/ddriven/application/configuration/Config.valueobject.js';

import { contract as _bootstrap } from '@tests/foundation/.ancillary/bootstrap/contract.js';

_bootstrap();

const config = container.resolve(ConfigVO).get('imagetron');

const contract = container.resolve(ImplementationContractOutlet);

// REFACTOR: Move to integration tests
describe('[integration] GoAPIBaseTaskPayloadVOTest', () => {

    it('+constructor(): Should create GoAPIBaseTaskPayloadVO expected object', () => {
        const { route } = contract.webhookHandleMidjourneyCommandTaskResults;

        const expected: TData = {
            task_type: CGoAPI.ETaskType.Imagine,
            webhook_route: route
        };

        const actual = new (class extends GoAPIBaseTaskPayloadVO {
            constructor(data: TData) { super(data); }
        })(expected);

        expect(actual).toBeInstanceOf(GoAPIBaseTaskPayloadVO);

        expect(actual.model).toEqual(MODEL);
        expect(actual.task_type).toEqual(CGoAPI.ETaskType.Imagine);
        expect(actual.config.webhook_config.endpoint).toEqual(expect.stringContaining(expected.webhook_route));
        expect(actual.config.webhook_config.secret).toEqual(config.api_key);
        expect(actual.config.service_mode).toEqual(SERVICE_MODE);
    });

});


