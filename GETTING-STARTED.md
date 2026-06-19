# CityU Research Review Portal - Getting Started

This file is a fast onboarding map.

All installation and deployment steps are maintained in [DEPLOYMENT.md](DEPLOYMENT.md). Do not duplicate or follow older setup snippets from other docs.

## Start Here

1. Read [README.md](README.md) for platform overview and feature context.
2. Use [DEPLOYMENT.md](DEPLOYMENT.md) for setup, deployment, and validation instructions.
3. Use [OPERATIONS-MANUAL.md](OPERATIONS-MANUAL.md) for runbook operations after deployment.
4. Use [USER-MANUAL.md](USER-MANUAL.md) for role-based product usage.

## Choose Your Path

Follow the matching section in [DEPLOYMENT.md](DEPLOYMENT.md):

1. Docker on local/dev machine.
2. Docker on server with domain + HTTPS.
3. Bare-metal Ubuntu deployment.
4. Remote VM deployment from local machine.

## After Deployment

1. Run the validation checklist in [DEPLOYMENT.md](DEPLOYMENT.md).
2. Run smoke tests in [deploy/smoke-test-checklist.md](deploy/smoke-test-checklist.md).
3. Change default seeded account passwords immediately.
4. Configure organization and email settings in the Admin UI.

## Source of Truth

To avoid drift and conflicting guidance:

1. Keep setup/deployment commands only in [DEPLOYMENT.md](DEPLOYMENT.md).
2. Keep this file focused on navigation and first actions.
3. If deployment behavior changes, update [DEPLOYMENT.md](DEPLOYMENT.md) first.