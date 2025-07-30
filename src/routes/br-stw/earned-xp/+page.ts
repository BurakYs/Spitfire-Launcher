import { checkLogin } from '$lib/utils/util';

export async function load() {
  await checkLogin();
}