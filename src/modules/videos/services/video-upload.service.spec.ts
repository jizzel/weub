import { Test, TestingModule } from '@nestjs/testing';
import { VideoUploadService } from './video-upload.service';

describe('VideoUploadService', () => {
  let service: VideoUploadService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VideoUploadService],
    }).compile();

    service = module.get<VideoUploadService>(VideoUploadService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
