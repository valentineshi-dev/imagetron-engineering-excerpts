'use strict';

import { container } from 'tsyringe';
import { EntitySchema } from '@mikro-orm/core';
import { CheckConstraint } from 'node_modules/@mikro-orm/core/typings.js';

import { ICustomBaseEntity } from './CustomBaseEntity.schema.js';
import ConfigVO from '../../ddriven/application/configuration/Config.valueobject.js';
import MidjourneyTaskConditionsVO from '@src/ddriven/domain/images/model/midjourney/task/conditions/MidjourneyTaskConditions.valueobject.js';

const config = container.resolve(ConfigVO).get('domain');

const MAXIMUM_ACTIVE_TASKS = config.midjourney.maximum_active_tasks;
const FAST_MODE_THRESHOLD_PERCENT = config.midjourney.fast_mode_threshold_percent;

export interface IMidjourneyTaskConditions extends ICustomBaseEntity {
    id?: number;
    active_tasks_counter: number;
    relaxed_mode_task_counter: number;
    fast_mode_task_counter: number;
    fast_mode_threshold_percent: number;
}

export class MidjourneyTaskConditionsEO implements IMidjourneyTaskConditions {

    public id?: number;
    public active_tasks_counter: number;
    public relaxed_mode_task_counter: number;
    public fast_mode_task_counter: number;
    public fast_mode_threshold_percent: number;

    constructor(data?: IMidjourneyTaskConditions) {
        this.id = data?.id ?? undefined;
        this.active_tasks_counter = data?.active_tasks_counter ?? 0;
        this.relaxed_mode_task_counter = data?.relaxed_mode_task_counter ?? 0;
        this.fast_mode_task_counter = data?.fast_mode_task_counter ?? 0;
        this.fast_mode_threshold_percent = data?.fast_mode_threshold_percent ?? FAST_MODE_THRESHOLD_PERCENT;
    }

    public static get fastModeThreshold(): number {
        return FAST_MODE_THRESHOLD_PERCENT;
    }

    public updateWith(data: MidjourneyTaskConditionsVO): void {
        this.active_tasks_counter = data.activeCounter.value;
        this.fast_mode_task_counter = data.fastModeCounter.value;
        this.relaxed_mode_task_counter = data.relaxedModeCounter.value;
    }

}

export const ESMidjourneyTaskConditions = new EntitySchema<MidjourneyTaskConditionsEO, ICustomBaseEntity>({
    tableName: 'midjourney_task_conditions',
    class: MidjourneyTaskConditionsEO,
    extends: 'CustomBaseEntity',
    // INFO: The checks here are must to avoid imposing these at higher abstraction levels.
    checks: checks(),
    properties: {
        id: { type: Number, primary: true },
        active_tasks_counter: { type: Number, nullable: false, default: 0 },
        fast_mode_task_counter: { type: Number, nullable: false, default: 0 },
        relaxed_mode_task_counter: { type: Number, nullable: false, default: 0 },
        fast_mode_threshold_percent: {
            type: Number, nullable: false, default: FAST_MODE_THRESHOLD_PERCENT,
        },
    }
});

function checks(): CheckConstraint<MidjourneyTaskConditionsEO>[] {
    return [
        {
            property: 'active_tasks_counter',
            expression: `active_tasks_counter >= 0 AND active_tasks_counter <= ${MAXIMUM_ACTIVE_TASKS}`
        }, {
            property: 'fast_mode_task_counter',
            expression: `fast_mode_task_counter >= 0`
        }, {
            property: 'relaxed_mode_task_counter',
            expression: `relaxed_mode_task_counter >= 0`
        }, {
            property: 'fast_mode_threshold_percent',
            expression: `fast_mode_threshold_percent >= 0`
        },
        {
            // INFO: To prevent adding more than one record.
            property: 'id',
            expression: 'id=1'
        }
    ];
}