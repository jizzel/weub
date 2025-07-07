import { plainToClass } from 'class-transformer';
import { EnvironmentVariables } from './environment-variables';
import { validateSync } from 'class-validator';
// import { DEFAULT_LOG_LEVELS } from '../../logger.config';

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToClass(EnvironmentVariables, config);
  const errors = validateSync(validatedConfig);

  // const validLogLevels = DEFAULT_LOG_LEVELS.join(', ');
  // if (process.env.LOG_LEVELS && !process.env.LOGGING_ENABLED) {
  //   console.warn(
  //     'LOG_LEVELS is set but LOGGING_ENABLED is not true - logging will be disabled',
  //   );
  // }
  // console.info(`Valid log levels are: ${validLogLevels}`);

  if (errors.length > 0) {
    throw new Error(`Environment validation error: ${errors.toString()}`);
  }
  return validatedConfig;
}
