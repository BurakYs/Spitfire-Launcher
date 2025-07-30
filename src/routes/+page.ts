import { redirect } from '@sveltejs/kit';
import { getStartingPage } from '$lib/utils/util';

export async function load() {
  redirect(307, getStartingPage());
}