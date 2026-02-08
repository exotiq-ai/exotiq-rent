'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Search, MapPin, Calendar, ChevronRight, ChevronLeft, Shield,
  Clock, Phone, Mic, ArrowRight, Star, Navigation, Wifi, Zap,
  Volume2, Car, Check, Play, TrendingUp, DollarSign, Users, BarChart3,
  Smartphone, Download,
} from 'lucide-react';
import { vehicles, cities, reviews, Vehicle, PageType } from './data';
import { Logo, VehicleCard, SectionEyebrow, SectionHeading } from './shared';

/* ============================================================
   SCROLL ANIMATION WRAPPER
   ============================================================ */
function AnimateOnScroll({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}
    >
      {children}
    </div>
  );
}

interface HomePageProps {
  navigate: (page: PageType, vehicleId?: number) => void;
  favorites: number[];
  toggleFavorite: (id: number) => void;
  setSearchCity: (city: string) => void;
}

/* ============================================================
   HERO SECTION
   ============================================================ */
function HeroSection({ navigate, setSearchCity }: { navigate: (page: PageType) => void; setSearchCity: (city: string) => void }) {
  const [location, setLocation] = useState('');

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background image with Ken Burns */}
      <div className="absolute inset-0 overflow-hidden">
        <img
          src="/images/vehicles/hero-exotic-car.png"
          alt="Exotic car"
          className="w-full h-full object-cover animate-ken-burns"
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(180deg, rgba(11,11,15,0.65) 0%, rgba(11,11,15,0.4) 35%, rgba(11,11,15,0.88) 100%)',
          }}
        />
        {/* Clean dark overlay - no grain */}
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 text-center pt-20">
        {/* Eyebrow */}
        <p
          className="text-xs font-medium uppercase mb-6 tracking-[0.2em]"
          style={{ color: '#6EC1E4' }}
        >
          THE DEFINITIVE EXOTIC CAR EXPERIENCE
        </p>

        {/* Headline */}
        <h1
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-[1.1]"
          style={{ fontFamily: '"Dfaalt", sans-serif', color: '#F0F0F5' }}
        >
          Drive Something{' '}
          <br className="hidden sm:block" />
          <span style={{ color: '#6EC1E4' }}>Extraordinary</span>
        </h1>

        {/* Subheadline */}
        <p
          className="text-base sm:text-lg lg:text-xl mb-10 max-w-2xl mx-auto leading-relaxed"
          style={{ color: '#8888A0' }}
        >
          Access curated exotic fleets in 25+ cities. AI-powered pricing.
          White-glove service.
        </p>

        {/* Search Module */}
        <div
          className="max-w-3xl mx-auto rounded-2xl p-1.5 mb-8"
          style={{
            background: 'rgba(17, 17, 24, 0.7)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(110, 193, 228, 0.15)',
          }}
        >
          <div className="flex flex-col sm:flex-row items-stretch">
            {/* Location */}
            <div className="flex-1 flex items-center gap-3 px-5 py-4 border-b sm:border-b-0 sm:border-r" style={{ borderColor: 'rgba(110,193,228,0.1)' }}>
              <MapPin size={18} color="#6EC1E4" />
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Where are you going?"
                className="bg-transparent w-full text-sm outline-none"
                style={{ color: '#F0F0F5' }}
              />
            </div>
            {/* Pickup Date */}
            <div className="flex-1 flex items-center gap-3 px-5 py-4 border-b sm:border-b-0 sm:border-r" style={{ borderColor: 'rgba(110,193,228,0.1)' }}>
              <Calendar size={18} color="#6EC1E4" className="flex-shrink-0" />
              <input type="date" className="bg-transparent text-sm outline-none w-full" style={{ color: '#F0F0F5', colorScheme: 'dark' }} placeholder="Pickup Date" />
            </div>
            {/* Return Date */}
            <div className="flex-1 flex items-center gap-3 px-5 py-4 border-b sm:border-b-0 sm:border-r" style={{ borderColor: 'rgba(110,193,228,0.1)' }}>
              <Calendar size={18} color="#6EC1E4" className="flex-shrink-0" />
              <input type="date" className="bg-transparent text-sm outline-none w-full" style={{ color: '#F0F0F5', colorScheme: 'dark' }} placeholder="Return Date" />
            </div>
            {/* Search Button */}
            <button
              onClick={() => {
                if (location) setSearchCity(location);
                navigate('search');
              }}
              className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold text-sm transition-all duration-300 hover:opacity-90 sm:rounded-l-none"
              style={{ backgroundColor: '#6EC1E4', color: '#0B0B0F' }}
            >
              <Search size={16} />
              <span className="hidden sm:inline">Search</span>
            </button>
          </div>
        </div>

        {/* Popular Links */}
        <div className="flex items-center justify-center gap-2 flex-wrap text-sm" style={{ color: '#555570' }}>
          <span>Popular:</span>
          {['Scottsdale', 'Miami', 'Las Vegas', 'Los Angeles'].map((city) => (
            <button
              key={city}
              onClick={() => {
                setSearchCity(city);
                navigate('search');
              }}
              className="transition-colors duration-200 hover:text-[#6EC1E4]"
              style={{ color: '#8888A0' }}
            >
              {city}
            </button>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3">
        <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: '#555570' }}>Scroll to explore</span>
        <div className="w-5 h-9 rounded-full border border-[#555570]/50 flex justify-center pt-2 animate-bounce">
          <div className="w-0.5 h-2.5 rounded-full bg-[#6EC1E4] animate-pulse" />
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   TRUST BAR
   ============================================================ */
function TrustBar() {
  const stats = [
    { value: '500+', label: 'Exotic Vehicles', icon: Car },
    { value: '25+', label: 'Cities', icon: MapPin },
    { value: '4.9★', label: 'Average Rating', icon: Star },
    { value: 'AI', label: 'Powered Pricing', icon: Zap },
  ];

  return (
    <section
      className="relative py-8"
      style={{
        backgroundColor: '#111118',
        borderTop: '1px solid rgba(110, 193, 228, 0.08)',
      }}
    >
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
            <div key={i} className="flex items-center justify-center gap-3 py-2">
              <stat.icon size={20} color="#6EC1E4" />
              <div>
                <span className="font-bold text-lg font-mont" style={{ color: '#6EC1E4' }}>
                  {stat.value}
                </span>{' '}
                <span className="text-sm" style={{ color: '#8888A0' }}>
                  {stat.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   FEATURED VEHICLES
   ============================================================ */
function FeaturedVehicles({
  navigate,
  favorites,
  toggleFavorite,
}: {
  navigate: (page: PageType, vehicleId?: number) => void;
  favorites: number[];
  toggleFavorite: (id: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const featured = vehicles.slice(0, 6);

  const scroll = (dir: 'left' | 'right') => {
    if (scrollRef.current) {
      const amount = dir === 'left' ? -380 : 380;
      scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  return (
    <section className="py-24 lg:py-32" style={{ backgroundColor: '#0B0B0F' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-12">
          <div>
            <SectionEyebrow>CURATED COLLECTION</SectionEyebrow>
            <SectionHeading>Featured This Week</SectionHeading>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={() => scroll('left')}
              className="p-2.5 rounded-full transition-all duration-200 hover:bg-[rgba(110,193,228,0.1)]"
              style={{ border: '1px solid rgba(110,193,228,0.2)' }}
            >
              <ChevronLeft size={18} color="#6EC1E4" />
            </button>
            <button
              onClick={() => scroll('right')}
              className="p-2.5 rounded-full transition-all duration-200 hover:bg-[rgba(110,193,228,0.1)]"
              style={{ border: '1px solid rgba(110,193,228,0.2)' }}
            >
              <ChevronRight size={18} color="#6EC1E4" />
            </button>
          </div>
        </div>

        {/* Scrollable row */}
        <div
          ref={scrollRef}
          className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none' }}
        >
          {featured.map((v) => (
            <div key={v.id} className="min-w-[320px] max-w-[360px] flex-shrink-0 snap-start">
              <VehicleCard
                vehicle={v}
                navigate={navigate}
                favorites={favorites}
                toggleFavorite={toggleFavorite}
              />
            </div>
          ))}
        </div>

        {/* View All */}
        <div className="flex justify-end mt-6">
          <button
            onClick={() => navigate('search')}
            className="flex items-center gap-2 text-sm font-medium transition-colors duration-200 hover:text-[#8AD0EA]"
            style={{ color: '#6EC1E4' }}
          >
            View All Vehicles <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   HOW IT WORKS
   ============================================================ */
function HowItWorks() {
  const steps = [
    {
      num: '01',
      icon: Search,
      title: 'Search & Discover',
      desc: 'Browse curated exotic vehicles across 25+ cities. Use AI-powered filters to find your perfect ride.',
    },
    {
      num: '02',
      icon: Check,
      title: 'Book Instantly',
      desc: 'Reserve in seconds with transparent pricing. No hidden fees. Free cancellation on most vehicles.',
    },
    {
      num: '03',
      icon: Car,
      title: 'Drive Away',
      desc: 'Pick up or get doorstep delivery. White-glove service from verified fleet operators every time.',
    },
  ];

  return (
    <section className="py-24 lg:py-32 relative" style={{ backgroundColor: '#111118' }}>
      {/* Grain overlay */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
        <SectionEyebrow>SEAMLESS EXPERIENCE</SectionEyebrow>
        <SectionHeading>How Drive Exotiq Works</SectionHeading>
        <p className="text-base max-w-2xl mx-auto mb-16" style={{ color: '#8888A0' }}>
          Three simple steps to an extraordinary driving experience
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
          {steps.map((step, i) => (
            <div key={i} className="text-center group">
              <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-full mb-6 transition-all duration-300 group-hover:scale-110"
                style={{
                  border: '1.5px solid rgba(110, 193, 228, 0.3)',
                  backgroundColor: 'rgba(110, 193, 228, 0.05)',
                }}
              >
                <step.icon size={24} color="#6EC1E4" />
                <span
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{ backgroundColor: '#6EC1E4', color: '#0B0B0F' }}
                >
                  {step.num}
                </span>
              </div>
              <h3 className="text-lg font-semibold mb-3 font-mont" style={{ color: '#F0F0F5' }}>
                {step.title}
              </h3>
              <p className="text-sm leading-relaxed max-w-xs mx-auto" style={{ color: '#8888A0' }}>
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   EXPLORE BY CITY
   ============================================================ */
function ExploreByCity({ navigate, setSearchCity }: { navigate: (page: PageType) => void; setSearchCity: (city: string) => void }) {
  return (
    <section className="py-24 lg:py-32" style={{ backgroundColor: '#0B0B0F' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <SectionEyebrow>DESTINATIONS</SectionEyebrow>
          <SectionHeading>Explore by City</SectionHeading>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {cities.map((city, i) => (
            <button
              key={city.name}
              onClick={() => {
                setSearchCity(city.name);
                navigate('search');
              }}
              className={`group relative overflow-hidden rounded-xl text-left transition-all duration-300 hover:-translate-y-1 ${
                i === 0 ? 'sm:col-span-2 lg:col-span-1' : ''
              }`}
              style={{
                border: '1px solid rgba(110, 193, 228, 0.08)',
                height: i < 3 ? '240px' : '200px',
              }}
            >
              {/* Background image */}
              <img
                src={city.image}
                alt={city.name}
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              {/* Dark gradient overlay */}
              <div
                className="absolute inset-0"
                style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.35) 100%)' }}
              />

              {/* Hover teal border */}
              <div
                className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ border: '1.5px solid rgba(110, 193, 228, 0.5)', boxShadow: 'inset 0 0 30px rgba(110,193,228,0.05)' }}
              />

              {/* Content */}
              <div className="relative z-10 h-full flex flex-col justify-end p-6">
                <h3 className="text-2xl font-bold mb-1 font-mont" style={{ color: '#F0F0F5' }}>
                  {city.name}
                </h3>
                <p className="text-sm flex items-center gap-1.5" style={{ color: 'rgba(240,240,245,0.7)' }}>
                  <Car size={14} />
                  {city.count} vehicles
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   FEATURED IN (PRESS / TRUST STRIP)
   ============================================================ */
function FeaturedIn() {
  const publications = ['DuPont Registry', 'Robb Report', 'Motor Trend', 'Forbes', 'Bloomberg'];
  return (
    <section className="py-12" style={{ backgroundColor: '#0B0B0F', borderTop: '1px solid rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
      <div className="max-w-5xl mx-auto px-4 text-center">
        <p className="text-[10px] uppercase tracking-[0.2em] mb-6" style={{ color: '#555570' }}>As Featured In</p>
        <div className="flex items-center justify-center gap-8 sm:gap-14 flex-wrap">
          {publications.map((pub) => (
            <span
              key={pub}
              className="text-sm sm:text-base font-medium tracking-wide transition-colors duration-300 hover:text-[#8888A0]"
              style={{ color: '#3A3A50', fontFamily: '"Dfaalt", sans-serif' }}
            >
              {pub}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   RARI AI SHOWCASE SECTION
   ============================================================ */
function RariShowcase() {
  return (
    <section className="py-24 lg:py-32 relative" style={{ backgroundColor: '#111118' }}>
      {/* Grain overlay */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 items-center">
          {/* Left: Chat mockup */}
          <div className="lg:col-span-3">
            <div
              className="rounded-2xl p-6 max-w-lg mx-auto lg:mx-0"
              style={{
                backgroundColor: 'rgba(22, 22, 34, 0.8)',
                border: '1px solid rgba(110, 193, 228, 0.15)',
                boxShadow: '0 0 60px rgba(110, 193, 228, 0.06)',
              }}
            >
              {/* Chat header */}
              <div className="flex items-center gap-3 mb-6 pb-4" style={{ borderBottom: '1px solid rgba(110,193,228,0.1)' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(110,193,228,0.15)' }}>
                  <Mic size={18} color="#6EC1E4" />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#F0F0F5' }}>Rari AI</p>
                  <p className="text-[11px]" style={{ color: '#6EC1E4' }}>AI Concierge · Always Available</p>
                </div>
              </div>

              {/* Messages */}
              <div className="space-y-4 mb-6">
                <div className="flex justify-end">
                  <div className="rounded-2xl rounded-tr-sm px-4 py-3 max-w-[80%] text-sm" style={{ backgroundColor: '#6EC1E4', color: '#0B0B0F' }}>
                    I need a supercar for Car Week, Jan 18-22
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] text-sm leading-relaxed" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: '#F0F0F5' }}>
                    I found 12 supercars for Car Week dates. The McLaren 750S is the most popular pick and just dropped to <span style={{ color: '#6EC1E4', fontWeight: 600 }}>$1,099/day</span> with AI pricing. Want me to hold it?
                  </div>
                </div>
              </div>

              {/* Input mockup */}
              <div
                className="flex items-center gap-3 rounded-xl px-4 py-3"
                style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(110,193,228,0.1)' }}
              >
                <Mic size={18} color="#6EC1E4" />
                <span className="text-sm flex-1" style={{ color: '#555570' }}>Ask Rari anything...</span>
                <Play size={16} color="#6EC1E4" />
              </div>
            </div>
          </div>

          {/* Right: Copy */}
          <div className="lg:col-span-2">
            <SectionEyebrow>AI CONCIERGE</SectionEyebrow>
            <h2
              className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6"
              style={{ fontFamily: '"Dfaalt", sans-serif', color: '#F0F0F5' }}
            >
              Meet <span style={{ color: '#6EC1E4' }}>Rari</span>
            </h2>
            <p className="text-base leading-relaxed mb-4" style={{ color: '#8888A0' }}>
              Your AI-powered concierge. Tell Rari what you want and get personalized recommendations instantly. Voice or text. Available 24/7.
            </p>
            <ul className="space-y-3 mb-8">
              {['AI-optimized pricing that saves you money', 'Voice-powered — just tell Rari what you need', 'Instant recommendations from 500+ vehicles'].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-sm" style={{ color: '#F0F0F5' }}>
                  <Check size={16} color="#6EC1E4" />
                  {item}
                </li>
              ))}
            </ul>
            <button
              className="flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm transition-all duration-300 hover:opacity-90"
              style={{ backgroundColor: '#6EC1E4', color: '#0B0B0F' }}
            >
              Try Rari <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   WHITE-GLOVE SERVICE
   ============================================================ */
function WhiteGloveService() {
  const features = [
    { icon: Navigation, title: 'Doorstep Delivery', desc: 'Vehicle delivered right to your door, hotel, or airport.' },
    { icon: Phone, title: '24/7 Roadside Support', desc: 'Round-the-clock assistance wherever your journey takes you.' },
    { icon: Star, title: 'Curated Experiences', desc: 'Custom routes, event access, and unforgettable driving moments.' },
    { icon: Shield, title: 'Personal Concierge', desc: 'Dedicated support from booking to return. White-glove, every step.' },
  ];

  return (
    <section className="py-24 lg:py-32" style={{ backgroundColor: '#0B0B0F' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <SectionEyebrow>ELEVATED SERVICE</SectionEyebrow>
          <SectionHeading>White-Glove, Every Step</SectionHeading>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {features.map((f, i) => (
            <div
              key={i}
              className="rounded-xl p-6 transition-all duration-300 hover:-translate-y-0.5 group"
              style={{
                backgroundColor: '#161622',
                border: '1px solid rgba(110, 193, 228, 0.08)',
              }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-all duration-300 group-hover:bg-[rgba(110,193,228,0.15)]"
                style={{ backgroundColor: 'rgba(110, 193, 228, 0.08)' }}
              >
                <f.icon size={22} color="#6EC1E4" />
              </div>
              <h3 className="text-lg font-semibold mb-2 font-mont" style={{ color: '#F0F0F5' }}>
                {f.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: '#8888A0' }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   SOCIAL PROOF (TESTIMONIALS)
   ============================================================ */
function SocialProof() {
  return (
    <section className="py-24 lg:py-32" style={{ backgroundColor: '#111118' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <SectionEyebrow>TESTIMONIALS</SectionEyebrow>
          <SectionHeading>What Drivers Say</SectionHeading>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {reviews.map((review, i) => (
            <div
              key={i}
              className="rounded-xl p-6 transition-all duration-300 hover:-translate-y-0.5"
              style={{
                backgroundColor: '#161622',
                border: '1px solid rgba(110, 193, 228, 0.08)',
              }}
            >
              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Star
                    key={j}
                    size={14}
                    fill={j < review.rating ? '#F5C842' : 'transparent'}
                    color={j < review.rating ? '#F5C842' : '#555570'}
                  />
                ))}
              </div>
              {/* Quote */}
              <p className="text-sm leading-relaxed mb-5" style={{ color: '#F0F0F5' }}>
                &ldquo;{review.text}&rdquo;
              </p>
              {/* Author */}
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ backgroundColor: 'rgba(110, 193, 228, 0.15)', color: '#6EC1E4' }}
                >
                  {review.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: '#F0F0F5' }}>{review.name}</p>
                  <p className="text-xs" style={{ color: '#555570' }}>
                    {review.vehicle} · {review.date}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   IPHONE FRAME - Realistic device mockup for screenshots
   ============================================================ */
function IPhoneFrame({ src, alt, label, description }: { src: string; alt: string; label: string; description: string }) {
  return (
    <div className="flex flex-col items-center">
      {/* Device frame */}
      <div className="relative" style={{ width: '260px' }}>
        {/* Outer bezel */}
        <div
          className="rounded-[3rem] p-[3px] relative"
          style={{
            background: 'linear-gradient(145deg, rgba(110,193,228,0.25), rgba(60,60,80,0.4), rgba(110,193,228,0.15))',
          }}
        >
          {/* Inner bezel */}
          <div
            className="rounded-[2.85rem] overflow-hidden relative"
            style={{ backgroundColor: '#0B0B0F' }}
          >
            {/* Dynamic Island notch */}
            <div className="absolute top-[10px] left-1/2 -translate-x-1/2 z-20 w-[90px] h-[28px] rounded-full" style={{ backgroundColor: '#0B0B0F' }} />

            {/* Screenshot */}
            <img
              src={src}
              alt={alt}
              loading="lazy"
              className="w-full h-auto block"
              style={{ aspectRatio: '9/19.5' }}
            />
          </div>
        </div>

        {/* Subtle reflection */}
        <div
          className="absolute inset-0 rounded-[3rem] pointer-events-none"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 40%, transparent 60%, rgba(255,255,255,0.02) 100%)',
          }}
        />
      </div>

      {/* Label beneath phone */}
      <div className="text-center mt-5">
        <h3 className="text-sm font-semibold mb-1 font-mont" style={{ color: '#F0F0F5' }}>{label}</h3>
        <p className="text-xs leading-relaxed max-w-[220px] mx-auto" style={{ color: '#8888A0' }}>{description}</p>
      </div>
    </div>
  );
}

/* ============================================================
   MOBILE APP CTA
   ============================================================ */
function MobileAppCTA() {
  const appScreens = [
    {
      src: '/images/app/app-signup.png',
      alt: 'Drive Exotiq App - Sign Up',
      label: 'Premium Onboarding',
      description: 'Sign up in seconds and unlock the world of exotic car access.',
    },
    {
      src: '/images/app/app-browse.png',
      alt: 'Drive Exotiq App - Browse',
      label: 'Smart Discovery',
      description: 'Browse by make, location, or let AI find your perfect ride.',
    },
    {
      src: '/images/app/app-map.png',
      alt: 'Drive Exotiq App - Map Search',
      label: 'Map-Based Search',
      description: 'Discover nearby exotics with real-time pricing on the map.',
    },
  ];

  return (
    <section className="py-24 lg:py-32 relative overflow-hidden" style={{ backgroundColor: '#0B0B0F' }}>
      {/* Ambient glow behind phones */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(110,193,228,0.06) 0%, transparent 70%)',
        }}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Section header */}
        <div className="text-center mb-16">
          <SectionEyebrow>THE APP</SectionEyebrow>
          <SectionHeading>
            The Exotic Car Experience,{' '}
            <span style={{ color: '#6EC1E4' }}>In Your Pocket</span>
          </SectionHeading>
          <p className="text-base max-w-2xl mx-auto" style={{ color: '#8888A0' }}>
            Browse, book, and manage your exotic car rentals from anywhere.
            Voice-powered AI concierge. Instant notifications. Digital key handoff.
          </p>
        </div>

        {/* Phone mockups — 3-up layout */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-6 lg:gap-10 max-w-4xl mx-auto mb-16 justify-items-center">
          {/* Side phones slightly smaller + pushed down on desktop for the staggered depth effect */}
          <div className="sm:mt-10 sm:scale-[0.92] transition-transform duration-300 hover:scale-[0.96] sm:hover:scale-[0.96]">
            <IPhoneFrame {...appScreens[0]} />
          </div>
          <div className="transition-transform duration-300 hover:scale-[1.03] sm:hover:scale-[1.03]">
            <IPhoneFrame {...appScreens[1]} />
          </div>
          <div className="sm:mt-10 sm:scale-[0.92] transition-transform duration-300 hover:scale-[0.96] sm:hover:scale-[0.96]">
            <IPhoneFrame {...appScreens[2]} />
          </div>
        </div>

        {/* App store buttons + Coming Soon */}
        <div className="flex flex-col items-center">
          <div className="flex flex-wrap gap-3 justify-center mb-4">
            <button className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90 opacity-60 cursor-default" style={{ backgroundColor: '#6EC1E4', color: '#0B0B0F' }}>
              <Download size={16} /> App Store
            </button>
            <button className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90 opacity-60 cursor-default" style={{ backgroundColor: '#F0F0F5', color: '#0B0B0F' }}>
              <Download size={16} /> Google Play
            </button>
          </div>
          {/* Coming Soon pill */}
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full"
            style={{
              backgroundColor: 'rgba(110, 193, 228, 0.08)',
              border: '1px solid rgba(110, 193, 228, 0.2)',
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: '#6EC1E4' }}
            />
            <span className="text-xs font-medium tracking-wide" style={{ color: '#6EC1E4' }}>
              Coming Soon — Q1 2026
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   INVESTOR / PLATFORM METRICS
   ============================================================ */
function InvestorMetrics() {
  const metrics = [
    { icon: Car, value: '500+', label: 'Exotic Vehicles', sub: 'Across 25+ markets' },
    { icon: DollarSign, value: '$3,800', label: 'Avg Booking', sub: '18-22% take rate' },
    { icon: TrendingUp, value: '34%', label: 'Repeat Rate', sub: 'Month over month' },
    { icon: BarChart3, value: '180%', label: 'YoY Growth', sub: 'Revenue trajectory' },
  ];

  return (
    <section className="py-20" style={{ backgroundColor: '#0B0B0F', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <SectionEyebrow>PLATFORM METRICS</SectionEyebrow>
          <SectionHeading>Built for Scale</SectionHeading>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {metrics.map((m, i) => (
            <div key={i} className="rounded-xl p-6 text-center" style={{ backgroundColor: '#161622', border: '1px solid rgba(110,193,228,0.06)' }}>
              <m.icon size={24} color="#6EC1E4" className="mx-auto mb-3" />
              <p className="text-2xl sm:text-3xl font-bold font-mont mb-1" style={{ color: '#6EC1E4' }}>{m.value}</p>
              <p className="text-sm font-semibold mb-1" style={{ color: '#F0F0F5' }}>{m.label}</p>
              <p className="text-[11px]" style={{ color: '#555570' }}>{m.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   HOME PAGE (COMBINES ALL SECTIONS)
   ============================================================ */
export default function HomePage({ navigate, favorites, toggleFavorite, setSearchCity }: HomePageProps) {
  return (
    <div>
      <HeroSection navigate={navigate} setSearchCity={setSearchCity} />
      <TrustBar />
      <AnimateOnScroll><FeaturedVehicles navigate={navigate} favorites={favorites} toggleFavorite={toggleFavorite} /></AnimateOnScroll>
      <AnimateOnScroll><HowItWorks /></AnimateOnScroll>
      <AnimateOnScroll><ExploreByCity navigate={navigate} setSearchCity={setSearchCity} /></AnimateOnScroll>
      <FeaturedIn />
      <AnimateOnScroll><RariShowcase /></AnimateOnScroll>
      <AnimateOnScroll><WhiteGloveService /></AnimateOnScroll>
      <AnimateOnScroll><MobileAppCTA /></AnimateOnScroll>
      <AnimateOnScroll><SocialProof /></AnimateOnScroll>
      <AnimateOnScroll><InvestorMetrics /></AnimateOnScroll>
    </div>
  );
}
