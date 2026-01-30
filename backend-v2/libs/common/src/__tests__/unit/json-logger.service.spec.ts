import { JsonLoggerService, createJsonLogger } from '../../logger';

describe('JsonLoggerService', () => {
  let logger: JsonLoggerService;
  let stdoutSpy: jest.SpyInstance;
  let stderrSpy: jest.SpyInstance;

  beforeEach(() => {
    logger = new JsonLoggerService();
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  describe('configure', () => {
    it('should set service name', () => {
      logger.configure({
        serviceName: 'test-service',
        environment: 'production',
      });

      logger.setJsonEnabled(true);
      logger.log('test message');

      expect(stdoutSpy).toHaveBeenCalled();
      const output = JSON.parse(stdoutSpy.mock.calls[0][0].replace('\n', ''));
      expect(output.service).toBe('test-service');
    });

    it('should set environment', () => {
      logger.configure({
        serviceName: 'test',
        environment: 'staging',
      });

      logger.setJsonEnabled(true);
      logger.log('test message');

      const output = JSON.parse(stdoutSpy.mock.calls[0][0].replace('\n', ''));
      expect(output.environment).toBe('staging');
    });
  });

  describe('JSON logging', () => {
    beforeEach(() => {
      logger.configure({
        serviceName: 'hodlfun',
        environment: 'production',
      });
      logger.setJsonEnabled(true);
    });

    it('should output valid JSON for log level', () => {
      logger.log('test message');

      expect(stdoutSpy).toHaveBeenCalled();
      const output = JSON.parse(stdoutSpy.mock.calls[0][0].replace('\n', ''));

      expect(output.level).toBe('log');
      expect(output.message).toBe('test message');
      expect(output.timestamp).toBeDefined();
      expect(output.service).toBe('hodlfun');
    });

    it('should output valid JSON for error level', () => {
      logger.error('error message');

      expect(stderrSpy).toHaveBeenCalled();
      const output = JSON.parse(stderrSpy.mock.calls[0][0].replace('\n', ''));

      expect(output.level).toBe('error');
      expect(output.message).toBe('error message');
    });

    it('should output valid JSON for warn level', () => {
      logger.warn('warning message');

      const output = JSON.parse(stdoutSpy.mock.calls[0][0].replace('\n', ''));
      expect(output.level).toBe('warn');
    });

    it('should output valid JSON for debug level', () => {
      logger.debug('debug message');

      const output = JSON.parse(stdoutSpy.mock.calls[0][0].replace('\n', ''));
      expect(output.level).toBe('debug');
    });

    it('should output valid JSON for verbose level', () => {
      logger.verbose('verbose message');

      const output = JSON.parse(stdoutSpy.mock.calls[0][0].replace('\n', ''));
      expect(output.level).toBe('verbose');
    });

    it('should output valid JSON for fatal level', () => {
      logger.fatal('fatal message');

      expect(stderrSpy).toHaveBeenCalled();
      const output = JSON.parse(stderrSpy.mock.calls[0][0].replace('\n', ''));
      expect(output.level).toBe('fatal');
    });
  });

  describe('context handling', () => {
    beforeEach(() => {
      logger.configure({ serviceName: 'hodlfun', environment: 'production' });
      logger.setJsonEnabled(true);
    });

    it('should include context when provided as string', () => {
      logger.log('test message', 'TestContext');

      const output = JSON.parse(stdoutSpy.mock.calls[0][0].replace('\n', ''));
      expect(output.context).toBe('TestContext');
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      logger.configure({ serviceName: 'hodlfun', environment: 'production' });
      logger.setJsonEnabled(true);
    });

    it('should include error details when Error object provided', () => {
      const error = new Error('Test error');
      logger.error('An error occurred', error);

      const output = JSON.parse(stderrSpy.mock.calls[0][0].replace('\n', ''));
      expect(output.error).toBeDefined();
      expect(output.error.name).toBe('Error');
      expect(output.error.message).toBe('Test error');
      expect(output.error.stack).toBeDefined();
    });
  });

  describe('additional data', () => {
    beforeEach(() => {
      logger.configure({ serviceName: 'hodlfun', environment: 'production' });
      logger.setJsonEnabled(true);
    });

    it('should include additional data when object provided', () => {
      logger.log('test message', { userId: '123', action: 'login' });

      const output = JSON.parse(stdoutSpy.mock.calls[0][0].replace('\n', ''));
      expect(output.data).toBeDefined();
      expect(output.data.userId).toBe('123');
      expect(output.data.action).toBe('login');
    });
  });

  describe('timestamp format', () => {
    beforeEach(() => {
      logger.configure({ serviceName: 'hodlfun', environment: 'production' });
      logger.setJsonEnabled(true);
    });

    it('should use ISO 8601 format', () => {
      logger.log('test');

      const output = JSON.parse(stdoutSpy.mock.calls[0][0].replace('\n', ''));
      expect(output.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    });
  });

  describe('createJsonLogger', () => {
    it('should create a pre-configured logger', () => {
      const customLogger = createJsonLogger({
        serviceName: 'custom-service',
        environment: 'test',
        logLevel: 'debug',
      });

      expect(customLogger).toBeInstanceOf(JsonLoggerService);
    });
  });

  describe('setServiceName', () => {
    it('should update the service name', () => {
      logger.setServiceName('updated-service');
      logger.setJsonEnabled(true);
      logger.log('test');

      const output = JSON.parse(stdoutSpy.mock.calls[0][0].replace('\n', ''));
      expect(output.service).toBe('updated-service');
    });
  });
});
