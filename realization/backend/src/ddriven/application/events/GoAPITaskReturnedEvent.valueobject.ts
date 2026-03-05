'use strict';

import { Ajv } from 'ajv';
import Emittery from 'emittery';

import { CApplication, CGoAPI, CImages } from '@wherejuly/imagetron-backend-contract';
import { AApplicationEventVO, TEvents } from '@wherejuly/imagetron-shared';

export type TGoAPIWebhookRequestPayload = { timestamp: number; data: CGoAPI.TaskResultData; };
export type TInputs = { prompt_uuid: string, payload: TGoAPIWebhookRequestPayload; };

/**
 * Used to trigger the GoAPITaskReturnedEventVO.identity event.
 * 
 * The event severs to trigger the GoAPI task results processing. See more in the code design
 * diagrammed at the following references. The event payload is GoAPITaskReturnedEventVO itself.
 * 
 * @see https://github.com/WhereJuly/63-imagetron/blob/construct/frontend/develop/packages/backend/implementation/.a%26cd/model/use-cases/images/save-variations-imagine/save-variations.models.md#save-variations-webhook
 * @see https://github.com/WhereJuly/63-imagetron/blob/construct/frontend/develop/packages/backend/implementation/.a%26cd/model/use-cases/images/save-variations-imagine/save-variations.models.md#handle-image-download-and-upload
 */
export class GoAPITaskReturnedEventVO extends AApplicationEventVO implements CApplication.GoAPITaskReturnedEvent {

    /**
     * Required by {@link this.isValid} method
     */
    #webhookRequestPayload: TGoAPIWebhookRequestPayload;

    // NB: Static property is used when no instance is available
    public static identity: CApplication.EEventIdentity = CApplication.EEventIdentity.GOAPI_TASK_RETURNED;

    public readonly command: CImages.EMidjourneyCommands;
    public readonly payload: CApplication.GoAPITaskReturnedEvent['payload'];

    constructor(bus: Emittery<TEvents>, promptUUID: string, command: CImages.EMidjourneyCommands, webhookRequestPayload: TGoAPIWebhookRequestPayload) {
        super(bus);

        this.#webhookRequestPayload = webhookRequestPayload;

        this.command = command;

        this.payload = {
            prompt_uuid: promptUUID,

            // NB: Detach the nested objects pointers just for the case.
            data: JSON.parse(JSON.stringify(webhookRequestPayload.data)) as CApplication.GoAPITaskReturnedEvent['payload']['data']
        };
    }

    /**
     * Validate the object content vs the contract, webhook endpoint request body.
     * As the GoAPITaskReturnedEventVO payload does not include the (seemingly) redundant 
     * `timestamp` field I have to save the entire request payload on {@link #webhookRequestPayload}
     * property for validation.
     * 
     * REFACTOR: The note above is not clear. 
     * Rewrite when I get the actual meaning in the grander scheme.
     * 
     * @see http://localhost:3000/#/operations/webhookHandleMidjourneyImagineTaskResults
     */
    public isValid(ajv: Ajv, contract: Record<string, any>): boolean {
        return ajv.validate(contract, this.#webhookRequestPayload);
    }

    public isGoAPITaskInStatus(status: CGoAPI.ETaskResultStatus): boolean {
        return this.payload.data.status === status;
    }

}