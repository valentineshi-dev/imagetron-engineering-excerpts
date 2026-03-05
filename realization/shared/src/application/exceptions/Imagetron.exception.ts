'use strict';

import { EDomainErrorCodes } from '@src/application/exceptions/DomainErrorCodes.enum.js';
import StructuredErrorVO from '@src/application/exceptions/StructuredError.valueobject.js';

/**
 * @group Shared
 * @category Exceptions
 * 
 * The domain-specific exception. Includes {@link structured} getter to provide
 * structured errors.
 * 
 */
export default class ImagetronException extends Error {

    public readonly code?: EDomainErrorCodes;
    public metadata?: Record<string, any>;

    constructor(message: string, code?: EDomainErrorCodes, metadata?: Record<string, any>, originalError?: Error) {
        const originalMessage = originalError ? ` (original message: ${originalError.message})` : '';

        super(`${message}${originalMessage}`);

        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ImagetronException);
        }

        this.name = this.constructor.name;
        this.code = code;
        this.metadata = metadata;
    }

    /**
     * Creates the structured error value object.
     * 
     * @usage
     * ```
     * //...
     * } catch (error) {
     *   if (!(error instanceof ImagetronException)) { throw error; }
     *   if (!error.structured) { throw new ImagetronException('Unexpected missing structured error'); }
     * 
     *   return await reply.code(error.structured!.status as keyof NRunMidjourneyImagineCommand.IRouteDescriptor['Reply']).send(error.structured);
     * // ...
     * ```
     */
    public get structured(): StructuredErrorVO | null {
        if (!this.code) { return null; }

        const pojo = {
            code: this.code,
            message: this.message,
            metadata: this.metadata
        };

        return new StructuredErrorVO(pojo);
    }

}