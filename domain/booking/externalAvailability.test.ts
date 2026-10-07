import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
const rpc=vi.hoisted(()=>({mode:'supabase',team:vi.fn(),vehicle:vi.fn(),media:vi.fn(),availability:vi.fn(),create:vi.fn(),confirmation:vi.fn()}));
vi.mock('./config',async(original)=>({...await original<typeof import('./config')>(),getDataMode:()=>rpc.mode}));
vi.mock('./rpcClient',async(original)=>({...await original<typeof import('./rpcClient')>(),fetchPublicTeam:rpc.team,fetchPublicVehicle:rpc.vehicle,fetchSignedVehicleMedia:rpc.media,fetchVehicleAvailability:rpc.availability,postCreateBooking:rpc.create,fetchBookingByRef:rpc.confirmation}));
import { createBookingCart,createRenterBooking,getBookingStartContext,getPublicVehicleContext } from './service';
import { createSupabaseRenterBooking,getSupabaseBookingConfirmation,getSupabaseVehicleContext } from './supabaseService';
import { getMockPublicVehicleContext } from './mockService';
import { AVAILABILITY_MAX_AGE_MS } from './types';

const now=new Date('2030-01-01T12:00:00Z');
const team={slug:'agent-test-team',name:'Synthetic operator',logo_url:null,city:'Miami',state:'FL',timezone:'America/New_York'};
const vehicle={team_slug:team.slug,team_name:team.name,vehicle_slug:'agent-test-car',name:'Synthetic car',make:'Synthetic',model:'Car',year:2030,color:null,daily_rate:'100.25',hero_image_url:'https://example.invalid/car.jpg',min_rental_days:2,rate_3hr:null,rate_6hr:null,rate_multiday:null,default_mileage_limit:100,mileage_overage_rate:2,photos:null,pickup_city:'Miami',pickup_state:'FL',timezone:'America/New_York',currency:'usd'};
beforeEach(()=>{
  vi.resetAllMocks();vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(now);rpc.mode='supabase';
  rpc.team.mockResolvedValue(team);rpc.vehicle.mockResolvedValue(vehicle);rpc.media.mockResolvedValue({photos:[],expiresIn:0});rpc.availability.mockResolvedValue([]);
  rpc.create.mockResolvedValue({booking_ref:'agent-test-ref',confirmation_token:'synthetic',status:'requested',identity_verified:false});
  vi.stubGlobal('fetch',vi.fn(()=>{throw new Error('Offline tests forbid network');}));
});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});

