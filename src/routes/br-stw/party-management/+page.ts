import { checkLogin } from '$lib/utils/util';

export async function load() {
  checkLogin();
}