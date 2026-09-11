export interface LicenseRecord {
  id: string;
  client_id: string;
  machine_id: string;
  machine_name: string;
  expires_at: string;
  status: 'ACTIVE' | 'BLOCKED' | 'EXPIRED';
  last_check_in: string | null;
  last_ip: string | null;
  created_at: string;
}

export interface ClientRecord {
  id: string;
  business_name: string;
  owner_name: string | null;
  phone: string;
  document: string | null;
  city: string | null;
  state: string | null;
  monthly_fee: number;
  status: 'ACTIVE' | 'BLOCKED' | 'CANCELLED';
  created_at: string;
  licenses?: LicenseRecord[];
}

export interface Metrics {
  totalClients: number;
  estimatedMonthlyRevenue: number;
  totalLicenses: number;
  activeLicenses: number;
  expiringSoon: number;
  expired: number;
  blocked: number;
}

export interface DevSettings {
  developer_name?: string;
  developer_phone?: string;
  pix_key?: string;
  default_monthly_fee?: string;
}
