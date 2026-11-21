// Toutes les requêtes réseau — conforme au CONTRAT_API.md (section 4)
import { clearSession, SESSION_EVENT, type Space } from './session';
import type {
  AdminStats,
  Booking,
  CompanyRef,
  CompanyStats,
  Driver,
  DriverSpace,
  DriverStats,
  Incident,
  Notification,
  PassengerLookup,
  Payment,
  Rating,
  Ticket,
  Trip,
  User,
} from './types';

export const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:4000/api';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
}

function spaceFromPath(path: string): Space {
  if (path.startsWith('/company/')) return 'company';
  // Les routes chauffeur utilisent le token passager (vitoo_session).
  return 'user';
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Impossible de joindre le serveur. Vérifiez votre connexion.', 0);
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* réponse vide */
  }

  if (!res.ok) {
    let message = `Erreur ${res.status}`;
    if (data && typeof data === 'object' && 'message' in data) {
      const m = (data as { message: unknown }).message;
      if (typeof m === 'string' && m) message = m;
    }
    if (res.status === 401 && token) {
      clearSession(spaceFromPath(path));
      window.dispatchEvent(new Event(SESSION_EVENT));
    }
    throw new ApiError(message, res.status);
  }
  return data as T;
}

/* ------------------------------ Auth ------------------------------ */

export type AuthResult = { user: User; token: string; driverSpace?: DriverSpace | null };

export type { PassengerLookup } from './types';

export const auth = {
  register: (body: { firstName: string; lastName: string; phone: string; password: string }) =>
    request<AuthResult>('/auth/register', { method: 'POST', body }),
  login: (body: { phone: string; password: string }) =>
    request<AuthResult>('/auth/login', { method: 'POST', body }),
  google: (idToken: string) =>
    request<AuthResult>('/auth/google', { method: 'POST', body: { idToken } }),
  forgotPassword: (phone: string) =>
    request<{ message: string; code?: string }>('/auth/forgot-password', { method: 'POST', body: { phone } }),
  resetPassword: (body: { phone: string; code: string; password: string }) =>
    request<{ message: string }>('/auth/reset-password', { method: 'POST', body }),
  forgotCompany: (email: string) =>
    request<{ message: string; code?: string }>('/company/auth/forgot-password', { method: 'POST', body: { email } }),
  resetCompany: (body: { email: string; code: string; password: string }) =>
    request<{ message: string }>('/company/auth/reset-password', { method: 'POST', body }),
  forgotAdmin: (phone: string) =>
    request<{ message: string; code?: string }>('/auth/admin/forgot-password', { method: 'POST', body: { phone } }),
  resetAdmin: (body: { phone: string; code: string; password: string }) =>
    request<{ message: string }>('/auth/admin/reset-password', { method: 'POST', body }),
  me: (token: string) => request<AuthResult>('/auth/me', { token }),
  patchMe: (
    token: string,
    body: Partial<Pick<User, 'firstName' | 'lastName' | 'city' | 'email' | 'phone' | 'avatarUrl'>> & {
      password?: string;
      currentPassword?: string;
    },
  ) => request<AuthResult>('/auth/me', { method: 'PATCH', token, body }),
  registerCompany: (body: {
    companyName: string;
    rccm?: string;
    taxId?: string;
    city: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    password: string;
  }) => request<AuthResult>('/company/auth/register', { method: 'POST', body }),
  loginCompany: (body: { email: string; password: string }) =>
    request<AuthResult>('/company/auth/login', { method: 'POST', body }),
  companyMe: (token: string) => request<{ user: User }>('/company/auth/me', { token }),
  patchCompanyMe: (token: string, body: Record<string, unknown>) =>
    request<{ user: User }>('/company/auth/me', { method: 'PATCH', token, body }),
};

/* --------------------------- Trajets publics --------------------------- */

