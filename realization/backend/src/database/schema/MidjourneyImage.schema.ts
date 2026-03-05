'use strict';

import { EntitySchema } from '@mikro-orm/core';

import { CGoAPI, CImages } from '@wherejuly/imagetron-backend-contract';

import { ICustomBaseEntity } from './CustomBaseEntity.schema.js';

export const GOAPI_TASK_TYPE_TO_IMAGE_TYPE: Record<CGoAPI.ETaskType, CImages.EImageType> = {
    [CGoAPI.ETaskType.Imagine]: CImages.EImageType.Variation,
    [CGoAPI.ETaskType.Reroll]: CImages.EImageType.Variation,
    [CGoAPI.ETaskType.Variation]: CImages.EImageType.Variation,
    [CGoAPI.ETaskType.Upscale]: CImages.EImageType.Upscaled,
    
    /**
     * WARNING: This item must not be used in Imagetron code.
     * @see http://localhost:3000/#/schemas/goapi-task-type
     */
    [CGoAPI.ETaskType.upscale_creative]: CImages.EImageType.Upscaled,
} as const;

export interface IMidjourneyImage extends ICustomBaseEntity {
    uuid: string;
    midjourney_index: number; // NB: The 1-based Midjourney variation index

    prompt_uuid: string;
    task_uuid: string;

    name: string;
    source_url: string;
    url: string | null;
    type: CImages.EImageType;
    is_persisted: boolean;
    error_message: string | null;
    updated_at?: Date | null;
}

/**
 * The Midjourney image entity object.
 * 
 * Suggests saving records with successful as well as errored images to make
 * error treatment possible later.
 * 
 * @see {source_url}
 * @see {is_persisted}
 * @see {error_message}
 */
export class MidjourneyImageEO implements IMidjourneyImage, CImages.ImageItem {

    // NB: UUID here is the name of the image file saved on S3. Created at image upload time.
    public uuid: string;
    public midjourney_index: number;

    public prompt_uuid: string;
    public task_uuid: string;

    public name: string;

    /**
     * INFO: Source URL for potential manual use in errors case.
     * @see {is_persisted}
     */
    public source_url: string;
    public url: string | null;

    public type: CImages.EImageType;

    /**
     * @property {is_persisted}
     * 
     * INFO: With this property properties the image becomes kind of null-object.
     * 
     * This allows to finish upload process for all images and postpone error treatment 
     * for some (if any). For errored images we may show placeholder image, allow user to copy 
     * its source URL, download and save the image manually within its existence window.
     * 
     * @see {source_url}
     * @see {error_message}
     */
    public is_persisted: boolean;
    public error_message: string | null;

    public updated_at?: Date | null;

    constructor(data: IMidjourneyImage) {
        this.uuid = data.uuid ?? undefined;
        this.midjourney_index = data.midjourney_index;

        this.prompt_uuid = data.prompt_uuid;
        this.task_uuid = data.task_uuid;

        this.name = data.name;
        this.source_url = data.source_url;
        this.url = null;
        this.url = null;
        this.type = data.type;
        this.is_persisted = data.is_persisted;
        this.error_message = data.error_message;
    }

    /**
     * Used on client to calculate the time remaining to lock image.
     */
    public get timestamp(): number {
        return this.updated_at ? this.updated_at.getTime() : 0;
    }

    /**
     * True if the image was updated earlier than 55 minutes ago.
     * 
     * Due to GoAPI Midjourney operations window limit
     * @see https://goapi.ai/docs/technical-questions#pay-per-use-ppu-option
     */
    public get is_locked(): boolean {
        if (!this.updated_at) return false;

        const now = new Date();
        const diffInMinutes = (now.getTime() - this.updated_at.getTime()) / 60000;
        return diffInMinutes > 55;
    }

}

export const ESMidjourneyImage = new EntitySchema<MidjourneyImageEO, ICustomBaseEntity>({
    tableName: 'midjourney_images',
    class: MidjourneyImageEO,
    extends: 'CustomBaseEntity',
    properties: {
        uuid: { type: 'uuid', primary: true, nullable: false },
        midjourney_index: { type: 'number', nullable: false },
        prompt_uuid: { type: 'uuid' },
        task_uuid: { type: 'uuid' },
        name: { type: 'text', nullable: false },
        source_url: { type: 'text', nullable: false },
        type: { enum: true, items: () => { return CImages.EImageType; } },
        is_persisted: { type: Boolean, default: false, nullable: false },
        error_message: { type: 'text', nullable: true },

        url: { type: "string", nullable: true },
        // NB: These 2 properties are computed set after the entity is loaded from the database
        timestamp: { type: 'method', persist: false, getter: true },
        is_locked: { type: 'method', persist: false, getter: true },
    }
});