import type { ArrivalRows, ArrivalsAsk, ArrivalsQuery } from '../domain/queries/arrivals';

export class StubArrivalsQuery implements ArrivalsQuery {
  readonly asked: ArrivalsAsk[] = [];
  rows: ArrivalRows = {
    visits: [],
    conversions: [],
    namedEvents: [],
    failedRequests: [],
    activeVisits: 0,
  };

  arrivals(ask: ArrivalsAsk): Promise<ArrivalRows> {
    this.asked.push(ask);
    return Promise.resolve(this.rows);
  }
}
