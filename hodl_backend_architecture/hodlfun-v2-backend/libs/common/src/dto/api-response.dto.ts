export class ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    statusCode: number;
    message: string | string[];
    timestamp: string;
    path?: string;
  };

  static success<T>(data: T): ApiResponse<T> {
    return {
      success: true,
      data,
    };
  }

  static error(
    statusCode: number,
    message: string | string[],
    path?: string,
  ): ApiResponse<null> {
    return {
      success: false,
      error: {
        statusCode,
        message,
        timestamp: new Date().toISOString(),
        path,
      },
    };
  }
}
