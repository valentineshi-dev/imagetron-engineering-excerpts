'use strict';

import { FastifyInstance } from 'fastify';
import { EntityManager, MikroORM, SqliteDriver } from '@mikro-orm/sqlite';
import { container } from 'tsyringe';
import { Logger } from 'pino';

import { ImplementationContractOutlet } from '@wherejuly/imagetron-backend-contract';

import { LOGGER } from '@src/ddriven/application/abstractions/di.types.js';

export default class ABaseHTTPAdapter {

    protected readonly contract: ImplementationContractOutlet;
    protected readonly logger: Logger;
    protected readonly server: FastifyInstance;
    protected readonly orm: MikroORM<EntityManager<SqliteDriver>>;
    

    constructor(server: FastifyInstance, orm: MikroORM<EntityManager<SqliteDriver>>) {
        this.contract = container.resolve(ImplementationContractOutlet);
        this.logger = container.resolve(LOGGER);
        this.server = server;
        this.orm = orm;
    }

}