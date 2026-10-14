import Stripe from 'stripe';

export interface StripeRequest {
  readonly method: string;
  readonly path: string;
  readonly query: URLSearchParams;
  readonly form: URLSearchParams;
}

export interface StripeAnswer {
  readonly status?: number;
  readonly body: unknown;
}

export interface FakeStripe {
  readonly stripe: Stripe;
  readonly requests: StripeRequest[];
  readonly answer: (method: string, path: string, answer: StripeAnswer) => void;
}

const OK = 200;
const NOT_FOUND = 404;

export function fakeStripe(): FakeStripe {
  const requests: StripeRequest[] = [];
  const answers = new Map<string, StripeAnswer>();
  const fetchLike = (input: string, init?: RequestInit): Promise<Response> => {
    const url = new URL(input);
    const method = String(init?.method);
    const body = typeof init?.body === 'string' ? init.body : '';
    requests.push({
      method,
      path: url.pathname,
      query: url.searchParams,
      form: new URLSearchParams(body),
    });
    const answer = answers.get(`${method} ${url.pathname}`) ?? {
      status: NOT_FOUND,
      body: { error: { type: 'invalid_request_error', message: 'No such route in the fake' } },
    };
    return Promise.resolve(
      new Response(JSON.stringify(answer.body), {
        status: answer.status ?? OK,
        headers: { 'content-type': 'application/json', 'request-id': 'req_fake' },
      }),
    );
  };
  const stripe = new Stripe('sk_test_fake', {
    httpClient: Stripe.createFetchHttpClient(fetchLike as typeof fetch),
    maxNetworkRetries: 0,
  });
  return {
    stripe,
    requests,
    answer: (method, path, answer) => answers.set(`${method} ${path}`, answer),
  };
}
