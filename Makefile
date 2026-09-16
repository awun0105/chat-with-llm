.PHONY: setup build dev test

setup:
	uv sync
	cd web && npm ci

build:
	cd web && npm run build

dev:
	bash scripts/dev.sh

test:
	uv run pytest -q
	cd web && npm test
	cd web && npm run lint
