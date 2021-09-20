export function wait(t: number) {
  return new Promise((r) => setTimeout(r, t));
}
