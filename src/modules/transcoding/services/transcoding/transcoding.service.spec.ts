import { Test, TestingModule } from '@nestjs/testing';
import { TranscodingService } from './transcoding.service';

describe('TranscodingService', () => {
  let service: TranscodingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TranscodingService],
    }).compile();

    service = module.get<TranscodingService>(TranscodingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
