import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { BarChart3, BusFront, CarFront, ClipboardList, Home, LayoutDashboard, QrCode, ScanLine, Ticket, UserCog, Users } from 'lucide-react';
import { Guard } from './components/Guard';
import { AppShell, type NavItem } from './components/AppShell';
import { useApp } from './lib/context';
import { Loading } from './lib/ui';
import { AdminLogin, CompanyAuth, PassengerAuth, SpaceForgotPassword, VerifyPage } from './pages/Auth';
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

const passengerNav = (t: (key: 'search' | 'myTickets' | 'bookings' | 'profile') => string): NavItem[] => [
  { to: '/passenger', label: t('search'), icon: Home, end: true },
  { to: '/passenger/tickets', label: t('myTickets'), icon: Ticket },
  { to: '/passenger/bookings', label: t('bookings'), icon: ClipboardList },
  { to: '/passenger/profile', label: t('profile'), icon: UserCog },
];

const companyNav = (t: (key: 'overview' | 'trips' | 'counter' | 'stats' | 'team' | 'profile') => string): NavItem[] => [
  { to: '/company/overview', label: t('overview'), icon: LayoutDashboard },
  { to: '/company/trips', label: t('trips'), icon: BusFront },
  { to: '/company/counter', label: t('counter'), icon: QrCode },
  { to: '/company/stats', label: t('stats'), icon: BarChart3 },
  { to: '/company/team', label: t('team'), icon: CarFront },
  { to: '/company/profile', label: t('profile'), icon: UserCog },
];

const driverNav = (t: (key: 'missions' | 'scan' | 'incidents' | 'profile') => string): NavItem[] => [
  { to: '/driver/missions', label: t('missions'), icon: ClipboardList },
  { to: '/driver/scan', label: t('scan'), icon: ScanLine },
  { to: '/driver/incidents', label: t('incidents'), icon: BarChart3 },
  { to: '/driver/profile', label: t('profile'), icon: UserCog },
];

const adminNav = (t: (key: 'dashboard' | 'users') => string): NavItem[] => [
  { to: '/admin/dashboard', label: t('dashboard'), icon: LayoutDashboard },
  { to: '/admin/users', label: t('users'), icon: Users },
];

function PassengerLayout() {
  const { userSession, t } = useApp();
  return (
    <AppShell
      space="passenger"
      nav={passengerNav(t)}
      bellToken={userSession?.token}
      bellRating
      profileTo="/passenger/profile"
      profileLabel={t('profile')}
    >
      <Outlet />
    </AppShell>
  );
}

function CompanyLayout() {
  const { companySession, t } = useApp();
  return (
    <AppShell
      space="company"
      nav={companyNav(t)}
      profileTo="/company/profile"
      profileLabel={t('company')}
      accentColor={companySession?.user.primaryColor || undefined}
      secondaryColor={companySession?.user.secondaryColor || undefined}
    >
      <Outlet />
    </AppShell>
  );
}

function DriverLayout() {
  const { t } = useApp();
  return <AppShell space="driver" nav={driverNav(t)} profileTo="/driver/profile" profileLabel={t('profile')}><Outlet /></AppShell>;
}

function AdminLayout() {
  const { t } = useApp();
  return <AppShell space="admin" nav={adminNav(t)}><Outlet /></AppShell>;
}

function CompanyEntry() {
  const { ready, companySession } = useApp();
  if (!ready) return <Loading />;
  return companySession ? <Navigate to="/company/overview" replace /> : <CompanyAuth mode="login" />;
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

        {/* Vérification des comptes — déclaré avant les routes protégées */}
        <Route path="/verify" element={<VerifyPage space="passenger" />} />
        <Route path="/company/verify" element={<VerifyPage space="company" />} />
        <Route path="/admin/verify" element={<VerifyPage space="admin" />} />

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
        <Route path="/company/forgot" element={<SpaceForgotPassword space="company" />} />
        <Route path="/company" element={<Guard space="company"><CompanyLayout /></Guard>}>
          <Route path="overview" element={<CompanyOverviewPage />} />
          <Route path="trips" element={<CompanyTripsPage />} />
          <Route path="counter" element={<CompanyCounterPage />} />
          <Route path="stats" element={<CompanyStatsPage />} />
          <Route path="team" element={<CompanyTeamPage />} />
          <Route path="profile" element={<CompanyProfilePage />} />
        </Route>

        {/* Espace chauffeur : accès depuis le profil passager, pas de /driver/login */}
        <Route path="/driver" element={<Navigate to="/driver/missions" replace />} />
        <Route path="/driver" element={<Guard space="driver"><DriverLayout /></Guard>}>
          <Route path="missions" element={<DriverMissionsPage />} />
          <Route path="missions/:id" element={<DriverMissionDetailPage />} />
          <Route path="scan" element={<DriverScanPage />} />
          <Route path="incidents" element={<DriverIncidentsPage />} />
          <Route path="profile" element={<DriverProfilePage />} />
        </Route>

        {/* Administration */}
        <Route path="/admin/forgot" element={<SpaceForgotPassword space="admin" />} />
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
