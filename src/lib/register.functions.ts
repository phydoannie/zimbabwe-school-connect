import { createServerFn } from '@tanstack/react-start';

// Public: creates only the first (head) account for a brand-new school. The school
// itself is created afterwards by that signed-in user via create_school, which
// makes them head of that school only; no access to other schools is granted.
export const registerSchoolAccount = createServerFn({ method: 'POST' })
  .handler(async () => {
    throw new Error('School registration is managed by the platform owner.');
  });
