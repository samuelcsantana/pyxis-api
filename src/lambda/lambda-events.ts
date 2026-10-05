import type { APIGatewayProxyEventV2 } from 'aws-lambda';

export function isFunctionUrlEvent(event: unknown): event is APIGatewayProxyEventV2 {
  if (typeof event !== 'object' || event === null || !('requestContext' in event)) {
    return false;
  }
  const { requestContext } = event;
  if (
    typeof requestContext !== 'object' ||
    requestContext === null ||
    !('http' in requestContext)
  ) {
    return false;
  }
  const { http } = requestContext;
  return (
    typeof http === 'object' && http !== null && 'method' in http && typeof http.method === 'string'
  );
}
