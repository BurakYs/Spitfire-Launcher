import { Command } from '@tauri-apps/plugin-shell';

export default class Legendary {
  static async execute(args: string[]) {
    const cmd = Command.sidecar('../bin/legendary', args)
    return await cmd.execute()
  }
}