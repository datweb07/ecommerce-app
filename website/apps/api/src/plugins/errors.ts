import type { FastifyInstance } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from '@fastify/type-provider-zod';

const publicErrors: Record<number, [string, string]> = {
  400: ['BAD_REQUEST', 'Dữ liệu yêu cầu không hợp lệ.'],
  401: ['UNAUTHORIZED', 'Vui lòng đăng nhập.'],
  403: ['FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này.'],
  404: ['NOT_FOUND', 'Không tìm thấy tài nguyên.'],
  409: ['CONFLICT', 'Dữ liệu đã thay đổi. Vui lòng thử lại.'],
  413: ['PAYLOAD_TOO_LARGE', 'Dữ liệu gửi lên quá lớn.'],
  415: ['UNSUPPORTED_MEDIA_TYPE', 'Định dạng dữ liệu không được hỗ trợ.'],
  429: ['RATE_LIMITED', 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.'],
  503: ['UNAVAILABLE', 'Dịch vụ tạm thời chưa sẵn sàng.'],
};

export function registerErrors(app: FastifyInstance) {
  app.setErrorHandler((error: unknown, request, reply) => {
    const statusValue =
      typeof error === 'object' && error !== null && 'statusCode' in error
        ? error.statusCode
        : undefined;
    const status = hasZodFastifySchemaValidationErrors(error)
      ? 400
      : typeof statusValue === 'number' &&
          statusValue >= 400 &&
          statusValue <= 599
        ? statusValue
        : 500;
    const [code, message] = publicErrors[status] ?? [
      'INTERNAL_ERROR',
      'Đã xảy ra lỗi hệ thống.',
    ];
    if (status >= 500) {
      // Error messages/objects may contain credentials or request payloads.
      request.log.error(
        {
          statusCode: status,
          errorType: error instanceof Error ? error.name : 'UnknownError',
        },
        'Request failed',
      );
    }
    reply
      .status(status)
      .send({ error: { code, message }, requestId: request.id });
  });
  app.setNotFoundHandler((request, reply) =>
    reply.status(404).send({
      error: { code: 'NOT_FOUND', message: 'Không tìm thấy tài nguyên.' },
      requestId: request.id,
    }),
  );
}
