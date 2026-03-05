'use strict';

import AApplicationEventVO, { TEvents } from '@src/application/abstractions/AApplication.event.js';
import { CApplication } from '@wherejuly/imagetron-backend-contract';
import Emittery from 'emittery';

export default class GoAPITaskProcessedEventVO extends AApplicationEventVO implements CApplication.GoAPITaskProcessedEvent {

    public static identity: CApplication.EEventIdentity = CApplication.EEventIdentity.GOAPI_TASK_PROCESSED;

    public payload: CApplication.GoAPITaskProcessedEvent['payload'];

    constructor(bus: Emittery<TEvents>, counter: number, prompt: CApplication.GoAPITaskProcessedEvent['payload']['prompt']) {
        super(bus);

        this.payload = {
            active_generation_tasks_counter: counter,
            prompt: prompt
        };
    }

}