# upload-s3-artifact

A GitHub Action that follows the `actions/upload-artifact` interface while storing artifacts in AWS S3, RustFS, Cloudflare R2, or another S3-compatible service. It creates a presigned download link and adds it to the job summary by default.

## Usage

```yaml
- uses: LowderPlay/upload-s3-artifact@v0.1.0
  with:
    name: build
    path: |
      dist/**
      !dist/**/*.map
    s3-bucket: ci-artifacts
    s3-region: us-east-1
    s3-endpoint: https://rustfs.example.com # omit for AWS
    s3-access-key-id: ${{ secrets.S3_ACCESS_KEY_ID }}
    s3-secret-access-key: ${{ secrets.S3_SECRET_ACCESS_KEY }}
    s3-force-path-style: true
```

Credentials can be omitted to use the standard AWS SDK credential chain. On AWS, OIDC with `aws-actions/configure-aws-credentials` is recommended over long-lived keys.

To disable the run-summary entry:

```yaml
include-in-summary: false
```

## Compatibility

The standard inputs match the current `actions/upload-artifact` action:

| Input                  | Default    | Notes                                                            |
| ---------------------- | ---------- | ---------------------------------------------------------------- |
| `name`                 | `artifact` | ZIP/object name when `archive` is enabled                        |
| `path`                 | required   | File, directory, glob, or multiline patterns with `!` exclusions |
| `if-no-files-found`    | `warn`     | `warn`, `error`, or `ignore`                                     |
| `compression-level`    | `6`        | ZIP level, 0–9                                                   |
| `overwrite`            | `false`    | Existing object fails by default; `true` replaces it             |
| `include-hidden-files` | `false`    | Dotfiles and files below dot-directories are excluded by default |
| `archive`              | `true`     | `false` uploads exactly one file without wrapping it in a ZIP    |

S3-specific inputs:

| Input                                       | Default                                 | Notes                                                                       |
| ------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------- |
| `s3-bucket`                                 | required                                | Destination bucket                                                          |
| `s3-endpoint`                               | AWS endpoint                            | Any S3-compatible endpoint URL                                              |
| `s3-region`                                 | `us-east-1`                             | Signing region                                                              |
| `s3-access-key-id` / `s3-secret-access-key` | SDK chain                               | Must be supplied together                                                   |
| `s3-session-token`                          | empty                                   | Temporary credential token                                                  |
| `s3-force-path-style`                       | `false`                                 | Often required for RustFS/local services                                    |
| `s3-key-prefix`                             | `{owner}/{repo}/{run_id}/{run_attempt}` | Supports `{owner}`, `{repo}`, `{run_id}`, `{run_attempt}`, `{job}`, `{sha}` |
| `presigned-url`                             | `true`                                  | Generate the `artifact-url` output                                          |
| `presigned-url-expiration`                  | `86400`                                 | URL lifetime in seconds; max 604800 (7 days)                                |
| `include-in-summary`                        | `true`                                  | Write the artifact link and digest to the job summary                       |

Outputs are `artifact-url`, `artifact-digest`, `artifact-key`, and `artifact-id`. Because S3 has no GitHub numeric artifact ID, both `artifact-id` and `artifact-key` contain the S3 object key. The digest covers the uploaded object (the ZIP when archiving is enabled).

Artifacts are uploaded with the SHA-256 digest and GitHub run ID in S3 object metadata. Uploads use the AWS SDK multipart uploader for large objects.

## Permissions

The S3 identity needs these permissions for the destination prefix:

- `s3:GetObject` (presigning and existence checks)
- `s3:PutObject`
- multipart upload permissions for large objects

`overwrite: false` performs `HeadObject`; make sure the identity can read object metadata. Configure retention with bucket lifecycle rules when needed.

## Development

```bash
pnpm install --frozen-lockfile
pnpm all
```

Commit `dist/index.js` with source changes because GitHub Actions runs the bundled file directly.