export const tripsApi = {
  list: (params: { depart?: string; arrivee?: string; date?: string; company?: string }) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) q.set(k, v);
    });
    const qs = q.toString();
    return request<{ trips: Trip[] }>(`/trips${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => request<{ trip: Trip }>(`/trips/${encodeURIComponent(id)}`),
  companies: () => request<{ companies: CompanyRef[] | string[] }>('/trips/companies'),
  cities: () => request<{ cities: string[] }>('/trips/cities'),
  book: (id: string, body: { passengerName: string; passengerPhone: string; paymentMethod: string }, token?: string) =>
    request<{ booking: Booking; ticket: Ticket }>(`/trips/${encodeURIComponent(id)}/bookings`, {
      method: 'POST',
      body,
      token,
    }),
  mine: (token: string) => request<{ bookings: Booking[] }>('/trips/bookings/mine', { token }),
  rate: (id: string, token: string, body: { driverStars: number; companyStars: number; comment?: string }) =>
    request<{ rating: Rating }>(`/trips/${encodeURIComponent(id)}/rating`, { method: 'POST', token, body }),
};

/* ---------------------------- Paiement ---------------------------- */

export const paymentsApi = {
  initiate: (body: {
    tripId: string;
    passengerName: string;
    passengerPhone: string;
    passengerEmail?: string;
    method: string;
  }) => request<{ paymentId: string; paymentUrl: string; amount: number }>('/payments/initiate', { method: 'POST', body }),
  get: (id: string) => request<{ payment: Payment; booking?: Booking | null }>(`/payments/${encodeURIComponent(id)}`),
  confirm: (id: string) =>
    request<{ status: Payment['status']; booking?: Booking | null; ticket?: Ticket | null }>(
      `/payments/${encodeURIComponent(id)}/confirm`,
      { method: 'POST' },
    ),
};

/* -------------------------- Notifications -------------------------- */

export const notificationsApi = {
  list: (token: string) => request<{ notifications: Notification[]; unread: number }>('/notifications', { token }),
  readAll: (token: string) => request<{ success?: boolean }>('/notifications/read-all', { method: 'POST', token }),
  read: (token: string, id: string) =>
    request<{ success?: boolean }>(`/notifications/${encodeURIComponent(id)}/read`, { method: 'POST', token }),
};

/* ---------------------------- Compagnie ---------------------------- */

export const companyApi = {
  trips: (token: string) => request<{ trips: Trip[] }>('/company/trips', { token }),
  trip: (token: string, id: string) => request<{ trip: Trip }>(`/company/trips/${encodeURIComponent(id)}`, { token }),
  createTrip: (token: string, body: Record<string, unknown>) =>
    request<{ trip: Trip }>('/company/trips', { method: 'POST', token, body }),
  updateTrip: (token: string, id: string, body: Record<string, unknown>) =>
    request<{ trip: Trip }>(`/company/trips/${encodeURIComponent(id)}`, { method: 'PATCH', token, body }),
  deleteTrip: (token: string, id: string) =>
    request<{ success?: boolean }>(`/company/trips/${encodeURIComponent(id)}`, { method: 'DELETE', token }),

  drivers: (token: string) => request<{ drivers: Driver[] }>('/company/drivers', { token }),
  findPassenger: (token: string, phone: string) =>
    request<{ user: PassengerLookup | null }>(
      `/company/passengers?phone=${encodeURIComponent(phone)}`,
      { token },
    ),
  createDriver: (token: string, body: { phone: string; licenseNumber?: string }) =>
    request<{ driver: Driver }>('/company/drivers', { method: 'POST', token, body }),
  updateDriver: (token: string, id: string, body: Record<string, unknown>) =>
    request<{ driver: Driver }>(`/company/drivers/${encodeURIComponent(id)}`, { method: 'PATCH', token, body }),
  deleteDriver: (token: string, id: string) =>
    request<{ success?: boolean }>(`/company/drivers/${encodeURIComponent(id)}`, { method: 'DELETE', token }),

  vehicles: (token: string) => request<{ vehicles: VehicleType[] }>('/company/vehicles', { token }),
  createVehicle: (token: string, body: Record<string, unknown>) =>
    request<{ vehicle: VehicleType }>('/company/vehicles', { method: 'POST', token, body }),
  updateVehicle: (token: string, id: string, body: Record<string, unknown>) =>
    request<{ vehicle: VehicleType }>(`/company/vehicles/${encodeURIComponent(id)}`, { method: 'PATCH', token, body }),
  deleteVehicle: (token: string, id: string) =>
    request<{ success?: boolean }>(`/company/vehicles/${encodeURIComponent(id)}`, { method: 'DELETE', token }),

  sellTicket: (
    token: string,
    body: { tripId: string; passengerName: string; passengerPhone: string; seatNumber?: string; amount?: number },
  ) => request<{ ticket: Ticket }>('/company/tickets', { method: 'POST', token, body }),
  tickets: (token: string) => request<{ tickets: Ticket[] }>('/company/tickets', { token }),
  stats: async (token: string): Promise<CompanyStats> => {
    const data = await request<{ stats: CompanyStats & { tickets?: number }; recentSales?: Ticket[] }>('/company/stats', { token });
    return {
      ...data.stats,
      ticketsSold: data.stats.ticketsSold ?? data.stats.tickets ?? 0,
      recentSales: data.recentSales ?? data.stats.recentSales ?? [],
    };
  },
};

// Alias local pour éviter un import circulaire de types
type VehicleType = import('./types').Vehicle;

/* ----------------------------- Chauffeur ----------------------------- */

export const driverApi = {
  me: (token: string) => request<{ driver: Driver; companyName?: string }>('/driver/me', { token }),
  trips: (token: string) => request<{ trips: Trip[] }>('/driver/trips', { token }),
  trip: (token: string, id: string) => request<{ trip: Trip }>(`/driver/trips/${encodeURIComponent(id)}`, { token }),
  status: (token: string, status: string) => request<{ driver: Driver }>('/driver/status', { method: 'PATCH', token, body: { status } }),
  tripStatus: (token: string, id: string, status: 'boarding' | 'in_transit' | 'completed') =>
    request<{ trip: Trip }>(`/driver/trips/${encodeURIComponent(id)}/status`, { method: 'PATCH', token, body: { status } }),
  stop: (token: string, id: string, name: string) =>
    request<{ trip: Trip }>(`/driver/trips/${encodeURIComponent(id)}/stop`, { method: 'POST', token, body: { name } }),
  validate: (token: string, code: string) =>
    request<{ ticket: Ticket; booking?: Booking | null }>('/driver/tickets/validate', { method: 'POST', token, body: { code } }),
  incident: (token: string, body: { type: string; description?: string; tripId?: string }) =>
    request<{ incident: Incident }>('/driver/incidents', { method: 'POST', token, body }),
  incidents: (token: string) => request<{ incidents: Incident[] }>('/driver/incidents', { token }),
  stats: async (token: string): Promise<DriverStats> => {
    const data = await request<{ stats: { assigned?: number; upcoming?: number; inTransit?: number; completed?: number; incidents?: number; validated?: number } }>('/driver/stats', { token });
    return {
      ...data.stats,
      tripsCompleted: data.stats.completed ?? 0,
      tripsUpcoming: data.stats.upcoming ?? 0,
      passengers: data.stats.validated ?? 0,
      incidents: data.stats.incidents ?? 0,
    };
  },
};

/* ------------------------------- Admin ------------------------------- */

export const adminApi = {
  stats: async (token: string): Promise<AdminStats> => {
    const data = await request<{ stats: AdminStats & { byRole?: Record<string, number> } }>('/admin/stats', { token });
    const byRole = data.stats.byRole || {};
    return {
      ...data.stats,
      companies: byRole.company ?? 0,
      drivers: byRole.driver ?? 0,
      passengers: byRole.passenger ?? 0,
    };
  },
  users: (token: string, params: { role?: string; page?: number; limit?: number } = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') q.set(k, String(v));
    });
    const qs = q.toString();
    return request<{ users: User[]; total?: number }>(`/admin/users${qs ? `?${qs}` : ''}`, { token });
  },
  user: (token: string, id: string) => request<{ user: User }>(`/admin/users/${encodeURIComponent(id)}`, { token }),
  patchUser: (token: string, id: string, body: { role?: string }) =>
    request<{ user: User }>(`/admin/users/${encodeURIComponent(id)}`, { method: 'PATCH', token, body }),
  deleteUser: (token: string, id: string) =>
    request<{ message?: string; messageSent?: boolean }>(`/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE', token }),
};

/* -------------------------------- Santé ------------------------------- */

export const healthApi = () => request<{ status: string; service: string }>('/health');

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Une erreur est survenue.';
}

export function parseList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return value.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}
