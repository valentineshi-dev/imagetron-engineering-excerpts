'use strict';

import chalk from 'chalk';

/**
 * NB: Set TEST_INCLUDE=.examples,.explorations to include tests from the basically excluded folders. 
*/
export default function excluded(defaults: string[]) {
    const base = [...defaults, 'e2e/*'];
    const additional = ['**/examples', '**/explorations', '**/integration/.external'];

    const toInclude = process.env.TEST_INCLUDE?.split(',') || [];

    const excluded = additional.filter((_additional: string) => {
        return !toInclude.some((_toInclude: string) => { return _additional.includes(_toInclude); });
    });

    console.log(`[${chalk.blue('INFO')}] Additionally excluded test folders "${excluded.toString()}"`);
    console.log(`[${chalk.blue('INFO')}] Run "npx cross-env TEST_INCLUDE=<folder-a,folder-b,name-part> npm run test:foundation" to include tests from the basically excluded folders.`);

    return base.concat(excluded);
}