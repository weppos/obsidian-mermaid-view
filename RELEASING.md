# Releasing

This document describes the steps to release a new version of Mermaid View.

## Prerequisites

- You have commit access to the repository
- You have push access to the repository

## Release process

1. **Determine the new version** using [Semantic Versioning](https://semver.org/)

   ```shell
   VERSION=X.Y.Z
   ```

   - **MAJOR** version for incompatible API changes
   - **MINOR** version for backwards-compatible functionality additions
   - **PATCH** version for backwards-compatible bug fixes

2. **Run tests** and confirm they pass

   ```shell
   npm test
   ```

3. **Set the version** in `package.json`

   ```json
   {
     "version": "$VERSION",
   }
   ```

4. **Set the version** in `manifest.json`

   ```json
   {
     "version": "$VERSION",
   }
   ```

5. **Run tests** again and confirm they pass

   ```shell
   npm test
   ```

6. **Update the changelog** with the new version

   Finalize the `## Unreleased` section in `CHANGELOG.md` assigning the version.

7. **Commit and push the changes**

   ```shell
   git commit -a -m "Release $VERSION"
   git push origin main
   ```

8. **Wait for CI to complete**

9. **Create a tag**

   ```shell
   git tag -a $VERSION -m "Release $VERSION"
   git push origin --tags
   ```

GitHub Actions will create a draft release with `main.js`, `manifest.json`, and `styles.css`.

## Post-release

- Verify the draft GitHub release was created
- Review and publish the release
- Verify the release appears in Obsidian's community plugins (if published)
