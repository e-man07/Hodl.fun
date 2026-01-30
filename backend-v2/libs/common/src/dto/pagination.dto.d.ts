export declare class PaginationDto {
    page?: number;
    limit?: number;
}
export interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}
export declare class PaginatedResponse<T> {
    data: T[];
    meta: PaginationMeta;
    constructor(data: T[], meta: PaginationMeta);
    static create<T>(data: T[], page: number, limit: number, total: number): PaginatedResponse<T>;
}
