import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface OrthancStudy {
  ID: string;
  IsStable: boolean;
  LastUpdate: string;
  MainDicomTags: {
    AccessionNumber?: string;
    ReferringPhysicianName?: string;
    StudyDate?: string;
    StudyDescription?: string;
    StudyID?: string;
    StudyInstanceUID: string;
    StudyTime?: string;
  };
  PatientMainDicomTags?: {
    PatientBirthDate?: string;
    PatientID?: string;
    PatientName?: string;
    PatientSex?: string;
  };
  Series: string[];
  Type: string;
}

export interface OrthancSeries {
  ID: string;
  MainDicomTags: {
    Modality?: string;
    BodyPartExamined?: string;
    SeriesDate?: string;
    SeriesDescription?: string;
    SeriesInstanceUID?: string;
    SeriesNumber?: string;
  };
  Instances: string[];
  Type: string;
}

/**
 * Service for interacting with the Orthanc DICOM server REST API.
 * Provides methods to fetch study and series metadata.
 */
@Injectable()
export class OrthancService {
  private readonly logger = new Logger(OrthancService.name);
  private readonly orthancUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.orthancUrl = this.configService.get<string>(
      'ORTHANC_URL',
      'http://orthanc:8042',
    );
  }

  /**
   * Fetches full study details from Orthanc by its internal study ID.
   */
  async getStudy(orthancStudyId: string): Promise<OrthancStudy> {
    const url = `${this.orthancUrl}/studies/${orthancStudyId}`;

    let response: Response;
    try {
      response = await fetch(url);
    } catch (err) {
      this.logger.error(
        `Network error reaching Orthanc at ${url}: ${(err as Error).message}`,
      );
      throw new ServiceUnavailableException('Unable to reach Orthanc server');
    }

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Orthanc returned ${response.status} for study ${orthancStudyId}`,
      );
    }

    return response.json() as Promise<OrthancStudy>;
  }

  /**
   * Fetches series details from Orthanc by its internal series ID.
   */
  async getSeries(seriesId: string): Promise<OrthancSeries> {
    const url = `${this.orthancUrl}/series/${seriesId}`;

    let response: Response;
    try {
      response = await fetch(url);
    } catch (err) {
      this.logger.error(
        `Network error reaching Orthanc at ${url}: ${(err as Error).message}`,
      );
      throw new ServiceUnavailableException('Unable to reach Orthanc server');
    }

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Orthanc returned ${response.status} for series ${seriesId}`,
      );
    }

    return response.json() as Promise<OrthancSeries>;
  }

  /**
   * Fetches study details and, if available, the first series for modality
   * and body-part information.
   */
  async getStudyWithSeries(orthancStudyId: string): Promise<{
    study: OrthancStudy;
    firstSeries?: OrthancSeries;
  }> {
    const study = await this.getStudy(orthancStudyId);

    let firstSeries: OrthancSeries | undefined;
    if (study.Series && study.Series.length > 0) {
      try {
        firstSeries = await this.getSeries(study.Series[0]);
      } catch (err) {
        this.logger.warn(
          `Could not fetch first series for study ${orthancStudyId}: ${(err as Error).message}`,
        );
      }
    }

    return { study, firstSeries };
  }
}
