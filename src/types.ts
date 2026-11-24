// Types partagés — reflètent le modèle Prisma du CONTRAT_API.md

export type Role = 'passenger' | 'company' | 'driver' | 'admin';
export type DriverStatus = 'available' | 'on_trip' | 'off_duty';

/** Espace chauffeur exposé dans la session d'un passager promu. */
export interface DriverSpace {
  id: string;
  companyId: string;
  companyName: string;
  licenseNumber?: string | null;
  status: DriverStatus;
}
export type TripStatus = 'scheduled' | 'boarding' | 'in_transit' | 'completed' | 'cancelled';
export type BookingStatus = 'confirmed' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'failed';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string | null;
  city?: string | null;
  avatarUrl?: string | null;
  role: Role;
  /** Compte activé après vérification du code (SMS / e-mail). */
  verified: boolean;
  companyName?: string | null;
  rccm?: string | null;
  taxId?: string | null;
  companyLogo?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  paymentMethods?: string | string[] | null;
  /** Présent lorsque le passager a été promu chauffeur par une compagnie. */
  driverSpace?: DriverSpace | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Résultat d'une recherche de passager par numéro de téléphone. */
export interface PassengerLookup {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  avatarUrl?: string | null;
}

export interface Driver {
  id: string;
  userId: string;
  companyId: string;
  licenseNumber?: string | null;
  status: DriverStatus;
  user?: User;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  trips?: Trip[];
}

export interface Vehicle {
  id: string;
  companyId: string;
  plateNumber: string;
  brand?: string | null;
  model?: string | null;
  capacity?: number | null;
  photo?: string | null;
  isActive: boolean;
}

export interface CompanyRef {
  id?: string;
  name?: string;
  companyName?: string;
  primaryColor?: string;
  secondaryColor?: string;
  logo?: string;
}

export interface Trip {
  id: string;
  companyId?: string;
  driverId?: string | null;
  vehicleId?: string | null;
  depart: string;
  arrivee: string;
  station?: string | null;
  date: string;
  time: string;
  duration?: string | null;
  price: number;
  availableSeats: number;
  paymentMethods?: string | string[] | null;
  stops?: string | null;
  status: TripStatus;
  company?: string | CompanyRef | null;
  driverName?: string | null;
  driverRating?: number | null;
  vehiclePlate?: string | null;
  bookings?: Booking[];
  tickets?: Ticket[];
  incidents?: Incident[];
  ratings?: Rating[];
}

export interface Booking {
  id: string;
  userId?: string;
  tripId: string;
  passengerName: string;
  passengerPhone: string;
  seats: number;
  seatNumber?: string | null;
  amount: number;
  paymentMethod: string;
  status: BookingStatus;
  createdAt?: string;
  trip?: Trip;
  ticket?: Ticket | null;
  user?: User;
}

export interface Payment {
  id: string;
  tripId?: string;
  bookingId?: string | null;
  amount: number;
  transactionId?: string;
  status: PaymentStatus;
  channel?: string | null;
  paymentUrl?: string | null;
  errorMessage?: string | null;
  booking?: Booking | null;
}

export interface Ticket {
  id: string;
  bookingId?: string | null;
  tripId: string;
  companyId?: string;
  code: string;
  qrData?: string | null;
  seatNumber?: string | null;
  passengerName?: string | null;
  passengerPhone?: string | null;
  paymentMethod?: string | null;
  amount?: number | null;
  soldBy?: 'online' | 'counter';
  status: string;
  validatedBy?: string | null;
  validatedAt?: string | null;
  createdAt?: string;
  trip?: Trip;
  booking?: Booking | null;
}

export interface Notification {
  id: string;
  userId?: string;
  tripId?: string | null;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt?: string;
  trip?: Trip | null;
}

export interface Rating {
  id: string;
  userId?: string;
  tripId: string;
  driverStars: number;
  companyStars: number;
  comment?: string | null;
  createdAt?: string;
}

export interface Incident {
  id: string;
  tripId: string;
  driverId: string;
  type: string;
  description?: string | null;
  resolved: boolean;
  createdAt?: string;
}

export interface CompanyStats {
  activeTrips?: number;
  ticketsSold?: number;
  drivers?: number;
  vehicles?: number;
  revenue?: number;
  bookings?: number;
  recentSales?: Ticket[];
  byMethod?: Array<{ method: string; count: number; amount?: number }>;
  [key: string]: unknown;
}

export interface DriverStats {
  tripsCompleted?: number;
  tripsUpcoming?: number;
  passengers?: number;
  incidents?: number;
  [key: string]: unknown;
}

export interface AdminStats {
  users?: number;
  companies?: number;
  drivers?: number;
  passengers?: number;
  trips?: number;
  bookings?: number;
  revenue?: number;
  [key: string]: unknown;
}

export interface ApiErrorShape {
  message: string;
  status: number;
}
