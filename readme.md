# Imagetron Project Engineering Excerpts

> [!IMPORTANT]
> This repository contains my Imagetron project engineering excerpts: models, code, tests, CI/CD, IaC for illustration purposes.
>
> See the detailed review in the [Imagetron case study](https://valentineshi.dev/content/deliverables/K3aT7UX_RCC8ZO_fy9VinQ/ai-powered-image-generation-publication-system-imagetron) on my website.

## System characteristics

- Contract-first API (OpenAPI 3.1)
- Async orchestration (webhook + SSE)
- Explicit domain modeling (C4, UML/PlantUML)
- Idempotent job processing
- Containerized deployment (Docker, Swarm, Traefik)
- 170+ automated tests, coverage > 95%.
