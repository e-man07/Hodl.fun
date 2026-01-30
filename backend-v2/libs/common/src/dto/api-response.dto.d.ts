export declare class ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: {
        statusCode: number;
        message: string | string[];
        timestamp: string;
        path?: string;
    };
    static success<T>(data: T): ApiResponse<T>;
    static error(statusCode: number, message: string | string[], path?: string): ApiResponse<null>;
}
