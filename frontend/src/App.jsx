/**
 * App.jsx - Root Application Component
 *
 * This file serves as the main entry point for the React frontend application.
 * It manages routing, global layouts, performance optimizations (lazy loading, prefetching),
 * and provides global context providers like SocketProvider.
 */

import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { initTheme } from './utils/hostTheme'

import Navbar from './components/Navbar'
import Footer from './components/Footer'
import ProtectedRoute from './components/ProtectedRoute'
import SessionManager from './components/SessionManager'
import ScrollToTop from './components/ScrollToTop'
import Spinner from './components/Spinner'
import SocketProvider from './components/SocketProvider'
import { preloadAboutPage, preloadContactPage, preconnectPublicImages } from './utils/publicPagePerf'

// ==========================================
// Lazy-Loaded Page Components
// ==========================================

// --- Public Pages ---
const Home = lazy(() => {
  return import('./pages/Home')
})
const About = lazy(() => {
  return import('./pages/About')
})
const Services = lazy(() => {
  return import('./pages/Services')
})
const Contact = lazy(() => {
  return import('./pages/Contact')
})
const Login = lazy(() => {
  return import('./pages/Login')
})
const Signup = lazy(() => {
  return import('./pages/Signup')
})
const VerifyOTP = lazy(() => {
  return import('./pages/VerifyOTP')
})
const ForgotPassword = lazy(() => {
  return import('./pages/ForgotPassword')
})
const ResetPassword = lazy(() => {
  return import('./pages/ResetPassword')
})
const Unauthorized = lazy(() => {
  return import('./pages/Unauthorized')
})

// --- Property & Booking Pages ---
const PropertyDetails = lazy(() => {
  return import('./pages/PropertyDetails')
})
const HotelRoomsList = lazy(() => {
  return import('./pages/HotelRoomsList')
})
const ViewAllProperties = lazy(() => {
  return import('./pages/ViewAllProperties')
})
const ViewPropertyByCategory = lazy(() => {
  return import('./pages/ViewPropertyByCategory')
})
const CompareProperties = lazy(() => {
  return import('./pages/CompareProperties')
})
const ConfirmBooking = lazy(() => {
  return import('./pages/ConfirmBooking')
})
const CheckoutSuccess = lazy(() => {
  return import('./pages/CheckoutSuccess')
})
const CheckoutCancel = lazy(() => {
  return import('./pages/CheckoutCancel')
})

// --- Guest Pages ---
const ProfilePage = lazy(() => {
  return import('./pages/ProfilePage')
})
const GuestSettings = lazy(() => {
  return import('./pages/GuestSettings')
})
const GuestNotifications = lazy(() => {
  return import('./pages/GuestNotifications.jsx')
})
const MyBookings = lazy(() => {
  return import('./pages/MyBookings')
})
const UserPaymentDetails = lazy(() => {
  return import('./pages/host/UserPaymentDetails')
})
const Wishlist = lazy(() => {
  return import('./pages/Wishlist')
})
const WriteReview = lazy(() => {
  return import('./pages/WriteReview')
})
const FileComplaint = lazy(() => {
  return import('./pages/FileComplaint')
})
const MyComplaints = lazy(() => {
  return import('./pages/MyComplaints')
})
const ResubmitVerification = lazy(() => {
  return import('./pages/ResubmitVerification')
})
const UnderReview = lazy(() => {
  return import('./pages/UnderReview')
})

