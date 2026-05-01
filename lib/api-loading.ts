type LoadingListener = (isLoading: boolean, pendingCount: number) => void;

let pendingCount = 0;
const listeners = new Set<LoadingListener>();

function emit() {
  const isLoading = pendingCount > 0;
  listeners.forEach((listener) => listener(isLoading, pendingCount));
}

export function beginApiRequest() {
  pendingCount += 1;
  emit();
}

export function endApiRequest() {
  pendingCount = Math.max(0, pendingCount - 1);
  emit();
}

export function subscribeApiLoading(listener: LoadingListener) {
  listeners.add(listener);
  listener(pendingCount > 0, pendingCount);
  return () => {
    listeners.delete(listener);
  };
}

