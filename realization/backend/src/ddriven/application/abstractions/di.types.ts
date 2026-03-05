'use strict';

import { InjectionToken } from 'tsyringe';
import { FastifyInstance } from 'fastify';
import { Logger } from 'pino';

/**
 * The Fastify server instance DI container token.
 * 
 * @group Application
 * @category DI Container
 */
type TServer = InjectionToken<FastifyInstance>;
export const SERVER: TServer = Symbol('SERVER');

/**
 * The Fastify logger token.
 * 
 * @group Application
 * @category DI Container
 */
type TLogger = InjectionToken<Logger>;
export const LOGGER: TLogger = Symbol('LOGGER');
