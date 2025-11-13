import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface GeocodeResult {
  address: string;
  coordinates: Coordinates;
  formattedAddress?: string;
  placeId?: string;
}

export interface ReverseGeocodeResult {
  address: string;
  formattedAddress?: string;
  placeId?: string;
  components?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
}

export interface DistanceResult {
  distance: number; // in meters
  duration?: number; // in seconds
  distanceText?: string; // human-readable
  durationText?: string; // human-readable
}

@Injectable()
export class MapsService {
  private readonly logger = new Logger(MapsService.name);
  private readonly apiKey: string;
  private readonly provider: 'google' | 'mapbox' | 'openstreetmap';
  private readonly client: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    this.provider =
      (this.configService.get<string>('app.maps.provider') as
        | 'google'
        | 'mapbox'
        | 'openstreetmap') || 'google';
    this.apiKey =
      this.configService.get<string>('app.maps.apiKey') ||
      process.env['MAPS_API_KEY'] ||
      '';

    this.client = axios.create({
      timeout: 10000,
    });
  }

  /**
   * Geocode an address to coordinates
   */
  async geocode(address: string): Promise<GeocodeResult> {
    try {
      switch (this.provider) {
        case 'google':
          return await this.geocodeGoogle(address);
        case 'mapbox':
          return await this.geocodeMapbox(address);
        case 'openstreetmap':
          return await this.geocodeOpenStreetMap(address);
        default:
          throw new Error(`Unsupported maps provider: ${this.provider}`);
      }
    } catch (error) {
      this.logger.error(
        `Geocoding failed for address "${address}": ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Reverse geocode coordinates to address
   */
  async reverseGeocode(
    coordinates: Coordinates,
  ): Promise<ReverseGeocodeResult> {
    try {
      switch (this.provider) {
        case 'google':
          return await this.reverseGeocodeGoogle(coordinates);
        case 'mapbox':
          return await this.reverseGeocodeMapbox(coordinates);
        case 'openstreetmap':
          return await this.reverseGeocodeOpenStreetMap(coordinates);
        default:
          throw new Error(`Unsupported maps provider: ${this.provider}`);
      }
    } catch (error) {
      this.logger.error(
        `Reverse geocoding failed for coordinates ${coordinates.latitude}, ${coordinates.longitude}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Calculate distance between two coordinates
   */
  async calculateDistance(
    from: Coordinates,
    to: Coordinates,
    mode: 'driving' | 'walking' | 'bicycling' | 'straight' = 'driving',
  ): Promise<DistanceResult> {
    try {
      if (mode === 'straight') {
        // Calculate straight-line distance (Haversine formula)
        const distance = this.haversineDistance(from, to);
        return {
          distance,
          distanceText: this.formatDistance(distance),
        };
      }

      // Use routing API for driving/walking/bicycling
      switch (this.provider) {
        case 'google':
          return await this.calculateDistanceGoogle(from, to, mode);
        case 'mapbox':
          return await this.calculateDistanceMapbox(from, to, mode);
        default: {
          // Fallback to straight-line distance
          const distance = this.haversineDistance(from, to);
          return {
            distance,
            distanceText: this.formatDistance(distance),
          };
        }
      }
    } catch (error) {
      this.logger.error(
        `Distance calculation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Fallback to straight-line distance
      const distance = this.haversineDistance(from, to);
      return {
        distance,
        distanceText: this.formatDistance(distance),
      };
    }
  }

  /**
   * Google Maps geocoding
   */
  private async geocodeGoogle(address: string): Promise<GeocodeResult> {
    if (!this.apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    const response = await this.client.get(
      'https://maps.googleapis.com/maps/api/geocode/json',
      {
        params: {
          address,
          key: this.apiKey,
        },
      },
    );

    if (response.data.status !== 'OK' || !response.data.results?.[0]) {
      throw new Error(`Google Geocoding API error: ${response.data.status}`);
    }

    const result = response.data.results[0];
    const location = result.geometry.location;

    return {
      address,
      coordinates: {
        latitude: location.lat,
        longitude: location.lng,
      },
      formattedAddress: result.formatted_address,
      placeId: result.place_id,
    };
  }

  /**
   * Google Maps reverse geocoding
   */
  private async reverseGeocodeGoogle(
    coordinates: Coordinates,
  ): Promise<ReverseGeocodeResult> {
    if (!this.apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    const response = await this.client.get(
      'https://maps.googleapis.com/maps/api/geocode/json',
      {
        params: {
          latlng: `${coordinates.latitude},${coordinates.longitude}`,
          key: this.apiKey,
        },
      },
    );

    if (response.data.status !== 'OK' || !response.data.results?.[0]) {
      throw new Error(
        `Google Reverse Geocoding API error: ${response.data.status}`,
      );
    }

    const result = response.data.results[0];
    const components: {
      street?: string;
      city?: string;
      state?: string;
      country?: string;
      postalCode?: string;
    } = {};

    result.address_components.forEach((component: any) => {
      if (component.types.includes('street_number')) {
        const longName: string =
          typeof component.long_name === 'string' ? component.long_name : '';
        const streetValue = components.street;
        const currentStreet: string =
          typeof streetValue === 'string' ? streetValue : '';
        components.street = currentStreet + longName;
      } else if (component.types.includes('route')) {
        const longName: string =
          typeof component.long_name === 'string' ? component.long_name : '';
        const streetValue = components.street;
        const currentStreet: string =
          typeof streetValue === 'string' ? streetValue : '';
        components.street = currentStreet + ' ' + longName;
      } else if (component.types.includes('locality')) {
        components['city'] = component.long_name;
      } else if (component.types.includes('administrative_area_level_1')) {
        components['state'] = component.long_name;
      } else if (component.types.includes('country')) {
        components['country'] = component.long_name;
      } else if (component.types.includes('postal_code')) {
        components['postalCode'] = component.long_name;
      }
    });

    const resultComponents: ReverseGeocodeResult['components'] =
      Object.keys(components).length > 0
        ? {
            ...(components['street'] && { street: components['street'] }),
            ...(components['city'] && { city: components['city'] }),
            ...(components['state'] && { state: components['state'] }),
            ...(components['country'] && { country: components['country'] }),
            ...(components['postalCode'] && {
              postalCode: components['postalCode'],
            }),
          }
        : undefined;

    return {
      address: result.formatted_address,
      formattedAddress: result.formatted_address,
      placeId: result.place_id,
      ...(resultComponents && { components: resultComponents }),
    };
  }

  /**
   * Google Maps distance calculation
   */
  private async calculateDistanceGoogle(
    from: Coordinates,
    to: Coordinates,
    mode: 'driving' | 'walking' | 'bicycling',
  ): Promise<DistanceResult> {
    if (!this.apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    const response = await this.client.get(
      'https://maps.googleapis.com/maps/api/distancematrix/json',
      {
        params: {
          origins: `${from.latitude},${from.longitude}`,
          destinations: `${to.latitude},${to.longitude}`,
          mode,
          key: this.apiKey,
        },
      },
    );

    if (
      response.data.status !== 'OK' ||
      !response.data.rows?.[0]?.elements?.[0]
    ) {
      throw new Error(
        `Google Distance Matrix API error: ${response.data.status}`,
      );
    }

    const element = response.data.rows[0].elements[0];
    if (element.status !== 'OK') {
      throw new Error(
        `Google Distance Matrix element error: ${element.status}`,
      );
    }

    return {
      distance: element.distance.value, // meters
      duration: element.duration.value, // seconds
      distanceText: element.distance.text,
      durationText: element.duration.text,
    };
  }

  /**
   * Mapbox geocoding
   */
  private async geocodeMapbox(address: string): Promise<GeocodeResult> {
    if (!this.apiKey) {
      throw new Error('Mapbox API key not configured');
    }

    const response = await this.client.get(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json`,
      {
        params: {
          access_token: this.apiKey,
        },
      },
    );

    if (!response.data.features?.[0]) {
      throw new Error('Mapbox Geocoding API: No results found');
    }

    const feature = response.data.features[0];
    const [longitude, latitude] = feature.center;

    return {
      address,
      coordinates: { latitude, longitude },
      formattedAddress: feature.place_name,
      placeId: feature.id,
    };
  }

  /**
   * Mapbox reverse geocoding
   */
  private async reverseGeocodeMapbox(
    coordinates: Coordinates,
  ): Promise<ReverseGeocodeResult> {
    if (!this.apiKey) {
      throw new Error('Mapbox API key not configured');
    }

    const response = await this.client.get(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${coordinates.longitude},${coordinates.latitude}.json`,
      {
        params: {
          access_token: this.apiKey,
        },
      },
    );

    if (!response.data.features?.[0]) {
      throw new Error('Mapbox Reverse Geocoding API: No results found');
    }

    const feature = response.data.features[0];

    return {
      address: feature.place_name,
      formattedAddress: feature.place_name,
      placeId: feature.id,
    };
  }

  /**
   * Mapbox distance calculation
   */
  private async calculateDistanceMapbox(
    from: Coordinates,
    to: Coordinates,
    mode: 'driving' | 'walking' | 'bicycling',
  ): Promise<DistanceResult> {
    if (!this.apiKey) {
      throw new Error('Mapbox API key not configured');
    }

    const profile =
      mode === 'driving'
        ? 'driving'
        : mode === 'walking'
          ? 'walking'
          : 'cycling';
    const response = await this.client.get(
      `https://api.mapbox.com/directions/v5/mapbox/${profile}/${from.longitude},${from.latitude};${to.longitude},${to.latitude}`,
      {
        params: {
          access_token: this.apiKey,
          geometries: 'geojson',
        },
      },
    );

    if (!response.data.routes?.[0]) {
      throw new Error('Mapbox Directions API: No route found');
    }

    const route = response.data.routes[0];

    return {
      distance: route.distance, // meters
      duration: route.duration, // seconds
      distanceText: this.formatDistance(route.distance),
      durationText: this.formatDuration(route.duration),
    };
  }

  /**
   * OpenStreetMap geocoding (Nominatim)
   */
  private async geocodeOpenStreetMap(address: string): Promise<GeocodeResult> {
    const response = await this.client.get(
      'https://nominatim.openstreetmap.org/search',
      {
        params: {
          q: address,
          format: 'json',
          limit: 1,
        },
        headers: {
          'User-Agent': 'Ordaro-API/1.0',
        },
      },
    );

    if (!response.data?.[0]) {
      throw new Error('OpenStreetMap Geocoding: No results found');
    }

    const result = response.data[0];

    return {
      address,
      coordinates: {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
      },
      formattedAddress: result.display_name,
      placeId: result.place_id,
    };
  }

  /**
   * OpenStreetMap reverse geocoding
   */
  private async reverseGeocodeOpenStreetMap(
    coordinates: Coordinates,
  ): Promise<ReverseGeocodeResult> {
    const response = await this.client.get(
      'https://nominatim.openstreetmap.org/reverse',
      {
        params: {
          lat: coordinates.latitude,
          lon: coordinates.longitude,
          format: 'json',
        },
        headers: {
          'User-Agent': 'Ordaro-API/1.0',
        },
      },
    );

    if (!response.data) {
      throw new Error('OpenStreetMap Reverse Geocoding: No results found');
    }

    return {
      address: response.data.display_name,
      formattedAddress: response.data.display_name,
      placeId: response.data.place_id,
    };
  }

  /**
   * Calculate Haversine distance (straight-line)
   */
  private haversineDistance(from: Coordinates, to: Coordinates): number {
    const R = 6371000; // Earth radius in meters
    const dLat = this.toRadians(to.latitude - from.latitude);
    const dLon = this.toRadians(to.longitude - from.longitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(from.latitude)) *
        Math.cos(this.toRadians(to.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  private formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(2)}km`;
  }

  private formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) {
      return remainingSeconds > 0
        ? `${minutes}m ${remainingSeconds}s`
        : `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0
      ? `${hours}h ${remainingMinutes}m`
      : `${hours}h`;
  }
}
