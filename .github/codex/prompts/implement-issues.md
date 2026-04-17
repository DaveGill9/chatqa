You are implementing a GitHub issue in this repository.

Goals:
1. Read the issue title and body provided in the prompt.
2. Inspect the repository and identify the smallest safe change that addresses the issue.
3. If the issue is ambiguous, do not invent product behavior. Add a short note in the PR body explaining the ambiguity.
4. Add or update tests when appropriate.
5. Do not make unrelated refactors.
6. Keep changes minimal and reviewable.
7. After making changes, summarize:
   - what you changed
   - files changed
   - tests added/updated
   - risks / assumptions
   - follow-up work if any

If the issue should not be implemented automatically, explain why clearly and make no code changes.