// --- Host Pages ---
const Layout = lazy(() => {
  return import('./pages/host/Layout')
})
const HostDashboard = lazy(() => {
  return import('./pages/host/HostDashboard')
})
const HostBookings = lazy(() => {
  return import('./pages/host/HostBookings')
})
const HostComplaints = lazy(() => {
  return import('./pages/host/HostComplaints')
})
const MyAccomodations = lazy(() => {
  return import('./pages/host/MyAccomodations')
})
const AddAccommodations = lazy(() => {
  return import('./pages/host/AddAccommodations')
})
const HostAccommodationDetail = lazy(() => {
  return import('./pages/host/HostAccommodationDetail')
})
const AllPayments = lazy(() => {
  return import('./pages/host/AllPayments')
})
const RefundRequestPayment = lazy(() => {
  return import('./pages/host/RefundRequestPayment')
})
const HostEarnings = lazy(() => {
  return import('./pages/host/HostEarnings')
})
const HostProfile = lazy(() => {
  return import('./pages/host/HostProfile')
})
const HostSettings = lazy(() => {
  return import('./pages/host/HostSettings')
})
const HostNotifications = lazy(() => {
  return import('./pages/host/HostNotifications')
})
const HostBookingDetail = lazy(() => {
  return import('./pages/host/HostBookingDetail')
})
// --- Admin Pages ---
const AdminLayout = lazy(() => {
  return import('./pages/admin/AdminLayout')
})
const AdminDashboard = lazy(() => {
  return import('./pages/admin/Dashboard')
})
const AdminBookings = lazy(() => {
  return import('./pages/admin/AdminBookings')
})
const AdminBookingDetail = lazy(() => {
  return import('./pages/admin/AdminBookingDetail')
})
const HostManagement = lazy(() => {
  return import('./pages/admin/HostManagement')
})
const UserManagement = lazy(() => {
  return import('./pages/admin/UserManagement')
})
const HostVerification = lazy(() => {
  return import('./pages/admin/KYCQueue')
})
const BlacklistManagement = lazy(() => {
  return import('./pages/admin/BlacklistManagement')
})
const ComplaintManagement = lazy(() => {
  return import('./pages/admin/ComplaintManagement')
})
const AdminProfile = lazy(() => {
  return import('./pages/admin/AdminProfile')
})
const AdminSettings = lazy(() => {
  return import('./pages/admin/AdminSettings')
})
const Analytics = lazy(() => {
  return import('./pages/admin/Analytics')
})
const AdminPayouts = lazy(() => {
  return import('./pages/admin/AdminPayouts')
})
const AdminRefunds = lazy(() => {
  return import('./pages/admin/AdminRefunds')
})
const AdminGate = lazy(() => {
  return import('./pages/admin/AdminGate')
})
const AdminNotifications = lazy(() => {
  return import('./pages/admin/AdminNotifications')
})

// ==========================================
// Configuration & Utilities
// ==========================================

// Secret admin path from env
const AP = import.meta.env.VITE_ADMIN_PATH || 'ctrl-bv5ap6'

const HIDE_NAV_FOOTER = [
  '/signup',
  '/login',
  '/verify-otp',
  '/unauthorized',
  '/forgot-password',
  '/under-review',
]

// ==========================================
// Helper Components
// ==========================================

/**
 * PageLoader - Simple full-height loading spinner for Suspense fallback.
 * @returns {JSX.Element}
 */
const PageLoader = () => {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Spinner size={28} />
    </div>
  )
}

// ==========================================
// Core Layout Component
// ==========================================

/**
 * AppLayout - Wraps the application routes and handles global layout logic.
 * Manages theme initialization, performance prefetching, and visibility of Navbar/Footer.
 * @returns {JSX.Element}
 */
