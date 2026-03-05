'use strict';

import { MikroORM } from '@mikro-orm/sqlite';

import ormConfig from '@src/database/mikro-orm.config.js';

export default async function database() {
    const orm = await MikroORM.init(ormConfig);
    const em = orm.em.fork();
    const seeder = orm.getSeeder();

    return { orm, em, seeder };
}