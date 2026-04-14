# Prompt 06 — GitHub Actions Workflow

Create `.github/workflows/update-catalog.yml` — the workflow that runs `build_catalog.py` on a schedule and commits the result.

## Requirements

- **Trigger:** every 30 minutes on a cron schedule, plus a `workflow_dispatch` for manual runs
- **Runner:** `ubuntu-latest`
- **Steps:**
  1. Checkout the repo (with `fetch-depth: 0` so the git history is available for push)
  2. Set up Python 3.11
  3. Install dependencies from `scripts/requirements.txt`
  4. Run `python scripts/build_catalog.py`
  5. Commit `catalog.json` if it changed, with the message `chore: update catalog [skip ci]`
  6. Push using the standard `github-token`

- **Secrets used:** `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_BASE_URL` — all passed as environment variables to the script step

- **Concurrency:** use a concurrency group so only one run executes at a time; cancel in-progress runs when a new one starts

- **Commit/push safety:** before pushing, run `git pull --rebase` to avoid rejection if another run committed while this one was running

- **Skip if nothing changed:** only commit and push if `catalog.json` was actually modified (check with `git diff --quiet`)

Use the Actions bot identity for commits:
```
git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"
```
