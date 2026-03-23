export interface SurveyData {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  officer: string;
  power: string;
  meter: string;
  voltage: string;
  status: 'pending' | 'approved' | 'rejected';
  modifiedBy?: string;
  modifiedAt?: string;
  createdAt: string;
}

export interface FilterState {
  judulLokasi: string;
  petugas: string;
  tanggal: string;
  status: string;
}
