import { PaginatedResult, PaginationMeta } from '../interfaces/api-response.interface';

export function buildPaginationMeta(total: number, page: number, limit: number): PaginationMeta {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

export function paginate<T>(data: T[], total: number, page: number, limit: number): PaginatedResult<T> {
  return { data, meta: buildPaginationMeta(total, page, limit) };
}
