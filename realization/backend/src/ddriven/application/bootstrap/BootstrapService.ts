'use strict';

import { container } from "tsyringe";
import { Ajv } from 'ajv';
import schedule from 'node-schedule';
import { SqliteDriver, EntityManager } from '@mikro-orm/sqlite';
import { MikroORM } from '@mikro-orm/core';
import ajv from './ajv.js';
import { Logger, LoggerOptions, pino } from 'pino';

import { ImplementationContractOutlet, TContractSchemas } from '@wherejuly/imagetron-backend-contract';
import { ApplicationEventBus } from '@wherejuly/imagetron-shared';

import definitions from '@wherejuly/imagetron-backend-contract/definitions' with { type: 'json' };
import parameters from '@wherejuly/imagetron-backend-contract/parameters' with { type: 'json' };

import { LOGGER } from '@src/ddriven/application/abstractions/di.types.js';
import ConfigVO from '@src/ddriven/application/configuration/Config.valueobject.js';
import { TEnvironmentConfig } from '@src/ddriven/application/abstractions/config.types.js';
import AxiosAPITransport, { IAxiosConfig } from '@src/ddriven/application/ports/adapters/outgoing/http/AxiosAPITransport.js';
import { EHTTPHeaders, EMakerTokenSchemes, HTTPHeadersConvenience } from 'http-convenience-pack';
import ChatGPTAPIFacade from '@src/ddriven/ports/adapters/outgoing/http/ChatGPTAPI.facade.js';
import APIKeyFastifyMiddleware from '@src/ddriven/application/ports/adapters/incoming/APIKeyFastifyMiddleware.js';
import { MidjourneyTaskConditionsRepository } from '@src/ddriven/ports/adapters/outgoing/database/MidjourneyTaskConditions.repository.js';
import GoAPIFacade from '@src/ddriven/ports/adapters/outgoing/http/goapi/GoAPI.facade.js';
import WebhookAuthorizationMiddleware from '@src/ddriven/application/ports/adapters/incoming/WebhookAuthorization.middleware.js';
import { APPLICATION_EVENT_BUS, ORM } from '@src/ddriven/application/abstractions/events.types.js';
import { MidjourneyTaskConditionsEO } from '@src/database/schema/MidjourneyTaskConditions.schema.js';
import LoggerService from '@src/ddriven/application/bootstrap/Logger.service.js';
import GoAPITaskEventHandlersService from '@src/ddriven/application/bootstrap/GoAPITaskEventHandlers.service.js';

/**
 * The application bootstrap service. Initializes the DI container content.
 * Does not bootstrap the application server that is bootstrapped separately in {@link server}.
 * 
 * @usage await BootstrapService.run()
 * 
 * @group Application
 * @category Bootstrap
 * 
 * @static run The only API available to run the service.
 * @private constructor Intentionally hidden to expose only static `run()` method.
 */
export default class BootstrapService {

    readonly #config: TEnvironmentConfig; // NOSONAR
    readonly #orm: MikroORM<SqliteDriver>;
    readonly #logger: Logger;

    constructor(orm: MikroORM<SqliteDriver>) {
        this.#config = container.resolve(ConfigVO).get();
        this.#orm = orm;

        // NB: Must precede other registrations using logger
        this.#logger = container.resolve(LoggerService).logger;
    }

    /**
     * Bootstrap the synchronous parts.
     */
    public run(): void {
        container.register(ORM, { useFactory: () => this.#orm });
        container.register(Ajv, { useValue: ajv() });
        container.registerSingleton(APPLICATION_EVENT_BUS, ApplicationEventBus);

        // WARNING: Registers the event on the bus instance that cannot be overridden by tests.
        container.resolve(GoAPITaskEventHandlersService);

        // WARNING: Refactor to `useFactory` to avoid clearing with `container.clearInstances()` in tests
        container.registerInstance<APIKeyFastifyMiddleware>(APIKeyFastifyMiddleware, new APIKeyFastifyMiddleware([this.#config.imagetron.api_key]));
        container.registerInstance<WebhookAuthorizationMiddleware>(WebhookAuthorizationMiddleware, new WebhookAuthorizationMiddleware());

        this.registerImplementationContract();

        this.bootstrapCHATGPTAPIFacade();
        this.bootstrapGoAPIFacade();

        this.startScheduler(this.#orm.em.fork());
    }

    public async runAsync(): Promise<void> {
        await this.createMidjourneyTaskConditions();
    }

    public registerLogger(): void {
        const createProductionLogger = () => this.#config.logger === true ? pino() : undefined;
        const createSilentLogger = () => this.#config.logger === false ? pino({ level: 'silent' }) : undefined;

        const logger = createProductionLogger() ?? createSilentLogger() ?? pino(this.#config.logger as LoggerOptions);

        container.register<Logger>(LOGGER, { useFactory: () => logger });
    }

    private registerImplementationContract(): void {
        const _contract = { definitions, parameters } as unknown as TContractSchemas;
        const contract = new ImplementationContractOutlet(_contract);

        contract.acceptImplementationVersionOrThrow(process.env.npm_package_version!);

        container.registerInstance(ImplementationContractOutlet, contract);

        this.#logger.info(`The contract is registered (implementation version: "${process.env.npm_package_version}").`);
    }

    private bootstrapCHATGPTAPIFacade(): void {
        const config = this.#config.chatgpt;
        const transportConfig: IAxiosConfig = {
            baseURL: config.base_url,
            customHeaders: HTTPHeadersConvenience.make(EHTTPHeaders.Authorization, EMakerTokenSchemes.Bearer, config.api_key)
        };

        const chatGPTAPITransport = new AxiosAPITransport(transportConfig);

        container.registerInstance<ChatGPTAPIFacade>(ChatGPTAPIFacade, new ChatGPTAPIFacade(chatGPTAPITransport));
    }

    private bootstrapGoAPIFacade(): void {
        const config = this.#config.apis.goapi;
        const transportConfig: IAxiosConfig = {
            baseURL: config.base_url,
            customHeaders: { 'x-api-key': config.api_key }
        };

        const goapiTransport = new AxiosAPITransport(transportConfig);

        container.registerInstance<GoAPIFacade>(GoAPIFacade, new GoAPIFacade(goapiTransport));
    }

    private startScheduler(em: EntityManager): void {
        /**
         * Runs at the 1st minute (minute 1) of the 1st day of every month.
         * Cron format: '1 0 1 * *'
         * - 5  → Minute (5th minute)
         * - 0  → Hour (midnight)
         * - 1  → Day of the month (1st day)
         * - *  → Any month
         * - *  → Any day of the week
         */
        const RESET_MIDJOURNEY_TASK_COUNTER_SETTINGS = '5 0 1 * *';

        schedule.scheduleJob(RESET_MIDJOURNEY_TASK_COUNTER_SETTINGS, async () => {
            await MidjourneyTaskConditionsRepository.resetGenerationModeTaskCounters(em);
        });

        this.#logger.info(`The application scheduler is started.`);

    }

    private async createMidjourneyTaskConditions(): Promise<void> {
        const repository = new MidjourneyTaskConditionsRepository(this.#orm.em.fork(), MidjourneyTaskConditionsEO.name);

        await repository.createIfNotExist();
    }

}