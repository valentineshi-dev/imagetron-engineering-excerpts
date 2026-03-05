# Imagetron Project Engineering Excerpts

> [!IMPORTANT]
> This repository contains my Imagetron project engineering excerpts: models, contract, tests, code, CI/CD, IaC.
>
> The repository contains only roughly 1/5 of the actual code for illustration purposes and for brevity.
>
> See the detailed review in the [Imagetron case study](https://valentineshi.dev/content/deliverables/K3aT7UX_RCC8ZO_fy9VinQ/ai-powered-image-generation-publication-system-imagetron) on my website.

## System characteristics

- Contract-first API (OpenAPI 3.1), enforced across all services.
- Async orchestration (webhook + SSE).
- Explicit domain modeling (C4, UML/PlantUML).
- Idempotent job processing by design.
- Containerized deployment (Docker, Swarm, Traefik)
- 170+ automated tests, coverage > 95%.

<details>

<summary>The Repository Folder Tree</summary>

```text
|   readme.md
|
+---.github
|   \---workflows
|           backend.ci.yml
|           web.ci.yml
|
+---model
|   +---coarse
|   |       container.c4.puml
|   |       general.usecase.puml
|   |
|   +---finer
|   |       imagine-endpoint.sequence.puml
|   |       midjourney-task-conditions.class.puml
|   |       midjourney-task.class.puml
|   |       prompt-statuses.state.puml
|   |       sse-events.sequence.puml
|   |
|   \---subdomains
|           01-prompts.usecase.puml
|           02-image-generation.usecase.puml
|           03-image-upload.usecase.puml
|
\---realization
    +---backend
    |   |   package.json
    |   |
    |   +---src
    |   |   +---config
    |   |   |       ajv.json
    |   |   |       database.json
    |   |   |       domain.json
    |   |   |       logger.json
    |   |   |
    |   |   +---database
    |   |   |   |   mikro-orm.config.ts
    |   |   |   |
    |   |   |   \---schema
    |   |   |           MidjourneyImage.schema.ts
    |   |   |           MidjourneyTaskConditions.schema.ts
    |   |   |
    |   |   \---ddriven
    |   |       +---application
    |   |       |   +---abstractions
    |   |       |   |       ABaseHTTP.adapter.ts
    |   |       |   |       config.types.ts
    |   |       |   |       di.types.ts
    |   |       |   |
    |   |       |   +---bootstrap
    |   |       |   |       BootstrapService.ts
    |   |       |   |
    |   |       |   +---events
    |   |       |   |       GoAPITaskReturnedEvent.valueobject.ts
    |   |       |   |
    |   |       |   \---ports
    |   |       |       \---adapters
    |   |       |           +---incoming
    |   |       |           |       WebhookAuthorization.middleware.ts
    |   |       |           |
    |   |       |           \---outgoing
    |   |       |               \---http
    |   |       |                       AbstractAPIFacade.ts
    |   |       |
    |   |       \---domain
    |   |           \---images
    |   |               +---model
    |   |               |   \---midjourney
    |   |               |       \---task
    |   |               |           \---conditions
    |   |               |                   ActiveTaskCounter.valueobject.ts
    |   |               |                   GenerationModeTaskCounter.valueobject.ts
    |   |               |                   MidjourneyTaskConditions.valueobject.ts
    |   |               |
    |   |               \---services
    |   |                   |   ImagesPersistence.service.ts
    |   |                   |
    |   |                   +---commands
    |   |                   |       MidjourneyImagineCommand.service.ts
    |   |                   |
    |   |                   \---results
    |   |                           MidjourneyImagineResults.service.ts
    |   |
    |   \---tests
    |       +---.ancillary
    |       |   +---bootstrap
    |       |   |       application.ts
    |       |   |       contract.ts
    |       |   |       database.ts
    |       |   |
    |       |   +---config
    |       |   |       excluded.ts
    |       |   |       vitest.config.ts
    |       |   |
    |       |   \---fixtures
    |       |       +---chatgpt
    |       |       |       chatgpt-completions-failure-response.json
    |       |       |
    |       |       \---goapi
    |       |           |   goapi-status-pending-response.json
    |       |           |   goapi-webhook-request-payload.ts
    |       |           |
    |       |           \---images
    |       |                   upscaled-1.png
    |       |                   upscaled-2.png
    |       |                   variation-1.png
    |       |                   variation-2.png
    |       |
    |       +---integration
    |       |   +---.external
    |       |   |   |   PromptsOnChatGPT.external.test.ts
    |       |   |   |
    |       |   |   \---s3
    |       |   |           S3Adapter.test.ts
    |       |   |
    |       |   +---application
    |       |   |       ApplicationScheduler.test.ts
    |       |   |
    |       |   +---database
    |       |   |       MidjourneyImageEO.test.ts
    |       |   |
    |       |   +---domain
    |       |   |   \---images
    |       |   |       \---services
    |       |   |           +---commands
    |       |   |           |       MidjourneyImagineCommandService.test.ts
    |       |   |           |       MidjourneyRerollCommandService.test.ts
    |       |   |           |
    |       |   |           \---results
    |       |   |                   MidjourneyImagineResultsService.test.ts
    |       |   |
    |       |   \---ports
    |       |       \---adapters
    |       |           +---incoming
    |       |           |   +---application
    |       |           |   |       SSEFrontendMock.test.ts
    |       |           |   |       SSEHTTPAdapter.test.ts
    |       |           |   |
    |       |           |   +---images
    |       |           |   |   |   ImagesRetrieveHTTPAdapter.test.ts
    |       |           |   |   |
    |       |           |   |   +---commands
    |       |           |   |   |       VariationsImagesHTTPAdapter.test.ts
    |       |           |   |   |
    |       |           |   |   \---webhooks
    |       |           |   |           VariationsWebhookHTTPAdapter.test.ts
    |       |           |   |
    |       |           |   \---prompts
    |       |           |           ObtainImagePromptsHTTPAdapter.test.ts
    |       |           |
    |       |           \---outgoing
    |       |               +---database
    |       |               |       MidjourneyTaskConditionsRepository.test.ts
    |       |               |
    |       |               \---http
    |       |                   \---task
    |       |                       \---payload
    |       |                               GoAPIBaseTaskPayloadVO.test.ts
    |       |                               GoAPIImagineTaskPayload.test.ts
    |       |
    |       \---unit
    +---contract
    |   |   package.json
    |   |
    |   \---src
    |       \---definitions
    |           |   imagetron.oas.json
    |           |
    |           +---components
    |           |       components.oas.json
    |           |
    |           +---partials
    |           |   +---application
    |           |   |       application-event.oas.json
    |           |   |
    |           |   \---images
    |           |           images-image-item.oas.json
    |           |
    |           \---paths
    |               +---goapi
    |               |       task.oas.json
    |               |
    |               \---imagetron
    |                   +---application
    |                   |       sse.oas.json
    |                   |
    |                   +---images
    |                   |       imagine-midjourney.oas.json
    |                   |       webhook-midjourney-commands.oas.json
    |                   |
    |                   \---prompts
    |                       +---chat
    |                       |       retrieve.oas.json
    |                       |
    |                       +---misc
    |                       |       prompt-manual-status-change.oas.json
    |                       |
    |                       \---obtain
    |                               subjects.oas.json
    |
    \---shared
        |   package.json
        |
        \---src
            |   index.ts
            |
            \---application
                +---abstractions
                |       AApplication.event.ts
                |
                +---bootstrap
                |       ApplicationEvent.bus.ts
                |
                +---events
                |       GoAPITaskProcessedEvent.valueobject.ts
                |
                \---exceptions
                        DomainErrorCodes.enum.ts
                        Imagetron.exception.ts
                        StructuredError.valueobject.ts
```

</details>
