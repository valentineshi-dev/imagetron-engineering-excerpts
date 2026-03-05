'use strict';

import { TAllowedEnvironment } from '@src/ddriven/application/configuration/EnvGuardVO.valueobject.js';

/** 
 * The concrete environment configuration.
 * 
 * @group Application
 * @category Configuration
 */
export type TEnvironmentConfig = {
    env: TAllowedEnvironment,
    name: string;
    version: string;
    logger: TLoggerConfig;
    database: TDatabaseConfig;
    ajv: { customOptions: Record<string, any>; standalone: Record<string, any>; };
    imagetron: TImagetronConfig;
    chatgpt: TChatGPTConfig;
    domain: TDomainConfig;
    apis: TAPIsConfig;
    s3: TS3Config;
    cors: { enabled: boolean; origins: string[]; };
    sentry: TSentryConfig;
};

/** 
 * @group Application
 * @category Configuration
 */
export type TLoggerConfig = {
    level?: string;
    transport: {
        target: string;
        options: Record<string, any>;
    };
} | boolean;


/** 
 * @group Application
 * @category Configuration
 */
export type TDatabaseConfig = {
    dbName: string;
    debug?: boolean;
};

/** 
 * @group Application
 * @category Configuration
 */
export type TImagetronConfig = {
    api_key: string;
    base_url: string;
};

/** 
 * @group Application
 * @category Configuration
 */
export type TChatGPTConfig = {
    // REFACTOR: Move to TAPIsConfig chatgpt config
    base_url: string;
    api_key: string;
};

/** 
 * @group Application
 * @category Configuration
 */
export type TDomainConfig = {
    midjourney: {
        maximum_active_tasks: number;
        fast_mode_threshold_percent: number;
    };
};

export type TAPIsConfig = {
    goapi: {
        base_url: string;
        api_key: string;
    };
};

export type TS3Config = {
    region: string;
    bucket_name: string;
    endpoint_url: string;
    access_key: string;
    secret: string;
};

export type TCorsConfig = {
    cors_origins: string;
};

export type TSentryConfig = {
    dsn: string;
};