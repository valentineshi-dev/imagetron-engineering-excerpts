'use strict';

import { container } from 'tsyringe';

import { IMidjourneyTaskConditions } from '@src/database/schema/MidjourneyTaskConditions.schema.js';
import ConfigVO from '@src/ddriven/application/configuration/Config.valueobject.js';
import ActiveTaskCounterVO from '@src/ddriven/domain/images/model/midjourney/task/conditions/ActiveTaskCounter.valueobject.js';
import GenerationModeTaskCounterVO from '@src/ddriven/domain/images/model/midjourney/task/conditions/GenerationModeTaskCounter.valueobject.js';
import { CImages } from '@wherejuly/imagetron-backend-contract';
import { ImageGenerationPromptEO } from '@src/database/schema/ImageGenerationPrompt.schema.js';
import { ImagetronException } from '@wherejuly/imagetron-shared';

export default class MidjourneyTaskConditionsVO {

    public id?: number;

    public readonly _fast_mode_threshold_percent: number;

    private readonly _active_counter: ActiveTaskCounterVO;
    private readonly _fast_mode_counter: GenerationModeTaskCounterVO;
    private readonly _relaxed_mode_counter: GenerationModeTaskCounterVO;

    #total_task_mode_counter: number;

    constructor(pojo?: IMidjourneyTaskConditions) {
        const config = container.resolve(ConfigVO).get('domain');

        this.id = pojo?.id;
        this._fast_mode_threshold_percent = config.midjourney.fast_mode_threshold_percent;

        /**
         * NB: Delegate rules enforcement and operations to dedicated objects.
         * 
         * @see {@link ActiveTaskCounterVO}, {@link GenerationModeTaskCounterVO}
         * docs for more information.
         */
        this._active_counter = new ActiveTaskCounterVO(pojo?.active_tasks_counter ?? 0);
        this._relaxed_mode_counter = new GenerationModeTaskCounterVO(pojo?.relaxed_mode_task_counter ?? 0);
        this._fast_mode_counter = new GenerationModeTaskCounterVO(pojo?.fast_mode_task_counter ?? 0);

        this.#total_task_mode_counter = this.fastModeCounter.value + this.relaxedModeCounter.value;
    }

    public get activeCounter(): ActiveTaskCounterVO {
        return this._active_counter;
    }
    public get fastModeCounter(): GenerationModeTaskCounterVO {
        return this._fast_mode_counter;
    }

    public get relaxedModeCounter(): GenerationModeTaskCounterVO {
        return this._relaxed_mode_counter;
    }

    public canAddTask(): boolean {
        return this.activeCounter.canAddTask();
    }

    /**
     * Calculate the current Fast / (Fast + Relaxed) ratio.
     * If Fast is below threshold, use Fast; otherwise, use Relaxed.
     */
    public expectFastMode(): boolean {
        // For month start when counters reset to 0
        if (!this.fastModeCounter.value && !this.relaxedModeCounter.value) { return true; }

        const actualFastModeTaskShare = this.fastModeCounter.value / this.#total_task_mode_counter;

        return actualFastModeTaskShare <= this._fast_mode_threshold_percent / 100;
    }

    public getImageGenerationMode(): CImages.EMidjourneyImageGenerationMode {
        return this.expectFastMode() ? CImages.EMidjourneyImageGenerationMode.Fast :
            CImages.EMidjourneyImageGenerationMode.Relaxed;
    }

    public incrementRespectiveModeCounter(prompt: ImageGenerationPromptEO): void {
        if (!prompt.mode) {
            throw new ImagetronException(`Cannot run counter mode increment command when prompt mode is not set ("${prompt.mode}").`);
        }
        
        const incrementCommands = [
            () => { return prompt.mode === CImages.EMidjourneyImageGenerationMode.Fast ? this.fastModeCounter.increment : null; },
            () => { return prompt.mode === CImages.EMidjourneyImageGenerationMode.Relaxed ? this.relaxedModeCounter.increment : null; },
        ] as const;

        const command = incrementCommands.reduce((accumulator: (() => number) | null, current: typeof incrementCommands[number]) => {
            return current() ?? accumulator;
        }, null);


        command!();
    }

}