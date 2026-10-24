export interface Activity {
  run_id: number;
  name: string;
  distance: number; // meters
  moving_time: string; // "H:MM:SS"
  elapsed_time?: string; // "H:MM:SS"
  type: 'Run' | string;
  subtype?: string;
  start_date: string;
  start_date_local: string;
  location_country: string | null;
  summary_polyline: string | null;
  average_heartrate: number | null;
  average_speed: number; // m/s
  elevation_gain: number | null;
  source: string;
  streak: number;
  /** 降采样心率序列（bpm，null 表示该桶无读数），驱动会话时钟与心率图 */
  hr_series?: (number | null)[] | null;
  /** 能量消耗（kcal） */
  calories?: number | null;
}

export type SportFilter = 'all' | 'Run';
