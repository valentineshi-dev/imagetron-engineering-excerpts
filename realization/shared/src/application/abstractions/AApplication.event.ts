'use strict';

import Emittery from 'emittery';

import { CApplication } from '@wherejuly/imagetron-backend-contract';
import ImagetronException from '@src/application/exceptions/Imagetron.exception.js';

export type TEvents = {
    [CApplication.EEventIdentity.GOAPI_TASK_RETURNED]: CApplication.GoAPITaskReturnedEvent;
    [CApplication.EEventIdentity.GOAPI_TASK_PROCESSED]: CApplication.GoAPITaskProcessedEvent;
};

export default abstract class AApplicationEventVO {

    public static identity: CApplication.EEventIdentity;

    #bus: Emittery<TEvents>;

    public readonly identity: CApplication.EEventIdentity;

    constructor(bus: Emittery<TEvents>) {
        this.identity = (this.constructor as typeof AApplicationEventVO).identity;

        this.#bus = bus;

        // Ensure the static property is defined
        if ((this.constructor as typeof AApplicationEventVO).identity === undefined) {
            throw new ImagetronException(`[${this.constructor.name}] Subclass must define a static "identity" property, "undefined" is provided.`);
        }
    }

    public async emit(): Promise<void> {
        // NB: Type cast is required to keep `emit()` method on superclass.
        await this.#bus.emit(this.identity, this as unknown as TEvents[keyof TEvents]);
    }

}