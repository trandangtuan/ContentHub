export interface UploadInput {
  key: string;
  body: Buffer;
  contentType: string;
}

export interface UploadResult {
  key: string;
  url: string;
}

/** S3-compatible object storage abstraction — swap MinIO/S3/R2/Spaces without touching callers. */
export interface StorageProvider {
  upload(input: UploadInput): Promise<UploadResult>;
  delete(key: string): Promise<void>;
  getPublicUrl(key: string): string;
}
