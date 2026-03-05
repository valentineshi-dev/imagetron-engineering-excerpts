'use strict';

import { ImagetronException } from '@wherejuly/imagetron-shared';

/**
 * @summary
 * A value object representing the count of tasks in a specific generation mode,
 * enforcing basic business rules for task counter management.
 * 
 * @reason See {@link ActiveTaskCounterVO}.
 * 
 * @description
 * This class is responsible for managing the count of tasks associated with a specific generation mode. It ensures that the counter cannot be decremented below zero and provides methods to increment or decrement the counter as needed.
 * 
 * @rules
 * 1. The task counter cannot be decremented below zero.
 * 2. Any attempt to decrement the counter below zero will result in an exception being thrown.
 * 
 * @methods
 * - `increment()`: Increases the task counter by one.
 * - `decrement()`: Decreases the task counter by one, throwing an error if the counter would drop below zero.
 * - `value`: Getter to retrieve the current task count.
 */
export default class GenerationModeTaskCounterVO {

    private _counter: number;

    constructor(counter: number) {
        this._counter = counter;
        this.increment = this.increment.bind(this);
        this.decrement = this.decrement.bind(this);
    }

    public get value(): number {
        return this._counter;
    }

    public increment(): number {
        return this._counter += 1;
    }

    public decrement(): number {
        if (this._counter < 1) { throw new ImagetronException(`Invalid attempt to decrement task mode counter below zero.`); }

        return this._counter -= 1;
    }

}