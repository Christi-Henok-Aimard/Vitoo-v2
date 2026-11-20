import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { BarChart3, BusFront, CarFront, ClipboardList, Home, LayoutDashboard, QrCode, ScanLine, Ticket, UserCog, Users } from 'lucide-react';
import { Guard } from './components/Guard';
import { AppShell, type NavItem } from './components/AppShell';
import { Loading } from './lib/ui';
import { useApp } from './lib/context';
import { AdminLogin, CompanyAuth, DriverLogin, PassengerAuth } from './pages/Auth';
import { SearchPage } from './pages/passenger/Search';
import { TripDetailPage } from './pages/passenger/TripDetail';
import { BookingPage } from './pages/passenger/Booking';
import { PaymentReturnPage } from './pages/passenger/PaymentReturn';
import { BookingsPage, TicketsPage } from './pages/passenger/Tickets';
import { PassengerProfilePage } from './pages/passenger/Profile';
import { CompanyOverviewPage } from './pages/company/Overview';
import { CompanyTripsPage } from './pages/company/Trips';
import { CompanyCounterPage } from './pages/company/Counter';
import { CompanyStatsPage } from './pages/company/Stats';
import { CompanyTeamPage } from './pages/company/Team';
import { CompanyProfilePage } from './pages/company/Profile';
import { DriverMissionsPage } from './pages/driver/Missions';
import { DriverMissionDetailPage } from './pages/driver/MissionDetail';
import { DriverScanPage } from './pages/driver/Scan';
import { DriverIncidentsPage, DriverProfilePage } from './pages/driver/Profile';
import { AdminDashboardPage } from './pages/admin/Admin';
import { Toasts } from './lib/ui';

const passengerNav: NavItem[] = [
  { to: '/passenger', label: 'Rechercher', icon: Home, end: true },
  { to: '/passenger/tickets', label: 'Mes billets', icon: Ticket },
  { to: '/passenger/bookings', label: 'Réservations', icon: ClipboardList },
  { to: '/passenger/profile', label: 'Mon profil', icon: UserCog },
];

const companyNav: NavItem[] = [
  { to: '/company/overview', label: 'Aperçu', icon: LayoutDashboard },
  { to: '/company/trips', label: 'Trajets', icon: BusFront },
  { to: '/company/counter', label: 'Guichet', icon: QrCode },
  { to: '/company/stats', label: 'Statistiques', icon: BarChart3 },
  { to: '/company/team', label: 'Équipe & flotte', icon: CarFront },
  { to: '/company/profile', label: 'Profil', icon: UserCog },
];

const driverNav: NavItem[] = [
  { to: '/driver/missions', label: 'Missions', icon: ClipboardList },
  { to: '/driver/scan', label: 'Scanner', icon: ScanLine },
  { to: '/driver/incidents', label: 'Incidents', icon: BarChart3 },
  { to: '/driver/profile', label: 'Profil', icon: UserCog },
];

const adminNav: NavItem[] = [
  { to: '/admin/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { to: '/admin/users', label: 'Utilisateurs', icon: Users },
];

function PassengerLayout() {
  const { userSession } = useApp();
  return (
    <AppShell
      space="passenger"
      nav={passengerNav}
      bellToken={userSession?.token}
      bellRating
      profileTo="/passenger/profile"
      profileLabel="Mon profil"
    >
      <Outlet />
    </AppShell>
  );
}

function CompanyLayout() {
  const { companySession } = useApp();
  return (
    <AppShell
      space="company"
      nav={companyNav}
      profileTo="/company/profile"
      profileLabel="Profil compagnie"
      accentColor={companySession?.user.primaryColor || undefined}
    >
      <Outlet />
    </AppShell>
  );
}

function DriverLayout() {
  return <AppShell space="driver" nav={driverNav} profileTo="/driver/profile" profileLabel="Mon profil"><Outlet /></AppShell>;
}

function AdminLayout() {
  return <AppShell space="admin" nav={adminNav}><Outlet /></AppShell>;
}

function CompanyEntry() {
  const { ready, companySession } = useApp();
  if (!ready) return <Loading />;
  return companySession ? <Navigate to="/company/overview" replace /> : <CompanyAuth mode="login" />;
}

function DriverEntry() {
  const { ready, driverSession } = useApp();
  if (!ready) return <Loading />;
  return driverSession ? <Navigate to="/driver/missions" replace /> : <DriverLogin />;
}

function AdminEntry() {
  const { ready, userSession } = useApp();
  if (!ready) return <Loading />;
  if (userSession?.user.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
  return <AdminLogin />;
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to="/passenger" replace />} />

        {/* Auth passager / admin */}
        <Route path="/passenger/login" element={<PassengerAuth mode="login" />} />
        <Route path="/passenger/register" element={<PassengerAuth mode="register" />} />
        <Route path="/passenger/forgot" element={<PassengerAuth mode="forgot" />} />
        <Route path="/passenger/reset" element={<PassengerAuth mode="reset" />} />

        {/* Espace passager */}
        <Route path="/passenger" element={<Guard space="passenger"><PassengerLayout /></Guard>}>
          <Route index element={<SearchPage />} />
          <Route path="trips/:id" element={<TripDetailPage />} />
          <Route path="book/:id" element={<BookingPage />} />
          <Route path="payment-return" element={<PaymentReturnPage />} />
          <Route path="tickets" element={<TicketsPage />} />
          <Route path="bookings" element={<BookingsPage />} />
          <Route path="profile" element={<PassengerProfilePage />} />
        </Route>

        {/* Espace compagnie */}
        <Route path="/company" element={<CompanyEntry />} />
        <Route path="/company/login" element={<CompanyAuth mode="login" />} />
        <Route path="/company/register" element={<CompanyAuth mode="register" />} />
        <Route path="/company" element={<Guard space="company"><CompanyLayout /></Guard>}>
          <Route path="overview" element={<CompanyOverviewPage />} />
          <Route path="trips" element={<CompanyTripsPage />} />
          <Route path="counter" element={<CompanyCounterPage />} />
          <Route path="stats" element={<CompanyStatsPage />} />
          <Route path="team" element={<CompanyTeamPage />} />
          <Route path="profile" element={<CompanyProfilePage />} />
        </Route>

        {/* Espace chauffeur */}
        <Route path="/driver" element={<DriverEntry />} />
        <Route path="/driver/login" element={<DriverLogin />} />
        <Route path="/driver" element={<Guard space="driver"><DriverLayout /></Guard>}>
          <Route path="missions" element={<DriverMissionsPage />} />
          <Route path="missions/:id" element={<DriverMissionDetailPage />} />
          <Route path="scan" element={<DriverScanPage />} />
          <Route path="incidents" element={<DriverIncidentsPage />} />
          <Route path="profile" element={<DriverProfilePage />} />
        </Route>

        {/* Administration */}
        <Route path="/admin" element={<AdminEntry />} />
        <Route path="/admin" element={<Guard space="admin"><AdminLayout /></Guard>}>
          <Route path="dashboard" element={<AdminDashboardPage />} />
          <Route path="users" element={<AdminDashboardPage />} />
          <Route path="users/:id" element={<AdminDashboardPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/passenger" replace />} />
      </Routes>
      <Toasts />
    </>
  );
}
