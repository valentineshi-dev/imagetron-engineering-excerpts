'use strict';

import { EntityManager } from '@mikro-orm/sqlite';
import * as Sentry from "@sentry/node";

import { CGoAPI } from '@wherejuly/imagetron-backend-contract';

import { ImageGenerationPromptEO } from '@src/database/schema/ImageGenerationPrompt.schema.js';
import { GoAPITaskReturnedEventVO } from '@src/ddriven/application/events/GoAPITaskReturnedEvent.valueobject.js';
import AMidjourneyResultsService from '@src/ddriven/domain/images/services/results/AMidjourneyResults.service.js';

export default class MidjourneyImagineResultsService extends AMidjourneyResultsService {

    constructor(em: EntityManager) {
        super(em);
    }

    public async run(event: GoAPITaskReturnedEventVO): Promise<void> {
        let prompt: ImageGenerationPromptEO;

        // NB: Retrieve the respective prompt with task on our side. Report errors if nothing found
        try {
            prompt = await this._promptRepository.findOneWithTaskUUID(event.payload.prompt_uuid, event.payload.data.task_id, CGoAPI.ETaskType.Imagine, CGoAPI.ETaskResultStatus.Pending);
        } catch (_error) {
            // WRITE: Actually report any error that is thrown here.
            // WRITE: const event = new ApplicationLogEventVO('Prompt UUID not found', sentry=true)
            // WRITE: [Pino & Sentry] bus.emit(ApplicationLogEventVO.identity, event) 
            const message = 'Cannot find the prompt';

            this._logger.error({ error: _error }, message);
            Sentry.captureException(_error, { extra: { message } });

            return;
        }

        // NB: The preceding .findOneWithTask ensures there is prompt with only 1 required task
        const task = prompt.tasks[0]!;

        // NB: Process the unexpected case where the coming GoAPI task is failed.
        if (event.isGoAPITaskInStatus(CGoAPI.ETaskResultStatus.Failed)) {
            const message = 'Unexpected failed GoAPI task received';

            this._logger.warn({ event }, message);

            Sentry.withScope(scope => {
                scope.setExtra('event', event);
                scope.setLevel('warning');
                Sentry.captureMessage(message);
            });

            return await this.processGoAPITaskFailed(prompt, task);
        }

        // NB: Process all the remaining unexpected GoAPI task statuses except completed
        if (!event.isGoAPITaskInStatus(CGoAPI.ETaskResultStatus.Completed)) {
            // REFACTOR: to const event = new ApplicationLogEventVO('cannot process goapi task with unexpected status', sentry=true)
            // WRITE: [Pino & Sentry] bus.emit(ApplicationLogEventVO.identity, event) 
            const message = `Unexpected failed GoAPI task status: ${event.payload.data.status}`;

            this._logger.warn({ event }, message);

            Sentry.withScope(scope => {
                scope.setExtra('event', event);
                scope.setLevel('warning');
                Sentry.captureMessage(message);
            });

            return;
        }

        // NB: Now we have expected prompt with task on our side and the incoming GoAPI task is completed 

        /**
         * NB: This gets us the images downloaded from GoAPI and persisted on S3
         * If things go wrong with an image (download/upload) it is reflected in the image entity.
         */
        const images = await this._imagesService.downloadAndPersist(prompt, event);

        await this.processImagesPersisted(prompt, task, images);

        // WRITE: const event = new ApplicationLogEventVO('images saved')
        // WRITE: [Pino] bus.emit(ApplicationLogEventVO.identity, event) 
    }

};