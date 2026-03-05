'use strict';

import { CGoAPI } from '@wherejuly/imagetron-backend-contract';

import { TGoAPIWebhookRequestPayload } from '@src/ddriven/application/events/GoAPITaskReturnedEvent.valueobject.js';
import { v4 } from 'uuid';
import { BASE, VARIATIONS } from '@tests/foundation/.ancillary/helpers/provideImageMock.js';

export default function payloadFn(makeInvalidPayload: boolean = false, task_id?: string, status?: CGoAPI.ETaskResultStatus, endpoint?: string, secret?: string): TGoAPIWebhookRequestPayload {
    const fixture = JSON.parse(JSON.stringify(template)) as TGoAPIWebhookRequestPayload;

    const uuid = v4();

    fixture.timestamp = Math.floor(Date.now() / 1000);
    fixture.data.task_id = task_id ?? uuid;
    fixture.data.status = status ?? CGoAPI.ETaskResultStatus.Completed;
    fixture.data.config.webhook_config.endpoint = endpoint ?? 'endpoint';
    fixture.data.config.webhook_config.secret = secret ?? 'secret';

    if (makeInvalidPayload) {
        fixture.data.output = {} as unknown as TGoAPIWebhookRequestPayload['data']['output'];
    }

    return fixture;
}

// Construct the variations URLs with base url and image name
function getVariationsURLs(variations: string[]): string[] {
    return variations.map((variation: string) => { return `${BASE}/${variation}`; });
}

const template = {
    timestamp: 0,
    data: {
        model: 'midjourney',
        task_type: 'imagine',
        task_id: 'task-id',
        status: "completed",
        config: {
            webhook_config: {
                endpoint: 'endpoint',
                secret: 'secret',
            },
            service_mode: "public",
        },
        input: {
            index: 2,
            origin_task_id: v4()
        },
        output: {

            /**
             * WARNING: The image URL is constructed with TEST_IMAGES_MOCK_BASE_URL env variable
             * and image names from `tests\foundation\.ancillary\fixtures\goapi\images`
             * folder for Nock images mock provider from 
             * `tests\foundation\.ancillary\helpers\provideImageMock.ts`
             */
            temporary_image_urls: getVariationsURLs(VARIATIONS),
            image_url: `${BASE}/upscaled-1.png`,
            progress: 0,
            actions: ['action1', 'action2'],
        },
        error: {
            code: 0,
            message: 'message',
            raw_message: 'raw_message',
            detail: null
        }
    }
};