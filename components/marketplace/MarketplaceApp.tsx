'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Menu, X, Mic, Search, Heart, MapPin, Calendar, ArrowRight,
  Car, User, MessageCircle, Star, Instagram, Twitter, Mail,
} from 'lucide-react';
import { vehicles, Vehicle, PageType } from './data';
import { Logo } from './shared';
import HomePage from './HomePage';
import SearchPage from './SearchPage';
import VehicleDetailPage from './VehicleDetailPage';
import BookingPage from './BookingPage';
import RariWidget from './RariWidget';
import { TripsPage, FavoritesPage, MessagesPage } from './SecondaryPages';
import OperatorDashboard from './OperatorDashboard';

/* ============================================================
   NAVBAR
   ============================================================ */
function Navbar({
  navigate,
  currentPage,
  onRariOpen,
  favCount,
}: {
  navigate: (page: PageType, vehicleId?: number) => void;
  currentPage: PageType;
  onRariOpen: () => void;
  favCount: number;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on page change
  useEffect(() => {
    setMobileOpen(false);
  }, [currentPage]);

  const isTransparent = currentPage === 'home' && !scrolled;

  const navLinks = [
    { label: 'Explore', page: 'search' as PageType },
    { label: 'My Trips', page: 'trips' as PageType },
    { label: 'Favorites', page: 'favorites' as PageType },
    { label: 'Messages', page: 'messages' as PageType },
  ];

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        backgroundColor: isTransparent ? 'transparent' : 'rgba(11,11,15,0.92)',
        backdropFilter: isTransparent ? 'none' : 'blur(20px)',
        borderBottom: isTransparent ? 'none' : '1px solid rgba(110,193,228,0.08)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <button
            onClick={() => navigate('home')}
            className="flex items-center group"
          >
            <Logo size={32} />
          </button>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-8">
            {navLinks.map(link => (
              <button
                key={link.label}
                onClick={() => navigate(link.page)}
                className="text-sm font-medium transition-colors duration-200 hover:text-[#6EC1E4] relative pb-1"
                style={{ color: currentPage === link.page ? '#6EC1E4' : '#8888A0' }}
              >
                {link.label}
                {/* Active indicator */}
                {currentPage === link.page && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full" style={{ backgroundColor: '#6EC1E4' }} />
                )}
                {link.page === 'favorites' && favCount > 0 && (
                  <span
                    className="absolute -top-1.5 -right-3 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
                    style={{ backgroundColor: '#6EC1E4', color: '#0B0B0F' }}
                  >
                    {favCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={onRariOpen}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-300 hover:bg-[rgba(110,193,228,0.15)]"
              style={{ border: '1px solid rgba(110,193,228,0.25)' }}
            >
              <Mic size={13} color="#6EC1E4" />
              <span className="text-xs font-medium" style={{ color: '#6EC1E4' }}>Rari AI</span>
            </button>
            <button
              onClick={() => navigate('search')}
              className="px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 hover:bg-[#8AD0EA]"
              style={{ backgroundColor: '#6EC1E4', color: '#0B0B0F' }}
            >
              Book Now
            </button>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 rounded-lg transition-colors hover:bg-white/5"
            >
              {mobileOpen ? <X size={20} color="#F0F0F5" /> : <Menu size={20} color="#F0F0F5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div
          className="lg:hidden border-t px-6 py-6 space-y-1"
          style={{
            backgroundColor: 'rgba(11,11,15,0.98)',
            backdropFilter: 'blur(20px)',
            borderColor: 'rgba(110,193,228,0.08)',
          }}
        >
          {[
            { label: 'Explore Vehicles', page: 'search' as PageType, icon: Search },
            { label: 'My Trips', page: 'trips' as PageType, icon: Car },
            { label: 'Favorites', page: 'favorites' as PageType, icon: Heart },
            { label: 'Messages', page: 'messages' as PageType, icon: MessageCircle },
          ].map(link => (
            <button
              key={link.label}
              onClick={() => navigate(link.page)}
              className="flex items-center gap-3 w-full text-left py-3 px-3 rounded-lg text-base font-medium transition-colors hover:bg-white/5"
              style={{ color: '#F0F0F5' }}
            >
              <link.icon size={18} color="#6EC1E4" />
              {link.label}
            </button>
          ))}
          <div className="pt-4 mt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <button
              onClick={onRariOpen}
              className="flex items-center gap-3 w-full text-left py-3 px-3 rounded-lg"
              style={{ color: '#6EC1E4' }}
            >
              <Mic size={18} /> Ask Rari AI
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}

/* ============================================================
   FOOTER
   ============================================================ */
function MarketplaceFooter({ navigate }: { navigate: (page: PageType) => void }) {
  return (
    <footer
      className="py-16"
      style={{
        backgroundColor: '#111118',
        borderTop: '1px solid rgba(110, 193, 228, 0.06)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <button onClick={() => navigate('home')} className="flex items-center gap-2 mb-4">
              <Logo size={24} />
            </button>
            <p className="text-xs leading-relaxed mb-4" style={{ color: '#555570' }}>
              The marketplace for extraordinary driving experiences. Curated fleets, AI-powered pricing, white-glove service.
            </p>
            <div className="flex gap-3">
              {[Instagram, Twitter].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-[rgba(110,193,228,0.1)]"
                  style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
                >
                  <Icon size={14} color="#8888A0" />
                </a>
              ))}
            </div>
          </div>

          {/* Marketplace */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.1em] mb-4" style={{ color: '#8888A0' }}>
              Marketplace
            </h4>
            <div className="space-y-2.5">
              {[
                { label: 'Browse Vehicles', page: 'search' as PageType },
                { label: 'How It Works', page: 'home' as PageType },
                { label: 'List Your Fleet', page: 'operator' as PageType },
                { label: 'Become a Host', page: 'operator' as PageType },
              ].map(link => (
                <button
                  key={link.label}
                  onClick={() => navigate(link.page)}
                  className="block text-sm transition-colors hover:text-[#6EC1E4]"
                  style={{ color: '#555570' }}
                >
                  {link.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cities */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.1em] mb-4" style={{ color: '#8888A0' }}>
              Top Cities
            </h4>
            <div className="space-y-2.5">
              {['Scottsdale', 'Miami', 'Las Vegas', 'Los Angeles', 'Denver', 'New York'].map(city => (
                <button
                  key={city}
                  onClick={() => navigate('search')}
                  className="block text-sm transition-colors hover:text-[#6EC1E4]"
                  style={{ color: '#555570' }}
                >
                  {city}
                </button>
              ))}
            </div>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.1em] mb-4" style={{ color: '#8888A0' }}>
              Support
            </h4>
            <div className="space-y-2.5">
              {['Help Center', 'Safety', 'Cancellation Policy', 'Insurance', 'Contact Us'].map(label => (
                <button
                  key={label}
                  className="block text-sm transition-colors hover:text-[#6EC1E4]"
                  style={{ color: '#555570' }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Newsletter signup */}
        <div
          className="mb-12 rounded-xl p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-4"
          style={{
            backgroundColor: 'rgba(110, 193, 228, 0.04)',
            border: '1px solid rgba(110, 193, 228, 0.08)',
          }}
        >
          <div className="flex-1 text-center sm:text-left">
            <p className="font-semibold text-sm mb-1" style={{ color: '#F0F0F5' }}>
              Get exclusive deals & early access
            </p>
            <p className="text-xs" style={{ color: '#8888A0' }}>
              Join 10,000+ enthusiasts. No spam, ever.
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <input
              type="email"
              placeholder="your@email.com"
              className="flex-1 sm:w-56 px-4 py-2.5 rounded-lg text-sm outline-none transition-all focus:border-[#6EC1E4]"
              style={{
                backgroundColor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#F0F0F5',
              }}
            />
            <button
              className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-all hover:bg-[#8AD0EA] flex-shrink-0"
              style={{ backgroundColor: '#6EC1E4', color: '#0B0B0F' }}
            >
              Subscribe
            </button>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
        >
          <p className="text-xs" style={{ color: '#555570' }}>
            © 2025 Drive Exotiq. All rights reserved.
          </p>
          <div className="flex items-center gap-1 text-xs" style={{ color: '#555570' }}>
            <span>Powered by</span>
            <span style={{ color: '#6EC1E4' }}>Exotiq AI</span>
          </div>
          <div className="flex gap-4 text-xs" style={{ color: '#555570' }}>
            <button className="hover:text-[#6EC1E4] transition-colors">Terms</button>
            <button className="hover:text-[#6EC1E4] transition-colors">Privacy</button>
            <button className="hover:text-[#6EC1E4] transition-colors">Cookies</button>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ============================================================
   COMING SOON OVERLAY
   ============================================================ */
function ComingSoonOverlay({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      role="dialog"
      aria-label="Coming soon notice"
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onDismiss}
    >
      <div
        className="relative w-full max-w-md rounded-2xl p-8 text-center"
        style={{
          backgroundColor: '#16161E',
          border: '1px solid rgba(110, 193, 228, 0.15)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onDismiss}
          aria-label="Dismiss coming soon notice"
          className="absolute top-4 right-4 p-1.5 rounded-lg transition-colors hover:bg-white/10"
        >
          <X size={18} color="#8888A0" />
        </button>

        <div className="mb-6">
          <img
            src="/images/logos/drive-exotiq-lockup-transparent.png"
            alt="Drive Exotiq"
            className="h-8 mx-auto mb-5"
          />
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
            style={{
              backgroundColor: 'rgba(110, 193, 228, 0.08)',
              border: '1px solid rgba(110, 193, 228, 0.2)',
              color: '#6EC1E4',
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: '#6EC1E4' }}
            />
            Coming Soon
          </div>
        </div>

        <h2
          className="text-xl font-bold mb-3"
          style={{ fontFamily: '"Dfaalt", sans-serif', color: '#F0F0F5' }}
        >
          Not Yet Available for Bookings
        </h2>
        <p className="text-sm leading-relaxed mb-6" style={{ color: '#8888A0' }}>
          We&apos;re putting the finishing touches on the marketplace.
          Email us for early access or more information.
        </p>

        <a
          href="mailto:hello@exotiq.ai"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-300 hover:bg-[#8AD0EA]"
          style={{ backgroundColor: '#6EC1E4', color: '#0B0B0F' }}
        >
          <Mail size={16} />
          hello@exotiq.ai
        </a>

        <p className="text-xs mt-6" style={{ color: '#555570' }}>
          Click anywhere or press the X to browse the marketplace preview.
        </p>
      </div>
    </div>
  );
}

/* ============================================================
   MAIN MARKETPLACE APP
   ============================================================ */
export default function MarketplaceApp() {
  const [currentPage, setCurrentPage] = useState<PageType>('home');
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [searchCity, setSearchCity] = useState('');
  const [rariOpen, setRariOpen] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(true);

  const navigate = useCallback((page: PageType, vehicleId?: number) => {
    if (vehicleId !== undefined) {
      const v = vehicles.find(v => v.id === vehicleId);
      if (v) setSelectedVehicle(v);
    }
    setCurrentPage(page);
    // Hash routing for browser back button
    const hash = vehicleId ? `${page}/${vehicleId}` : page === 'home' ? '' : page;
    window.history.pushState(null, '', hash ? `#${hash}` : '#');
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (!hash || hash === '') { setCurrentPage('home'); return; }
      const parts = hash.split('/');
      const page = parts[0] as PageType;
      const validPages: PageType[] = ['home', 'search', 'vehicle', 'booking', 'trips', 'favorites', 'messages', 'operator'];
      if (validPages.includes(page)) {
        setCurrentPage(page);
        if (parts[1]) {
          const v = vehicles.find(v => v.id === parseInt(parts[1]));
          if (v) setSelectedVehicle(v);
        }
      }
    };
    window.addEventListener('popstate', handleHash);
    // Handle initial hash on load
    if (window.location.hash) handleHash();
    return () => window.removeEventListener('popstate', handleHash);
  }, []);

  // Dynamic page titles
  useEffect(() => {
    const titles: Record<PageType, string> = {
      home: 'Drive Exotiq | The Marketplace for Extraordinary Driving Experiences',
      search: 'Browse Exotic Vehicles | Drive Exotiq',
      vehicle: selectedVehicle ? `${selectedVehicle.name} | Drive Exotiq` : 'Vehicle Details | Drive Exotiq',
      booking: selectedVehicle ? `Book ${selectedVehicle.name} | Drive Exotiq` : 'Booking | Drive Exotiq',
      trips: 'My Trips | Drive Exotiq',
      favorites: 'Favorites | Drive Exotiq',
      messages: 'Messages | Drive Exotiq',
      operator: 'Operator Dashboard | Drive Exotiq',
    };
    document.title = titles[currentPage] || titles.home;
  }, [currentPage, selectedVehicle]);

  const toggleFavorite = useCallback((id: number) => {
    setFavorites(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  }, []);

  const renderPage = () => {
    const commonProps = { navigate, favorites, toggleFavorite };

    switch (currentPage) {
      case 'home':
        return <HomePage {...commonProps} setSearchCity={setSearchCity} />;
      case 'search':
        return (
          <SearchPage
            {...commonProps}
            searchCity={searchCity}
            setSearchCity={setSearchCity}
          />
        );
      case 'vehicle':
        return selectedVehicle ? (
          <VehicleDetailPage {...commonProps} vehicle={selectedVehicle} />
        ) : null;
      case 'booking':
        return selectedVehicle ? (
          <BookingPage vehicle={selectedVehicle} navigate={navigate} />
        ) : null;
      case 'trips':
        return <TripsPage navigate={navigate} />;
      case 'favorites':
        return <FavoritesPage {...commonProps} />;
      case 'messages':
        return <MessagesPage navigate={navigate} />;
      case 'operator':
        return <OperatorDashboard navigate={navigate} />;
      default:
        return <HomePage {...commonProps} setSearchCity={setSearchCity} />;
    }
  };

  return (
    <>
      <div
        className="min-h-screen"
        style={{
          backgroundColor: '#0B0B0F',
          color: '#F0F0F5',
          fontFamily: '"Montserrat", sans-serif',
        }}
      >
        <Navbar
          navigate={navigate}
          currentPage={currentPage}
          onRariOpen={() => setRariOpen(true)}
          favCount={favorites.length}
        />
        <main key={currentPage} className="animate-page-in">{renderPage()}</main>
        {currentPage !== 'booking' && <MarketplaceFooter navigate={navigate} />}
        <RariWidget
          isOpen={rariOpen}
          onToggle={() => setRariOpen(!rariOpen)}
          navigate={navigate}
        />
      </div>
      {showComingSoon && <ComingSoonOverlay onDismiss={() => setShowComingSoon(false)} />}
    </>
  );
}
