'use strict';

import { fileURLToPath, pathToFileURL } from 'node:url';
import { cwd } from 'node:process';
import { configDefaults, defineConfig } from 'vitest/config';

import _excluded from './excluded.js';

const root = pathToFileURL(cwd()).toString();
const excluded = _excluded(configDefaults.exclude);

export default defineConfig({
    plugins: [],
    resolve: {
        alias: {
            '@src': fileURLToPath(new URL(`${root}/src`, import.meta.url)),
            '@tests': fileURLToPath(new URL(`${root}/tests`, import.meta.url)),
            '@fixtures': fileURLToPath(new URL(`${root}/tests/foundation/.ancillary/fixtures`, import.meta.url)),
        }
    },
    test: {
        /**
         * WARNING: To prevent errors from using same temp files in parallel test
         * Could also countermeasure this with dynamic temp files. Will keep as is so far.
         */
        fileParallelism: false,

        /**
         * WARNING: To prevent tests hanging.
         * @see https://vitest.dev/guide/common-errors.html#failed-to-terminate-worker
         */
        pool: 'forks',

        setupFiles: ['./tests/foundation/.ancillary/bootstrap/setup.ts'],
        cache: false,
        reporters: ['verbose'],
        globals: true,
        // NB: Can be configured via TEST_INCLUDE environment variable
        exclude: excluded,
        root: fileURLToPath(new URL('../../../../', import.meta.url)),
        // NB: Something changed in the configuration API. Would look later.
        chaiConfig: {
            truncateThreshold: 200
        },
        coverage: {
            reporter: ['text', 'json', 'html'],
            clean: true,
            include: ['src/**/*.{ts,tsx}'],
            exclude: ['**/*.d.ts', '**/*.types.ts', '**/types.ts', "**/*.*.draft.ts", "**/*.skip.ts", "**/*.*.deprecated.ts", 'src/database/migrations',],
            reportsDirectory: fileURLToPath(new URL(`${root}/tests/foundation/.coverage`)),
            thresholds: {
                lines: 90
            }
        }
    }
});
