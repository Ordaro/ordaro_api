import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private readonly cloudinaryConfig: {
    cloud_name: string;
    api_key: string;
    api_secret: string;
    secure: boolean;
  };

  constructor(private readonly configService: ConfigService) {
    const cloudinaryConfig = this.configService.get<{
      cloudName?: string;
      apiKey?: string;
      apiSecret?: string;
      secure?: boolean;
    }>('app.cloudinary');

    if (
      !cloudinaryConfig?.cloudName ||
      !cloudinaryConfig?.apiKey ||
      !cloudinaryConfig?.apiSecret
    ) {
      this.logger.warn(
        'Cloudinary configuration incomplete. File uploads will not work.',
      );
    }

    this.cloudinaryConfig = {
      cloud_name:
        cloudinaryConfig?.cloudName ||
        process.env['CLOUDINARY_CLOUD_NAME'] ||
        '',
      api_key:
        cloudinaryConfig?.apiKey || process.env['CLOUDINARY_API_KEY'] || '',
      api_secret:
        cloudinaryConfig?.apiSecret || process.env['CLOUDINARY_SECRET'] || '',
      secure:
        cloudinaryConfig?.secure ??
        process.env['CLOUDINARY_SECURE'] !== 'false',
    };

    // Configure Cloudinary
    cloudinary.config(this.cloudinaryConfig);
  }

  /**
   * Upload a file to Cloudinary
   */
  async uploadFile(
    file: Buffer | string,
    options?: {
      folder?: string;
      publicId?: string;
      resourceType?: 'image' | 'video' | 'raw' | 'auto';
      format?: string;
      transformation?: Record<string, unknown>[];
      tags?: string[];
    },
  ): Promise<UploadApiResponse> {
    try {
      const uploadOptions: Record<string, unknown> = {};

      if (options?.folder) {
        uploadOptions['folder'] = options.folder;
      }
      if (options?.publicId) {
        uploadOptions['public_id'] = options.publicId;
      }
      if (options?.resourceType) {
        uploadOptions['resource_type'] = options.resourceType;
      } else {
        uploadOptions['resource_type'] = 'auto';
      }
      if (options?.format) {
        uploadOptions['format'] = options.format;
      }
      if (options?.transformation) {
        uploadOptions['transformation'] = options.transformation;
      }
      if (options?.tags) {
        uploadOptions['tags'] = options.tags;
      }

      const result = await cloudinary.uploader.upload(
        file as string,
        uploadOptions,
      );
      this.logger.log(`File uploaded successfully: ${result.public_id}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Error uploading file to Cloudinary: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Upload a file from URL
   */
  async uploadFromUrl(
    url: string,
    options?: {
      folder?: string;
      publicId?: string;
      resourceType?: 'image' | 'video' | 'raw' | 'auto';
      transformation?: Record<string, unknown>[];
      tags?: string[];
    },
  ): Promise<UploadApiResponse> {
    try {
      const uploadOptions: Record<string, unknown> = {};

      if (options?.folder) {
        uploadOptions['folder'] = options.folder;
      }
      if (options?.publicId) {
        uploadOptions['public_id'] = options.publicId;
      }
      if (options?.resourceType) {
        uploadOptions['resource_type'] = options.resourceType;
      } else {
        uploadOptions['resource_type'] = 'auto';
      }
      if (options?.transformation) {
        uploadOptions['transformation'] = options.transformation;
      }
      if (options?.tags) {
        uploadOptions['tags'] = options.tags;
      }

      const result = await cloudinary.uploader.upload(url, uploadOptions);
      this.logger.log(
        `File uploaded from URL successfully: ${result.public_id}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Error uploading file from URL to Cloudinary: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Delete a file from Cloudinary
   */
  async deleteFile(
    publicId: string,
    resourceType: 'image' | 'video' | 'raw' = 'image',
  ): Promise<{ result: string }> {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
      });
      if (result.result === 'ok') {
        this.logger.log(`File deleted successfully: ${publicId}`);
      } else {
        this.logger.warn(
          `File deletion result: ${result.result} for ${publicId}`,
        );
      }
      return result;
    } catch (error) {
      this.logger.error(
        `Error deleting file from Cloudinary: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Generate a signed upload URL for client-side uploads
   */
  generateUploadSignature(
    folder?: string,
    publicId?: string,
  ): {
    signature: string;
    timestamp: number;
    cloudName: string;
    apiKey: string;
  } {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const params: Record<string, string | number> = {
      timestamp,
    };

    if (folder) {
      params['folder'] = folder;
    }
    if (publicId) {
      params['public_id'] = publicId;
    }

    const signature = cloudinary.utils.api_sign_request(
      params,
      this.cloudinaryConfig.api_secret,
    );

    return {
      signature,
      timestamp,
      cloudName: this.cloudinaryConfig.cloud_name,
      apiKey: this.cloudinaryConfig.api_key,
    };
  }

  /**
   * Get secure URL for a public ID
   */
  getSecureUrl(
    publicId: string,
    transformation?: Record<string, unknown>[],
  ): string {
    return cloudinary.url(publicId, {
      secure: true,
      transformation,
    });
  }

  /**
   * Get optimized image URL with transformations
   */
  getOptimizedImageUrl(
    publicId: string,
    options?: {
      width?: number;
      height?: number;
      quality?: number | 'auto';
      format?: 'jpg' | 'png' | 'webp' | 'avif';
      crop?: string;
    },
  ): string {
    const transformation: Record<string, unknown>[] = [];

    if (options?.width || options?.height) {
      transformation.push({
        width: options.width,
        height: options.height,
        crop: options.crop || 'limit',
      });
    }

    if (options?.quality) {
      transformation.push({
        quality: options.quality,
      });
    }

    if (options?.format) {
      transformation.push({
        format: options.format,
      });
    }

    return cloudinary.url(publicId, {
      secure: true,
      transformation: transformation.length > 0 ? transformation : undefined,
    });
  }

  /**
   * Get file info
   */
  async getFileInfo(
    publicId: string,
    resourceType: 'image' | 'video' | 'raw' = 'image',
  ): Promise<UploadApiResponse> {
    try {
      const result = await cloudinary.api.resource(publicId, {
        resource_type: resourceType,
      });
      return result as UploadApiResponse;
    } catch (error) {
      this.logger.error(
        `Error getting file info from Cloudinary: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Check if Cloudinary is configured
   */
  isConfigured(): boolean {
    return !!(
      this.cloudinaryConfig.cloud_name &&
      this.cloudinaryConfig.api_key &&
      this.cloudinaryConfig.api_secret
    );
  }
}
