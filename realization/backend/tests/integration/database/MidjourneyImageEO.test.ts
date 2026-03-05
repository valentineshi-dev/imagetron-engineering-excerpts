'use strict';

import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { MidjourneyImageFactory } from '@src/database/seeding/MidjourneyImage.factory.js';

import database from '@tests/foundation/.ancillary/bootstrap/database.js';
import application from '@tests/foundation/.ancillary/bootstrap/application.js';
import { MidjourneyImageEO } from '@src/database/schema/MidjourneyImage.schema.js';

const { orm, em } = await database();
const { server } = await application(orm);

describe('[integration] MidjourneyImageEOTest', () => {

    beforeEach(async () => {
        await orm.schema.refreshDatabase();

        em.clear();
    });

    afterAll(async () => {
        await orm.close(true);
        await server.close();
    });

    describe('+timestamp(): Should contain expected value', () => {

        it('Should contain 0', () => {
            const actual = new MidjourneyImageFactory(em).makeEntity();

            expect(actual.timestamp).toEqual(0);
        });

        it('Should not be older than 1 second', async () => {
            const image = await new MidjourneyImageFactory(em).createOne();

            const actual = (Date.now() - image.timestamp) / 1000;

            expect(actual).toBeLessThan(1);
        });

    });

    describe('+is_locked: Should behave as expected', () => {

        it.each(dataProvider_is_locked())('Case #%# $name', async (data) => {
            const image = await data.image();

            const actual = image.is_locked;

            expect(actual).toEqual(data.expected);

        });

        function dataProvider_is_locked() {
            const undefinedUpdatedAt = (): MidjourneyImageEO => { return new MidjourneyImageFactory(em).makeEntity(); };
            const younger = async (): Promise<MidjourneyImageEO> => { return await new MidjourneyImageFactory(em).createOne(); };
            const older = async (): Promise<MidjourneyImageEO> => {
                const image = await new MidjourneyImageFactory(em).createOne();
                image.updated_at = new Date(Date.now() - 56 * 60 * 1000);
                return image;
            };

            return [
                { name: 'Undefined "updated_at" -> false', image: undefinedUpdatedAt, expected: false },
                { name: 'Younger than 55 minutes -> false', image: younger, expected: false },
                { name: 'Older than 55 minutes -> true', image: older, expected: true },
            ];
        }


    });

    it('+timestamp: Can be assigned after load', async () => {
        const actual = await new MidjourneyImageFactory(em).createOne();

        actual.url = 'http://localhost';
    });

});