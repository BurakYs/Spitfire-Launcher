export type LightswitchData = {
  serviceInstanceId: string;
  status: string;
  message: string;
  maintenanceUri?: string;
  overrideCatalogIds: string[];
  allowedActions: string[];
  banned: boolean;
  launcherInfoDTO: {
    appName: string;
    catalogItemId: string;
    namespace: string;
  };
};

export type WaitingRoomData = {
  expectedWait: number;
};

export type ServerStatusSummaryData = {
  page: {
    id: string;
    name: string;
    url: string;
    time_zone: string;
    updated_at: string;
  };
  components: {
    id: string;
    name: string;
    status: string;
    created_at: Date;
    updated_at: Date;
    position: number;
    description?: any;
    showcase: boolean;
    start_date: string;
    group_id: string;
    page_id: string;
    group: boolean;
    only_show_if_degraded: boolean;
    components: string[];
  }[];
  incidents: any[];
  scheduled_maintenances: any[];
  status: {
    indicator: string;
    description: string;
  };
};