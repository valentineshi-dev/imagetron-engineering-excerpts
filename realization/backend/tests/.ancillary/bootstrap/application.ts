'use strict';

import { FastifyInstance } from 'fastify';

import _server from '@src/ddriven/application/bootstrap/server.js';
import { EntityManager, MikroORM, SqliteDriver } from '@mikro-orm/sqlite';
import BootstrapService from '@src/ddriven/application/bootstrap/BootstrapService.js';
import { IncomingMessage, Server, ServerResponse } from 'node:http';
import { Logger } from 'pino';

/**
 * IMPORTANT: As ConfigVO is singleton it may be instantiated before the environment
 * variables are set. If some modules access the ConfigVO unscoped (outside methods or functions)
 * the variables in `process.env` may not exist by the time they are accessed. In this case they
 * will contain their names instead of values.
 * 
 * This is the case with tests. Therefore ConfigVO instantiation must be preceded by
 * `dotenvx` running in the npm script like this. This is preferred mechanism to load environment
 * variables. Test setup should not load env variables.
 * 
 * ``` bash
 * dotenvx run --env-file .env.test -- \"npm run vitest\"
 * ``` 
 */

type TServer = FastifyInstance<Server<typeof IncomingMessage, typeof ServerResponse>, IncomingMessage, ServerResponse<IncomingMessage>, Logger>;

// WARNING: Must follow after the environment loading.
export default async function application(orm: MikroORM<EntityManager<SqliteDriver>>): Promise<{ server: TServer; }> {
    console.log('\n[WARNING]: Test application bootstrap calls the BootstrapService.run().');

    // WARNING: Must precede server initialization
    (new BootstrapService(orm)).run();

    const server = await _server(orm);

    return { server };
}
