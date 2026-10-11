// An old account's response must never populate a newer account's interface.
export class PrivateRequestScope {
 private revision = 0;
 private controller = new AbortController();
 capture() { return { revision: this.revision, signal: this.controller.signal }; }
 current(snapshot: { revision: number; signal: AbortSignal }) {
  return snapshot.revision === this.revision && !snapshot.signal.aborted;
 }
 invalidate() {
  this.controller.abort();
  this.revision++;
  this.controller = new AbortController();
 }
}
