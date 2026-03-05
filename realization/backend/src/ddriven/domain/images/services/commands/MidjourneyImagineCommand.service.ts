'use strict';

import { EntityManager } from '@mikro-orm/sqlite';
import { container } from 'tsyringe';

import { EDomainErrorCodes, ImagetronException } from '@wherejuly/imagetron-shared';

import { ImageGenerationPromptEO } from '@src/database/schema/ImageGenerationPrompt.schema.js';
import { MidjourneyTaskConditionsEO } from '@src/database/schema/MidjourneyTaskConditions.schema.js';
import { MidjourneyTaskConditionsRepository } from '@src/ddriven/ports/adapters/outgoing/database/MidjourneyTaskConditions.repository.js';
import { CGoAPI, CImages, CPrompts } from '@wherejuly/imagetron-backend-contract';
import GoAPIFacade from '@src/ddriven/ports/adapters/outgoing/http/goapi/GoAPI.facade.js';
import { MidjourneyTaskEO } from '@src/database/schema/MidjourneyTask.schema.js';
import AMidjourneyCommandService from '@src/ddriven/domain/images/services/commands/AMidjourneyCommand.service.js';

export default class MidjourneyImagineCommandService extends AMidjourneyCommandService {

    constructor(em: EntityManager) {
        super(em);
    }

    /**
     * Assess the inputs, send the the `imagine` task to GoAPI and reflect the prompt state
     * in the prompt and newly created MidjourneyTaskEO.
     * 
     * @see {@link https://github.com/WhereJuly/63-imagetron/blob/construct/backend/develop/packages/backend/implementation/.a%26cd/model/use-cases/images/generate-versions-imagine/endpoint.md#sequence-diagram}
     */
    public async imagine(promptUUID: string): Promise<ImageGenerationPromptEO> {
        const MAXIMUM_ACTIVE_TASKS = this._config.midjourney.maximum_active_tasks;
        const command = CGoAPI.ETaskType.Imagine;

        const prompt = await this._promptRepository.findOneOrThrow(promptUUID);

        /**
         * The prompt is expected to arrive with `CPrompts.EImageGenerationPromptStatus.New`
         * NB: This will throw domain exception with required error code for invalid state transition.
         */
        prompt.isValidTransition(CPrompts.EImageGenerationPromptStatus.GenerationAwait, true);

        if (!prompt.isRootCommandAllowed(command as unknown as CImages.EMidjourneyRootCommands.Imagine)) {
            throw new ImagetronException(`The given Midjourney command is not allowed: "${command}"`, EDomainErrorCodes.MIDJOURNEY_COMMAND_NOT_ALLOWED);
        }

        /**
         * NB: Effectively making a queue managed by database with MidjourneyTaskConditionsEO
         * pessimistic lock on `.getSingleOrThrow()` method.
         */
        await this._em.transactional(async (em) => {
            const taskConditionsRepository = new MidjourneyTaskConditionsRepository(em, MidjourneyTaskConditionsEO.name);

            const conditions = await taskConditionsRepository.getSingleOrThrow(em);

            if (!conditions.valueObject.canAddTask()) {
                throw new ImagetronException(`Cannot add more than "${MAXIMUM_ACTIVE_TASKS}" tasks. Wait a little for a queue to drain.`, EDomainErrorCodes.ACTIVE_TASK_QUEUE_IS_FULL);
            }

            const { route: webhookRoute } = this._consumerContract.actualFor(this._contract.webhookHandleMidjourneyCommandTaskResults, { uuid: prompt.uuid, command });
            const goapiFacade = container.resolve(GoAPIFacade);
            const response = await goapiFacade.imagine(webhookRoute, prompt.content, conditions.valueObject.getImageGenerationMode());

            this.throwForGoAPIError(response);

            this.throwForGoAPITaskFailure(response);

            // Create MidjourneyTaskEO
            // Update with response payload
            // REFACTOR: To MidjourneyTaskEO.fromGoAPIResponse()
            const task = em.create(MidjourneyTaskEO, { prompt, goapi_task_uuid: response.content.data.task_id, command, status: response.content.data.status });

            // Update ImageGenerationPromptEO
            prompt.generate();
            prompt.mode = conditions.valueObject.getImageGenerationMode();
            prompt.midjourney_commands = {
                latest: CImages.EMidjourneyLatestCommands.Imagine,
                allowed_root: CImages.EMidjourneyRootCommands.Reroll
            };
            prompt.tasks.add(task);

            // Update MidjourneyTaskConditionsVO, and EO consequently.
            conditions.valueObject.activeCounter.increment();
            conditions.valueObject.incrementRespectiveModeCounter(prompt);
            conditions.entity.updateWith(conditions.valueObject);

            // NB: Update all the entities in the DB in a transaction
            em.persist(prompt); // NB: Prompt will persist its tasks relation
            em.persist(conditions.entity);

            this._logger.info(`${this.constructor.name} added the "${command}" task UUID ${task.goapi_task_uuid} (status: "${task.status}") to prompt UUID "${prompt.uuid}"`);
        });


        // WARNING: I could not make tasks to become initialized in the transaction. This seems to be a workaround.
        return await this._em.findOneOrFail(ImageGenerationPromptEO, { uuid: promptUUID }, { populate: ['*'] });
    }

}