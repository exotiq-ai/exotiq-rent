'use client';

import {
  Star, MapPin, Calendar, MessageCircle, Heart, ChevronRight,
  Plus, Clock, Check, ArrowRight, Send, Car, User,
} from 'lucide-react';
import { vehicles, Vehicle, PageType } from './data';
import { VehicleCard } from './shared';
import { useState } from 'react';

/* ============================================================
   TRIPS PAGE
   ============================================================ */
export function TripsPage({ navigate }: { navigate: (page: PageType, vehicleId?: number) => void }) {
  const [tab, setTab] = useState<'upcoming' | 'history'>('upcoming');

  const upcomingTrips = [
    {
      vehicle: vehicles[0],
      status: 'Confirmed',
      dates: 'Oct 11 – Oct 14, 2025',
      pickup: 'Doorstep Delivery',
    },
  ];

  const pastTrips = [
    {
      vehicle: vehicles[3],
      status: 'Completed',
      dates: 'Sep 1 – Sep 4, 2025',
      pickup: 'Airport Pickup',
    },
    {
      vehicle: vehicles[5],
      status: 'Completed',
      dates: 'Aug 15 – Aug 17, 2025',
      pickup: 'Hotel Delivery',
    },
  ];

  const trips = tab === 'upcoming' ? upcomingTrips : pastTrips;

  return (
    <div style={{ backgroundColor: '#0B0B0F', minHeight: '100vh', paddingTop: '100px' }}>
      <div className="max-w-3xl mx-auto px-4">
        <h1
          className="text-2xl sm:text-3xl font-bold mb-8"
          style={{ fontFamily: '"Dfaalt", sans-serif', color: '#F0F0F5' }}
        >
          My Trips
        </h1>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 p-1 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
          {(['upcoming', 'history'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium capitalize transition-all duration-200"
              style={{
                backgroundColor: tab === t ? 'rgba(110,193,228,0.12)' : 'transparent',
                color: tab === t ? '#6EC1E4' : '#8888A0',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Trip cards */}
        <div className="space-y-4">
          {trips.map((trip, i) => (
            <div
              key={i}
              className="rounded-xl p-5 flex flex-col sm:flex-row gap-5 transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
              style={{ backgroundColor: '#161622', border: '1px solid rgba(110,193,228,0.08)' }}
              onClick={() => navigate('vehicle', trip.vehicle.id)}
            >
              <img
                src={trip.vehicle.image}
                alt={trip.vehicle.name}
                className="w-full sm:w-40 h-28 rounded-lg object-cover"
              />
              <div className="flex-1">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold" style={{ color: '#F0F0F5' }}>{trip.vehicle.name}</p>
                    <p className="text-xs" style={{ color: '#8888A0' }}>{trip.vehicle.fleet}</p>
                  </div>
                  <span
                    className="text-[10px] font-medium px-2.5 py-1 rounded-full"
                    style={{
                      backgroundColor: trip.status === 'Confirmed' ? 'rgba(110,193,228,0.12)' : 'rgba(255,255,255,0.05)',
                      color: trip.status === 'Confirmed' ? '#6EC1E4' : '#8888A0',
                    }}
                  >
                    {trip.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs" style={{ color: '#8888A0' }}>
                  <span className="flex items-center gap-1"><Calendar size={12} /> {trip.dates}</span>
                  <span className="flex items-center gap-1"><MapPin size={12} /> {trip.pickup}</span>
                </div>
                <div className="flex gap-3 mt-4">
                  <button
                    className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all hover:bg-[rgba(110,193,228,0.1)]"
                    style={{ color: '#6EC1E4', border: '1px solid rgba(110,193,228,0.2)' }}
                  >
                    {tab === 'upcoming' ? 'View Details' : 'Book Again'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {trips.length === 0 && (
          <div className="text-center py-16">
            <Car size={40} color="#555570" className="mx-auto mb-4" />
            <p style={{ color: '#8888A0' }}>No {tab} trips</p>
            <button
              onClick={() => navigate('search')}
              className="mt-4 px-4 py-2 rounded-lg text-sm"
              style={{ color: '#6EC1E4', border: '1px solid rgba(110,193,228,0.3)' }}
            >
              Browse Vehicles
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   FAVORITES PAGE
   ============================================================ */
export function FavoritesPage({
  navigate,
  favorites,
  toggleFavorite,
}: {
  navigate: (page: PageType, vehicleId?: number) => void;
  favorites: number[];
  toggleFavorite: (id: number) => void;
}) {
  const favVehicles = vehicles.filter(v => favorites.includes(v.id));

  return (
    <div style={{ backgroundColor: '#0B0B0F', minHeight: '100vh', paddingTop: '100px' }}>
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <h1
            className="text-2xl sm:text-3xl font-bold"
            style={{ fontFamily: '"Dfaalt", sans-serif', color: '#F0F0F5' }}
          >
            Favorites
          </h1>
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:bg-[rgba(110,193,228,0.1)]"
            style={{ border: '1px solid rgba(110,193,228,0.2)', color: '#6EC1E4' }}
          >
            <Plus size={14} /> Create List
          </button>
        </div>

        {favVehicles.length > 0 ? (
          <>
            <p className="text-sm mb-6" style={{ color: '#8888A0' }}>
              {favVehicles.length} saved vehicle{favVehicles.length !== 1 ? 's' : ''}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {favVehicles.map(v => (
                <VehicleCard
                  key={v.id}
                  vehicle={v}
                  navigate={navigate}
                  favorites={favorites}
                  toggleFavorite={toggleFavorite}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-16">
            <Heart size={40} color="#555570" className="mx-auto mb-4" />
            <p className="text-lg mb-2" style={{ color: '#F0F0F5' }}>No favorites yet</p>
            <p className="text-sm mb-6" style={{ color: '#8888A0' }}>
              Tap the heart icon on any vehicle to save it here
            </p>
            <button
              onClick={() => navigate('search')}
              className="px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
              style={{ backgroundColor: '#6EC1E4', color: '#0B0B0F' }}
            >
              Browse Vehicles
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   MESSAGES PAGE
   ============================================================ */
export function MessagesPage({ navigate }: { navigate: (page: PageType) => void }) {
  const [activeThread, setActiveThread] = useState(0);
  const [newMessage, setNewMessage] = useState('');

  const threads = [
    {
      host: 'Desert Exotic Rentals',
      vehicle: '2024 McLaren 750S Spider',
      lastMessage: 'Your vehicle will be ready for pickup at 10 AM. See you then!',
      time: '2h ago',
      unread: true,
      messages: [
        { role: 'host' as const, text: 'Welcome! Looking forward to hosting your trip.', time: 'Oct 9, 2:00 PM' },
        { role: 'user' as const, text: 'Thanks! Can you deliver to the Scottsdale Resort?', time: 'Oct 9, 2:15 PM' },
        { role: 'host' as const, text: 'Absolutely! We offer complimentary delivery to all Scottsdale hotels.', time: 'Oct 9, 2:20 PM' },
        { role: 'user' as const, text: 'Perfect. I\'ll be there on the 11th around 10 AM.', time: 'Oct 10, 9:00 AM' },
        { role: 'host' as const, text: 'Your vehicle will be ready for pickup at 10 AM. See you then!', time: 'Oct 10, 9:30 AM' },
      ],
    },
    {
      host: 'South Beach Exotics',
      vehicle: '2024 Ferrari 296 GTB',
      lastMessage: 'Do you need any specific delivery instructions?',
      time: '1d ago',
      unread: false,
      messages: [
        { role: 'host' as const, text: 'Hi! Thanks for booking the Ferrari 296 GTB.', time: 'Sep 28, 10:00 AM' },
        { role: 'host' as const, text: 'Do you need any specific delivery instructions?', time: 'Sep 28, 10:05 AM' },
      ],
    },
  ];

  const active = threads[activeThread];

  return (
    <div style={{ backgroundColor: '#0B0B0F', minHeight: '100vh', paddingTop: '80px' }}>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1
          className="text-2xl sm:text-3xl font-bold mb-8"
          style={{ fontFamily: '"Dfaalt", sans-serif', color: '#F0F0F5' }}
        >
          Messages
        </h1>

        <div
          className="rounded-xl overflow-hidden flex"
          style={{ backgroundColor: '#161622', border: '1px solid rgba(110,193,228,0.08)', height: '500px' }}
        >
          {/* Thread list */}
          <div
            className="w-full sm:w-80 flex-shrink-0 overflow-y-auto"
            style={{ borderRight: '1px solid rgba(110,193,228,0.06)' }}
          >
            {threads.map((thread, i) => (
              <button
                key={i}
                onClick={() => setActiveThread(i)}
                className="w-full text-left p-4 transition-colors hover:bg-[rgba(255,255,255,0.02)]"
                style={{
                  backgroundColor: activeThread === i ? 'rgba(110,193,228,0.04)' : 'transparent',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                    style={{ backgroundColor: 'rgba(110,193,228,0.12)', color: '#6EC1E4' }}
                  >
                    {thread.host.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium truncate" style={{ color: '#F0F0F5' }}>{thread.host}</p>
                      <span className="text-[10px] ml-2 flex-shrink-0" style={{ color: '#555570' }}>{thread.time}</span>
                    </div>
                    <p className="text-xs truncate" style={{ color: '#6EC1E4' }}>{thread.vehicle}</p>
                    <p className="text-xs truncate mt-0.5" style={{ color: '#8888A0' }}>{thread.lastMessage}</p>
                  </div>
                  {thread.unread && (
                    <div className="w-2 h-2 rounded-full flex-shrink-0 mt-2" style={{ backgroundColor: '#6EC1E4' }} />
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Active conversation */}
          <div className="hidden sm:flex flex-col flex-1">
            {/* Chat header */}
            <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(110,193,228,0.06)' }}>
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ backgroundColor: 'rgba(110,193,228,0.12)', color: '#6EC1E4' }}
              >
                {active.host.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: '#F0F0F5' }}>{active.host}</p>
                <p className="text-xs" style={{ color: '#8888A0' }}>{active.vehicle}</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {active.messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div>
                    <div
                      className="max-w-sm rounded-2xl px-4 py-3 text-sm"
                      style={
                        msg.role === 'user'
                          ? { backgroundColor: '#6EC1E4', color: '#0B0B0F' }
                          : { backgroundColor: 'rgba(255,255,255,0.05)', color: '#F0F0F5' }
                      }
                    >
                      {msg.text}
                    </div>
                    <p className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-right' : 'text-left'}`} style={{ color: '#555570' }}>
                      {msg.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Input */}
            <div className="px-5 py-4" style={{ borderTop: '1px solid rgba(110,193,228,0.06)' }}>
              <div className="flex items-center gap-3">
                <input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-transparent text-sm outline-none"
                  style={{ color: '#F0F0F5' }}
                />
                <button
                  className="p-2 rounded-full transition-all hover:bg-[rgba(110,193,228,0.1)]"
                >
                  <Send size={18} color="#6EC1E4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
