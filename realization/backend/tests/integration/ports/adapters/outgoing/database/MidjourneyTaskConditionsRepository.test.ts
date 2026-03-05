'use strict';

import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { container } from 'tsyringe';
import { EntityManager } from '@mikro-orm/sqlite';

import ConfigVO from '@src/ddriven/application/configuration/Config.valueobject.js';

import application from '@tests/foundation/.ancillary/bootstrap/application.js';
import database from '@tests/foundation/.ancillary/bootstrap/database.js';

import { MidjourneyTaskConditionsRepository } from '@src/ddriven/ports/adapters/outgoing/database/MidjourneyTaskConditions.repository.js';
import { MidjourneyTaskConditionsEO } from '@src/database/schema/MidjourneyTaskConditions.schema.js';
import { MidjourneyTaskConditionsFactory } from '@src/database/seeding/MidjourneyTaskConditions.factory.js';

const { orm, em } = await database();
const { server } = await application(orm);

const config = container.resolve(ConfigVO).get('domain');

describe('[integration] MidjourneyTaskConditionsRepositoryTest', () => {

    beforeEach(async () => {
        await orm.schema.refreshDatabase();
        em.clear();
    });

    afterAll(async () => {
        await orm.close(true);
        await server.close();
    });

    it('+constructor(): Should create MidjourneyTaskConditionsRepository expected object', () => {
        const actual = new MidjourneyTaskConditionsRepository(em, MidjourneyTaskConditionsEO.name);

        expect(actual).toBeInstanceOf(MidjourneyTaskConditionsRepository);
        expect(actual.createIfNotExist).toBeInstanceOf(Function);
        expect(actual.getSingleOrThrow).toBeInstanceOf(Function);
    });

    it('+createIfNotExist(): Should create the expected MidjourneyTaskConditionsEO single record in the DB', async () => {
        const repository = new MidjourneyTaskConditionsRepository(em, MidjourneyTaskConditionsEO.name);

        // NB: First create one.
        await repository.createIfNotExist();

        // NB: Then check it is created
        const actual = await repository.getSingleOrThrow();

        expect(actual.entity.id).toEqual(1);
        expect(actual.entity.active_tasks_counter).toEqual(0);
        expect(actual.entity.fast_mode_task_counter).toEqual(0);
        expect(actual.entity.fast_mode_threshold_percent).toEqual(config.midjourney.fast_mode_threshold_percent);
        expect(actual.entity.relaxed_mode_task_counter).toEqual(0);

        // NB: Then check it is not created if exists
        await repository.createIfNotExist();
        const actual_count = await repository.count();
        expect(actual_count).toEqual(1);
    });

    // Assert: it adds counters and then reset at month start.

    it('+resetGenerationModeTaskCounters(): Should reset counters', async () => {
        await seedConditionsRecord(em);

        em.clear();

        // NB: Check the conditions persisted successfully
        const repository1 = new MidjourneyTaskConditionsRepository(em, MidjourneyTaskConditionsEO.name);
        const conditions = await repository1.getSingleOrThrow();

        expect(conditions.entity.id).toEqual(1);
        expect(conditions.entity.relaxed_mode_task_counter).toEqual(10);
        expect(conditions.entity.fast_mode_task_counter).toEqual(7);

        // NB: Check: zero after running SUT
        await MidjourneyTaskConditionsRepository.resetGenerationModeTaskCounters(em);

        em.clear();

        const repository2 = new MidjourneyTaskConditionsRepository(em, MidjourneyTaskConditionsEO.name);
        const actual = await repository2.getSingleOrThrow();

        expect(actual.entity.id).toEqual(1);
        expect(actual.entity.relaxed_mode_task_counter).toEqual(0);
        expect(actual.entity.fast_mode_task_counter).toEqual(0);
    });

    it('+getSingleOrThrow(): Should return both entity and value object', async () => {
        const expected = config.midjourney;

        await seedConditionsRecord(em);
        const repository = new MidjourneyTaskConditionsRepository(em, MidjourneyTaskConditionsEO.name);

        const actual = await repository.getSingleOrThrow();

        expect(actual).toHaveProperty('entity');
        expect(actual).toHaveProperty('valueObject');

        // REFACTOR: May move the value object creation to move to the value object test some time. 
        expect(actual.entity.id).toEqual(1);
        expect(actual.entity.active_tasks_counter).toEqual(3);
        expect(actual.entity.fast_mode_threshold_percent).toEqual(expected.fast_mode_threshold_percent);
        expect(actual.entity.relaxed_mode_task_counter).toEqual(10);
        expect(actual.entity.fast_mode_task_counter).toEqual(7);

        expect(actual.valueObject.id).toEqual(actual.entity.id);
        expect(actual.valueObject.activeCounter.value).toEqual(actual.entity.active_tasks_counter);
        expect(actual.valueObject.fastModeCounter.value).toEqual(actual.entity.fast_mode_task_counter);
        expect(actual.valueObject.relaxedModeCounter.value).toEqual(actual.entity.relaxed_mode_task_counter);

        expect(actual.valueObject.canAddTask()).toEqual(true);
        expect(actual.valueObject.expectFastMode()).toEqual(false);
    });

});

const seedConditionsRecord = async (em_: EntityManager) => {
    const em = em_.fork();
    const fixture = { active_tasks_counter: 3, relaxed_mode_task_counter: 10, fast_mode_task_counter: 7 };
    const conditions = await new MidjourneyTaskConditionsFactory(em).createOne(fixture);
    await em.persistAndFlush(conditions);
};