const AppLayout = () => {
  const location = useLocation()
  const pathname = location.pathname

  const isHost = pathname.startsWith('/host/')
  const isAdmin = pathname.startsWith(`/${AP}`)
  const isReset = pathname.startsWith('/reset-password/')
  
  const shouldHide = HIDE_NAV_FOOTER.includes(pathname) || isHost || isAdmin || isReset

  /**
   * Effect: Initialize theme, preconnect images, and warm up public page cache.
   */
  useEffect(
    () => {
      // Setup
      initTheme()
      preconnectPublicImages()

      /**
       * warm - Prefetches common public pages to improve navigation speed.
       */
      const warm = () => {
        preloadAboutPage()
        preloadContactPage()
      }

      let idleId = null
      let timerId = null

      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        idleId = window.requestIdleCallback(warm, { timeout: 1500 })
      } else {
        timerId = window.setTimeout(warm, 1200)
      }

      // Cleanup
      return () => {
        if (idleId) {
          window.cancelIdleCallback?.(idleId)
        }
        if (timerId) {
          window.clearTimeout(timerId)
        }
      }
    },
    // Dependencies
    []
  )

  return (
    <SocketProvider>
      <div className="bv-grain">
        <SessionManager />
        <ScrollToTop />
        
        {
          !shouldHide && (
            <Navbar />
          )
        }

        <div className="site-shell min-h-screen">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* --- Public Routes --- */}
              <Route path="/" element={<Home />} />
              <Route path="/about" element={<About />} />
              <Route path="/services" element={<Services />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/verify-otp" element={<VerifyOTP />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password/:token" element={<ResetPassword />} />
              <Route path="/unauthorized" element={<Unauthorized />} />

              {/* --- Public Property Browsing --- */}
              <Route path="/property/:type/:id" element={<PropertyDetails />} />
              <Route path="/hotel/:id/rooms" element={<HotelRoomsList />} />
              <Route path="/property/:category" element={<ViewPropertyByCategory />} />
              <Route path="/view-all-properties" element={<ViewAllProperties />} />
              <Route path="/compare" element={<CompareProperties />} />

              {/* --- Guest Routes (Authenticated) --- */}
              <Route element={<ProtectedRoute />}>
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/guest-settings" element={<GuestSettings />} />
                <Route path="/notifications" element={<GuestNotifications />} />
                <Route path="/:type/confirm-booking/:id" element={<ConfirmBooking />} />
                <Route path="/booking-payment/checkout-success" element={<CheckoutSuccess />} />
                <Route path="/booking-payment/checkout-cancel" element={<CheckoutCancel />} />
                <Route path="/my-bookings" element={<MyBookings />} />
                <Route path="/my-bookings/:id" element={<UserPaymentDetails />} />
                <Route path="/wishlist" element={<Wishlist />} />
                <Route path="/write-review/:bookingId" element={<WriteReview />} />
                <Route path="/file-complaint" element={<FileComplaint />} />
                <Route path="/my-complaints" element={<MyComplaints />} />
              </Route>

              {/* Verification status pages — accessible to any logged-in user */}
              <Route element={<ProtectedRoute />}>
                <Route path="/resubmit-verification" element={<ResubmitVerification />} />
                <Route path="/under-review" element={<UnderReview />} />
              </Route>

              {/* --- Host Routes --- */}
              <Route element={<ProtectedRoute allowedRoles={['host']} />}>
                <Route path="/host" element={<Layout />}>
                  <Route path="dashboard" element={<HostDashboard />} />
                  <Route path="bookings" element={<HostBookings />} />
                  <Route path="complaints" element={<HostComplaints />} />
                  <Route path="accommodations" element={<MyAccomodations />} />
                  <Route path="accommodations/add" element={<AddAccommodations />} />
                  <Route path="accommodations/edit/:id" element={<AddAccommodations />} />
                  <Route path="accommodations/:id" element={<HostAccommodationDetail />} />
                  <Route path="payments/all-payments" element={<AllPayments />} />
                  <Route path="payments/request-refund-payments" element={<RefundRequestPayment />} />
                  <Route path="earnings" element={<HostEarnings />} />
                  <Route path="profile" element={<HostProfile />} />
                  <Route path="settings" element={<HostSettings />} />
                  <Route path="notifications" element={<HostNotifications />} />
                  <Route path="bookings/:id" element={<HostBookingDetail />} />
                </Route>
              </Route>

              {/* --- Admin Routes --- */}
              <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                <Route path={`/${AP}/gate`} element={<AdminGate />} />
                <Route path={`/${AP}`} element={<AdminLayout />}>
                  <Route path="dashboard" element={<AdminDashboard />} />
                  <Route path="bookings" element={<AdminBookings />} />
                  <Route path="bookings/:id" element={<AdminBookingDetail />} />
                  <Route path="management/hosts" element={<HostManagement />} />
                  <Route path="management/users" element={<UserManagement />} />
                  <Route path="host-verification" element={<HostVerification />} />
                  <Route path="complaints" element={<ComplaintManagement />} />
                  <Route path="blacklist" element={<BlacklistManagement />} />
                  <Route path="notifications" element={<AdminNotifications />} />
                  <Route path="profile" element={<AdminProfile />} />
                  <Route path="settings" element={<AdminSettings />} />
                  <Route path="analytics" element={<Analytics />} />
                  <Route path="payouts" element={<AdminPayouts />} />
                  <Route path="refunds" element={<AdminRefunds />} />
                </Route>
              </Route>
            </Routes>
          </Suspense>
        </div>

        {
          !shouldHide && (
            <Footer />
          )
        }

      </div>
    </SocketProvider>
  )
}

// ==========================================
// Entry Component
// ==========================================

/**
 * App - Main application wrapper that provides routing context.
 * @returns {JSX.Element}
 */
const App = () => {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  )
}

export default App
