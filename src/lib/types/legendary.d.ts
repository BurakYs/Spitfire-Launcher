import type { parsedAppSchema } from '$lib/validations/settings';
import { z } from 'zod/v4';

export type AppFilterValue = 'hidden' | 'installed' | 'updatesAvailable';

export type LegendaryList = Array<{
  metadata: {
    customAttributes: Record<string, {
      type: string;
      value: string;
    }>
    categories: Array<{
      path: string;
    }>;
    description: string;
    developer: string;
    entitlementName: string;
    entitlementType: string;
    keyImages: Array<{
      height: number;
      md5: string;
      size: number;
      type: string;
      uploadedDate: string;
      url: string;
      width: number;
    }>;
    longDescription: string;
    title: string;
    unsearchable: boolean;
  };
  asset_infos: Record<string, {
    app_name: string;
    asset_id: string;
    build_version: string;
    catalog_item_id: string;
    label_name: string;
    namespace: string;
    metadata: Record<string, any>;
  }>
  app_name: string;
  app_title: string;
}>

export type LegendaryStatus = {
  account: string | null;
  games_available: number;
  games_installed: number;
  egl_sync_enabled: boolean;
  config_directory: string;
};

export type LegendaryAppInfo = {
  game: {
    app_name: string;
    title: string;
    version: string;
    platform_versions: Record<string, string>;
    cloud_saves_supported: boolean;
    cloud_save_folder: string | null;
    cloud_save_folder_mac: string | null;
    is_dlc: boolean;
    external_activation: string | null;
    launch_options: Array<string>;
    owned_dlc: Array<string>;
  };
  install: {
    platform: string;
    version: string;
    disk_size: number;
    install_path: string;
    save_path: string | null;
    synced_egl_guid: string;
    install_tags: Array<string>;
    requires_ovt: number;
    installed_dlc: Array<string>;
  };
  manifest: {
    size: number;
    type: string;
    version: number;
    feature_level: number;
    app_name: string;
    launch_exe: string;
    launch_command: string;
    build_version: string;
    build_id: string;
    prerequisites: null | Record<string, any>;
    uninstaller: {
      path: string;
      args: string;
    };
    install_tags: Array<string>;
    num_files: number;
    num_chunks: number;
    disk_size: number;
    download_size: number;
    tag_disk_size: Array<{
      tag: string;
      size: number;
      count: number;
    }>;
    tag_download_size: Array<{
      tag: string;
      size: number;
      count: number;
    }>;
  };
};

export type LegendaryInstalledList = Array<{
  app_name: string;
  install_path: string;
  title: string;
  version: string;
  base_urls: Array<string>;
  can_run_offline: boolean;
  egl_guid: string;
  executable: string;
  install_size: number;
  install_tags: Array<string>;
  is_dlc: boolean;
  launch_parameters: string;
  manifest_path: string;
  needs_verification: boolean;
  platform: string;
  prereq_info: null | Record<string, any>;
  uninstaller: {
    path: string;
    args: string;
  };
  requires_ot: number;
  save_path: string | null;
}>;

export type ParsedApp = z.infer<typeof parsedAppSchema>;

export type LegendaryLaunchData = {
  game_parameters: Array<string>;
  game_executable: string;
  game_directory: string;
  egl_parameters: Array<string>;
  launch_command: Array<string>;
  working_directory: string;
  user_parameters: Array<string>;
  environment: Record<string, string>;
  pre_launch_command: string;
  pre_launch_wait: boolean;
};