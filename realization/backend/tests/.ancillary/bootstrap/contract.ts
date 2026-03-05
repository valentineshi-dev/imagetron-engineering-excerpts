'use strict';

import { container } from 'tsyringe';

import definitions from '@wherejuly/imagetron-backend-contract/definitions' with { type: 'json' };
import parameters from '@wherejuly/imagetron-backend-contract/parameters' with { type: 'json' };

import { ImplementationContractOutlet, TContractSchemas } from '@wherejuly/imagetron-backend-contract';

export function contract(): ImplementationContractOutlet {
    const _contract = { definitions, parameters } as unknown as TContractSchemas;
    const contract = new ImplementationContractOutlet(_contract);

    contract.acceptImplementationVersionOrThrow(process.env.npm_package_version!);

    container.registerInstance(ImplementationContractOutlet, contract);

    return contract;
}