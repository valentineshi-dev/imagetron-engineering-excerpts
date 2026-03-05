'use strict';

import S3Adapter from '@src/ddriven/ports/adapters/outgoing/s3/S3.adapter.js';
import { describe, expect, it } from 'vitest';

describe('[external] S3AdapterTest', () => {

    // NB: Will add more 
    it('+constructor(): Should create S3Adapter expected object', () => {
        const actual = new S3Adapter();

        expect(actual).toBeInstanceOf(S3Adapter);

        expect(actual.save).toBeInstanceOf(Function);
        expect(actual.read).toBeInstanceOf(Function);
        expect(actual.delete).toBeInstanceOf(Function);
    });

    it('+save(): Should create S3Adapter expected object', async () => {
        const s3 = new S3Adapter();

        const actual = await s3.save('other.txt', 'Hello S3!');

        expect(actual.httpStatusCode).toEqual(200);
    });

});
