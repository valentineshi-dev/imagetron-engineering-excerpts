'use strict';

import { TDomainConfig } from '@src/ddriven/application/abstractions/config.types.js';
import ConfigVO from '@src/ddriven/application/configuration/Config.valueobject.js';
import { ImagetronException } from '@wherejuly/imagetron-shared';
import { container } from 'tsyringe';

/**
 * @summary
 * A value object representing the count of active tasks, enforcing business rules
 * related to task management.
 * 
 * @reason
 * The reason to exist: the parent entity cannot accept to both enforce so many
 * business rules for each separate property as well as bear the properties operations
 * (increment, decrement, etc.). This justifies creation of the value object. 
 *  
 * @see {@link GenerationModeTaskCounterVO} playing the similar role.
 * 
 * @description 
 * This class is responsible for managing and validating the count of active tasks within a system.
 * It ensures that the number of active tasks does not exceed a predefined maximum limit 
 * as specified in the configuration.
 * 
 * @rules
 * Enforces the following business rules:
 * 
 * 1. The active task counter cannot exceed the maximum_active_tasks value defined in 
 * the midjourney configuration.
 * 2. The active task counter cannot be decremented below zero.
 * 3. Any attempt to increment or decrement the counter in violation of the above rules 
 * will result in an exception being thrown.
 * 
 * @methods
 * - `canAddTask()`: Checks if a new task can be added without exceeding the maximum limit.
 * - `increment()`: Increases the active task counter by one, throwing an error if the maximum limit is exceeded.
 * - `decrement()`: Decreases the active task counter by one, throwing an error if the counter would drop below zero.
 * - `value`: Getter to retrieve the current active task count.
 */

export default class ActiveTaskCounterVO {

    #config: TDomainConfig['midjourney'];

    private _active_tasks_counter: number;

    constructor(counter: number) {
        const config = container.resolve(ConfigVO).get('domain');

        this.#config = config.midjourney;

        this._active_tasks_counter = counter;
    }

    public get value(): number {
        return this._active_tasks_counter;
    }

    /**
     * @see design notes {@link https://valentineshi.atlassian.net/browse/IMAGETRON-191}
     * @see design notes {@link https://github.com/WhereJuly/63-imagetron/blob/construct/backend/develop/packages/backend/implementation/.a&cd/model/models.md#generate-image-versions}
     * 
     * Can add tasks for `active_tasks_counter < config.midjourney.maximum_active_tasks`
     */
    public canAddTask(): boolean {
        return this.belowMaximum;
    }

    public increment(): number {
        if (!this.belowMaximum) { throw new ImagetronException(`Invalid attempt to increment active task counter beyond maximum "${this._active_tasks_counter}".`); }

        return this._active_tasks_counter += 1;
    }

    public decrement(): number {
        if (this._active_tasks_counter < 1) { throw new ImagetronException(`Invalid attempt to decrement active task counter below zero.`); }

        return this._active_tasks_counter -= 1;
    }

    private get belowMaximum(): boolean {
        return this._active_tasks_counter < this.#config.maximum_active_tasks;
    }

}