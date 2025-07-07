import { EnvironmentVariables } from './environment-variables';

describe('EnvironmentVariables', () => {
  it('should be defined', () => {
    expect(new EnvironmentVariables()).toBeDefined();
  });
});
