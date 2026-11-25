---
name: release
description: Prepare and publish an official release with Semantic Versioning, release notes, a tag and a GitHub Release.
disable-model-invocation: true
argument-hint: "[version]"
---

# Release $ARGUMENTS

Plan releases around established milestones. Merging stays with the team. Pull Requests go straight to `main`, and a push to `main` deploys to production after CI passes, so a release marks a commit on `main` that is already verified. Stop and report if any check fails.

## 1. Choose the version

Use Semantic Versioning:

- MAJOR: breaking changes.
- MINOR: backward-compatible functionality.
- PATCH: backward-compatible bug fixes.

## 2. Verify

- All intended issues in the milestone are completed and merged into `main`.
- CI passed on the commit being released, and integration tests pass locally against it.
- Database migrations are in version control and apply cleanly to a fresh local database with `npx supabase db reset`.
- Every migration in the release has been applied to the hosted project with `npm run db:push`. Migrations are applied before the Pull Request that needs them is merged, because merging deploys.
- Environment configuration is verified, with no production credentials or secrets in the repository.
- Known issues and outstanding limitations are identified.

## 3. Write the release notes

Cover:

- Completed features
- Resolved issues
- Bug fixes
- Breaking changes
- Migrations
- Relevant deployment instructions
- Known issues and outstanding limitations

Show the notes and the commit to the user before tagging.

## 4. Tag and publish

Tag the exact commit being released and create the GitHub Release:

```bash
git fetch origin
git tag -a v<version> <commit> -m "Release v<version>"
git push origin v<version>
gh release create v<version> --verify-tag --title "v<version>" --notes-file <notes-file>
```

Then update the milestone and project boards. Report any deployment steps for the team. All production changes must be documented.
