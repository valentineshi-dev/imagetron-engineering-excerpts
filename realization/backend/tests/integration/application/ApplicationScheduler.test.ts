'use strict';

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import database from '@tests/foundation/.ancillary/bootstrap/database.js';
import application from '@tests/foundation/.ancillary/bootstrap/application.js';
import { EntityManager } from '@mikro-orm/sqlite';
import { MidjourneyTaskConditionsFactory } from '@src/database/seeding/MidjourneyTaskConditions.factory.js';
import { MidjourneyTaskConditionsEO } from '@src/database/schema/MidjourneyTaskConditions.schema.js';

const { orm, em } = await database();

describe('[integration] ApplicationSchedulerTest', () => {

    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('+Should reset the MidjourneyTaskConditionsEO task mode counters on 1st minute of 1st of each month', async () => {
        const minutes = (minutes: number) => { return minutes * 60000; };

        await orm.schema.refreshDatabase();
        await prepareConditionsRecord(em);
        const before = await em.findOne(MidjourneyTaskConditionsEO, { id: 1 });

        expect(before!.id).to.equal(1);
        expect(before!.relaxed_mode_task_counter).to.equal(10);
        expect(before!.fast_mode_task_counter).to.equal(7);

        em.clear();

        // Set the time to the 3rd minute of the 1st day of the month (e.g., Feb 1st, 00:01)
        vi.setSystemTime(new Date(2025, 1, 1, 0, 3));

        // NB: Bootstrap application to engaged its scheduler after mocking system time above.
        const { server } = await application(orm);

        vi.advanceTimersByTime(minutes(2));

        // Wait 1 second all processes to settle
        await vi.waitFor(() => { });

        const actual = await em.findOne(MidjourneyTaskConditionsEO, { id: 1 });

        expect(actual!.id).to.equal(1);
        expect(actual!.relaxed_mode_task_counter).to.equal(0);
        expect(actual!.fast_mode_task_counter).to.equal(0);

        await orm.close(true);
        await server.close();
    });

});

const prepareConditionsRecord = async (em_: EntityManager) => {
    const em = em_.fork();
    const fixture = { relaxed_mode_task_counter: 10, fast_mode_task_counter: 7 };
    const conditions = await new MidjourneyTaskConditionsFactory(em).createOne(fixture);
    await em.persistAndFlush(conditions);
};
