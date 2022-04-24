.PHONY: help

help: ## Show help/documentation for the Makefile
	@grep -Eh '^[0-9a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

configure: ## Download dependencies
	go mod download

lint: configure ## Lint the repository with golang-ci lint
	golangci-lint run --max-same-issues 0 --max-issues-per-linter 0 $(if $(CI),--out-format code-climate > gl-code-quality-report.json 2>golangci-stderr-output)

test: configure ## Run all tests
	go test -v

bench: configure ## Run all benchmarks
	go test -bench=.
