# Thin wrappers around the scripts in bin/ (they load bin/env.sh themselves where needed).
.PHONY: help setup test security audit security-tests docker-smoke build

help:
	@echo "make setup          create the .local/ toolchain on a fresh clone (no root)"
	@echo "make test           unit + API + UI tests (needs PostgreSQL: bin/start.sh)"
	@echo "make security       dependency audit + security tests"
	@echo "make audit          npm audit for app/ and web/ (fails on high; AUDIT_LEVEL=moderate to tighten)"
	@echo "make security-tests API security tests only (needs PostgreSQL)"
	@echo "make build          type check + production build into www/"
	@echo "make docker-smoke   build and smoke-test the production Docker images"

setup:
	bin/setup.sh

test:
	bin/test.sh

audit:
	bin/audit.sh

security-tests:
	bash -c 'source bin/env.sh && cd app && npm run test:security'

security: audit security-tests

build:
	bin/build.sh

docker-smoke:
	bin/docker-smoke.sh
