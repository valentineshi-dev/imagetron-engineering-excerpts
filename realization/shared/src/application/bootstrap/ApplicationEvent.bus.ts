'use strict';

import Emittery from 'emittery';

import { TEvents } from '@src/application/abstractions/AApplication.event.js';

export const APPLICATION_EVENT_BUS_NAME = 'eventbus:application';

export default class ApplicationEventBus extends Emittery<TEvents> {
    
    constructor() {
        super({ debug: Emittery.isDebugEnabled ? { name: APPLICATION_EVENT_BUS_NAME } : undefined });
    }

}
