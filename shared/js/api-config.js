export const BASE_URL = 'https://sbookapi.madrasatulhuda.com';
export const MOCK_DELAY = 600; // ms

// Master switch — set false to go fully live
export const USE_MOCK = false;

// Per-module overrides: set false individually to test each module with real API
// (only checked when USE_MOCK = true; if USE_MOCK = false, all use real API)
export const MOCK = {
  auth:       true,
  dashboard:  true,
  attendance: true,
  leave:      true,
  homework:   true,
  fees:       true,
  exam:       true,
  notice:     true,
  marks:      true,
};

export function mockDelay(data) {
  return new Promise(resolve => setTimeout(() => resolve(data), MOCK_DELAY));
}

// Helper: returns true if the given module should use mock
export function useMock(module) {
  return USE_MOCK && (MOCK[module] !== false);
}
