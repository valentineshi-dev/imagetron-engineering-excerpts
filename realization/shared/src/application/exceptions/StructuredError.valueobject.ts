'use strict';

import { EDomainErrorCodes } from '@src/application/exceptions/DomainErrorCodes.enum.js';
import { HTTP_STATUSES, IHTTPStatus } from 'http-convenience-pack';

// NB: Make `code` mandatory.
type TSelfPOJO = Omit<StructuredErrorVO, 'metadata' | 'status'> & { metadata: Record<string, any> | undefined; };

/**
 * WRITE: This could be great to keep the error messages along the error codes (thus standardized).
 * 
 * NB: Additionally it would be great to be able to replace the placeholders in the error messages
 * with the actual data.
 */
export default class StructuredErrorVO {

    public status: IHTTPStatus['code'];
    public code: EDomainErrorCodes;
    public message: string;
    public metadata: Record<string, any> | null;

    constructor(exception: TSelfPOJO) {
        const mapped = ERROR_MAP[exception.code];

        this.status = mapped.status;
        this.code = exception.code;
        this.message = exception.message;
        this.metadata = exception.metadata ?? null;
    }

}

const ERROR_MAP: Record<EDomainErrorCodes, { status: number; }> = {
    [EDomainErrorCodes.UNEXPECTED_ERROR]: { status: 470 }, // NB: Use custom unused error code
    [EDomainErrorCodes.PROMPT_NOT_FOUND]: { status: HTTP_STATUSES[404].code },
    [EDomainErrorCodes.ACTIVE_TASK_QUEUE_IS_FULL]: { status: HTTP_STATUSES[409].code },
    [EDomainErrorCodes.INVALID_PROMPT_STATUS_TRANSITION]: { status: HTTP_STATUSES[409].code },
    [EDomainErrorCodes.MIDJOURNEY_COMMAND_NOT_ALLOWED]: { status: HTTP_STATUSES[409].code },
    [EDomainErrorCodes.GOAPI_UNEXPECTED_FAILURE]: { status: HTTP_STATUSES[424].code },
    [EDomainErrorCodes.GOAPI_TASK_FAILURE]: { status: HTTP_STATUSES[424].code }
};