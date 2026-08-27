import * as core from '@actions/core'

export interface Inputs {
  name: string
  path: string
  ifNoFilesFound: 'warn' | 'error' | 'ignore'
  compressionLevel: number
  overwrite: boolean
  includeHiddenFiles: boolean
  archive: boolean
  bucket: string
  endpoint?: string
  region: string
  accessKeyId?: string
  secretAccessKey?: string
  sessionToken?: string
  forcePathStyle: boolean
  keyPrefix: string
  presignedUrl: boolean
  presignedUrlExpiration: number
  includeInSummary: boolean
}

function integer(name: string, min: number, max: number): number {
  const raw = core.getInput(name)
  const value = Number(raw)
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`Input '${name}' must be an integer between ${min} and ${max}; got '${raw}'`)
  }
  return value
}

export function getInputs(): Inputs {
  const behavior = core.getInput('if-no-files-found')
  if (!['warn', 'error', 'ignore'].includes(behavior)) {
    throw new Error(`Input 'if-no-files-found' must be warn, error, or ignore; got '${behavior}'`)
  }

  const accessKeyId = core.getInput('s3-access-key-id') || undefined
  const secretAccessKey = core.getInput('s3-secret-access-key') || undefined
  if (!!accessKeyId !== !!secretAccessKey) {
    throw new Error(
      "Inputs 's3-access-key-id' and 's3-secret-access-key' must be provided together"
    )
  }

  return {
    name: core.getInput('name') || 'artifact',
    path: core.getInput('path', { required: true }),
    ifNoFilesFound: behavior as Inputs['ifNoFilesFound'],
    compressionLevel: integer('compression-level', 0, 9),
    overwrite: core.getBooleanInput('overwrite'),
    includeHiddenFiles: core.getBooleanInput('include-hidden-files'),
    archive: core.getBooleanInput('archive'),
    bucket: core.getInput('s3-bucket', { required: true }),
    endpoint: core.getInput('s3-endpoint') || undefined,
    region: core.getInput('s3-region') || 'us-east-1',
    accessKeyId,
    secretAccessKey,
    sessionToken: core.getInput('s3-session-token') || undefined,
    forcePathStyle: core.getBooleanInput('s3-force-path-style'),
    keyPrefix: core.getInput('s3-key-prefix'),
    presignedUrl: core.getBooleanInput('presigned-url'),
    presignedUrlExpiration: integer('presigned-url-expiration', 1, 604800),
    includeInSummary: core.getBooleanInput('include-in-summary')
  }
}
