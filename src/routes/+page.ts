import { redirect } from '@sveltejs/kit';
import { getStartingPage } from '$lib/utils/util';

export async function load() {
  const pagePath = getStartingPage();
  if (pagePath) {
    redirect(307, pagePath);
  }
}