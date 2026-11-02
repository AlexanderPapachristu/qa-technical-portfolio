import { test as base, expect } from '@playwright/test';
import * as fs from 'fs';

/// Origin of the instance under test (try.vikunja.io or the local Docker instance)
const ORIGIN = new URL(process.env.VIKUNJA_URL ?? 'http://localhost:3456').origin;

export const test = base.extend({
  context: async ({ context }, use) => {
    const state = JSON.parse(fs.readFileSync('playwright/.auth/user.json', 'utf8'));
    await context.addCookies(state.cookies);
    const items =
      state.origins.find((o: any) => o.origin === ORIGIN)?.localStorage ?? [];
    await context.addInitScript(({ items, origin }) => {
      if (location.origin !== origin || localStorage.getItem('token')) return;
      for (const { name, value } of items) localStorage.setItem(name, value);
    }, { items, origin: ORIGIN });
    await use(context);
  },
});
export { expect };
