import { test as base, expect } from '@playwright/test';
import * as fs from 'fs';

export const test = base.extend({
  context: async ({ context }, use) => {
    const state = JSON.parse(fs.readFileSync('playwright/.auth/user.json', 'utf8'));
    await context.addCookies(state.cookies);
    const items =
      state.origins.find((o: any) => o.origin === 'https://try.vikunja.io')?.localStorage ?? [];
    await context.addInitScript((items) => {
      if (location.origin !== 'https://try.vikunja.io' || localStorage.getItem('token')) return;
      for (const { name, value } of items) localStorage.setItem(name, value);
    }, items);
    await use(context);
  },
});
export { expect };