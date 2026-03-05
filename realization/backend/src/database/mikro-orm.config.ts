'use strict';

import { container } from 'tsyringe';

import { defineConfig } from '@mikro-orm/core';
import { SeedManager } from '@mikro-orm/seeder';
import { Migrator } from '@mikro-orm/migrations';
import { SqliteDriver } from '@mikro-orm/sqlite';

import ConfigVO from '../ddriven/application/configuration/Config.valueobject.js';
import { ESCustomBaseEntity } from './schema/CustomBaseEntity.schema.js';
import { ESBook } from './schema/Book.schema.js';
import { ESSubjectsChatMessage } from './schema/SubjectsChatMessage.schema.js';
import { ESImageGenerationPrompt, ImageGenerationPromptEO } from './schema/ImageGenerationPrompt.schema.js';
import { ESMidjourneyTaskConditions } from './schema/MidjourneyTaskConditions.schema.js';
import { ESMidjourneyTask } from './schema/MidjourneyTask.schema.js';
import { ESMidjourneyImage } from './schema/MidjourneyImage.schema.js';

const config = container.resolve(ConfigVO).get('database');

const ormConfig = defineConfig({
    extensions: [Migrator, SeedManager],
    entities: [
        ESCustomBaseEntity, ESBook, ESSubjectsChatMessage, ESImageGenerationPrompt,
        ESMidjourneyTaskConditions, ESMidjourneyTask, ESMidjourneyImage],

    forceEntityConstructor: [ImageGenerationPromptEO],

    driver: SqliteDriver,
    driverOptions: {
        // NB: For a queue of 3 pessimistic lock requests each lasting 1.5 seconds.
        // Will have to log the DB locking handlers execution timing to see the actual figures
        busyTimeout: 5000, 
    },
    dbName: config.dbName,
    forceUtcTimezone: true,

    debug: config.debug === true || false,
    migrations: {
        path: './src/database/migrations',
        tableName: 'system_migrations',
        transactional: true
    },
    seeder: {
        path: './src/database/seeding'
    }
});

export default ormConfig;