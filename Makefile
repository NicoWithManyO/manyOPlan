.PHONY: setup setup-backend setup-frontend dev dev-backend dev-frontend migrate test test-backend test-frontend lint format

# --- Setup ---
setup: setup-backend setup-frontend

setup-backend:
	cd backend && python3.13 -m venv .venv
	cd backend && .venv/bin/pip install -e ".[dev]"

setup-frontend:
	cd frontend && npm install

# --- Development ---
dev:
	$(MAKE) dev-backend & $(MAKE) dev-frontend & wait

dev-backend:
	cd backend && .venv/bin/python manage.py runserver 8001

dev-frontend:
	cd frontend && npm run dev

# --- Database ---
migrate:
	cd backend && .venv/bin/python manage.py makemigrations
	cd backend && .venv/bin/python manage.py migrate

# --- Tests ---
test: test-backend test-frontend

test-backend:
	cd backend && .venv/bin/pytest

test-frontend:
	cd frontend && npm test

# --- Linting ---
lint:
	cd backend && .venv/bin/ruff check .
	cd frontend && npx eslint .

format:
	cd backend && .venv/bin/ruff format .
	cd frontend && npx prettier --write "src/**/*.{ts,tsx,css}"