describe('Supabase availability context and shared facade',()=>{
  it('marks a validated empty response KNOWN on context/vehicle/cart without losing media or prices',async()=>{
    const context=await getBookingStartContext(team.slug,vehicle.vehicle_slug);
    expect(context?.availabilityAuthority.status).toBe('KNOWN');
    expect(context?.availabilityAuthority).toBe(context?.vehicle.availabilityAuthority);
    const cart=createBookingCart({operator:context!.team,vehicle:context!.vehicle});
    expect(cart.vehicle.availabilityAuthority).toBe(context!.availabilityAuthority);expect(cart.vehicle.unavailableRanges).toEqual([]);
    expect(cart.vehicle.dailyRateCents).toBe(10025);expect(cart.vehicle.heroImage).toBe(vehicle.hero_image_url);
    await expect(createRenterBooking(cart)).resolves.toMatchObject({status:'requested'});expect(rpc.create).toHaveBeenCalledOnce();
  });
  it('preserves UNKNOWN on failed availability, zero booking calls even through direct service',async()=>{
    rpc.availability.mockRejectedValue(new Error('Private upstream outage details'));
    const context=await getPublicVehicleContext(team.slug,vehicle.vehicle_slug);
    expect(context?.availabilityAuthority).toMatchObject({status:'UNKNOWN',reason:'upstream_unavailable'});
    expect(context?.vehicle.unavailableRanges).toBeUndefined();
    const cart=createBookingCart({operator:context!.team,vehicle:context!.vehicle});
    await expect(createRenterBooking(cart)).rejects.toMatchObject({code:'availability_unknown'});
    await expect(createSupabaseRenterBooking(cart)).rejects.toMatchObject({code:'availability_unknown'});
    expect(rpc.create).not.toHaveBeenCalled();expect(JSON.stringify(context)).not.toContain('Private upstream');
  });
  it.each([null,{},[{busy_start:'2030-02-30',busy_end:'2030-03-04'}],[{busy_start:'2030-01-03',busy_end:'2030-01-01'}],[{busy_start:'2030-01-01'}]])('fails safely on malformed response %j',async(data)=>{
    rpc.availability.mockResolvedValue(data);
    const context=await getSupabaseVehicleContext(team.slug,vehicle.vehicle_slug);
    expect(context?.availabilityAuthority).toMatchObject({status:'UNKNOWN',reason:'invalid_response'});
    expect(context?.vehicle.unavailableRanges).toBeUndefined();
  });
  it('keeps valid availability when signing media fails',async()=>{
    rpc.media.mockRejectedValue(new Error('media outage'));
    expect((await getSupabaseVehicleContext(team.slug,vehicle.vehicle_slug))?.availabilityAuthority.status).toBe('KNOWN');
  });
  it('returns UNKNOWN after the bounded availability timeout',async()=>{
    vi.useFakeTimers();vi.setSystemTime(now);rpc.availability.mockReturnValue(new Promise(()=>{}));
    const pending=getSupabaseVehicleContext(team.slug,vehicle.vehicle_slug);
    await vi.advanceTimersByTimeAsync(5001);
    expect((await pending)?.availabilityAuthority).toMatchObject({status:'UNKNOWN',reason:'upstream_unavailable'});
  });
  it('rejects missing, stale, outside-window or blocked authority before a booking POST',async()=>{
    const context=await getPublicVehicleContext(team.slug,vehicle.vehicle_slug);const cart=createBookingCart({operator:context!.team,vehicle:context!.vehicle});
    await expect(createRenterBooking({...cart,vehicle:{...cart.vehicle,availabilityAuthority:undefined}})).rejects.toMatchObject({code:'availability_unknown'});
    await expect(createRenterBooking({...cart,dates:{start:'2031-01-01',end:'2031-01-03'}})).rejects.toMatchObject({code:'availability_unknown'});
    await expect(createRenterBooking({...cart,vehicle:{...cart.vehicle,unavailableRanges:[{start:cart.dates.start,end:cart.dates.end}]}})).rejects.toMatchObject({code:'dates_unavailable'});
    vi.setSystemTime(now.getTime()+AVAILABILITY_MAX_AGE_MS+1);
    await expect(createRenterBooking(cart)).rejects.toMatchObject({code:'availability_unknown'});expect(rpc.create).not.toHaveBeenCalled();
  });
  it('permits an explicit newly checked window outside the default horizon and validates that window',async()=>{
    const context=await getBookingStartContext(team.slug,vehicle.vehicle_slug,{start:'2031-01-01',end:'2031-01-03'});
    expect(context?.availabilityAuthority).toMatchObject({status:'KNOWN',windowStart:'2031-01-01',windowEnd:'2031-01-03'});
    expect(rpc.availability).toHaveBeenCalledWith(team.slug,vehicle.vehicle_slug,'2031-01-01','2031-01-03');
    rpc.availability.mockClear();
    const invalid=await getPublicVehicleContext(team.slug,vehicle.vehicle_slug,{start:'2031-02-30',end:'2031-03-03'});
    expect(invalid?.availabilityAuthority.status).toBe('UNKNOWN');expect(rpc.availability).not.toHaveBeenCalled();
  });
  it('leaves confirmation fallback UNKNOWN and unable to create new requests',async()=>{
    rpc.confirmation.mockResolvedValue({booking_ref:'agent-test-ref',status:'confirmed',authorized:true,team_slug:team.slug,vehicle_slug:vehicle.vehicle_slug,team_name:team.name,vehicle_name:vehicle.name});
    rpc.team.mockRejectedValue(new Error('catalog hidden'));
    const confirmation=await getSupabaseBookingConfirmation('agent-test-ref','synthetic');
    if(!confirmation||'restricted' in confirmation)throw new Error('Expected token-authorized confirmation');
    expect(confirmation.vehicle.availabilityAuthority?.status).toBe('UNKNOWN');
    await expect(createRenterBooking(createBookingCart({operator:confirmation.team,vehicle:confirmation.vehicle}))).rejects.toMatchObject({code:'availability_unknown'});
    expect(rpc.create).not.toHaveBeenCalled();
  });
  it('assigns known fixtures only in explicit mock mode; never uses mocks to recover a live failure',async()=>{
    rpc.mode='mock';const context=await getMockPublicVehicleContext('desert-exotic-rentals','mclaren-750s-spider');
    expect(context?.availabilityAuthority.status).toBe('KNOWN');expect(context?.vehicle.availabilityAuthority).toBe(context?.availabilityAuthority);
    expect(createBookingCart({operator:context!.team,vehicle:context!.vehicle}).vehicle.availabilityAuthority).toBe(context?.availabilityAuthority);
    const cart=createBookingCart();expect(cart.vehicle.availabilityAuthority?.status).toBe('KNOWN');
    await expect(createRenterBooking(cart)).resolves.toMatchObject({bookingRef:'BK-01001'});expect(rpc.create).not.toHaveBeenCalled();
    rpc.mode='supabase';const live=createBookingCart();expect(live.vehicle.availabilityAuthority?.status).toBe('UNKNOWN');
    await expect(createRenterBooking(live)).rejects.toMatchObject({code:'availability_unknown'});expect(rpc.create).not.toHaveBeenCalled();
  });
});
