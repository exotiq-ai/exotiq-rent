import { describe,expect,it } from 'vitest';
import { adaptTeam,adaptVehicleDetail,adaptBusyRanges } from './adapters';
import { currentAvailabilityAuthority,hasKnownAvailability,type AvailabilityAuthority } from './types';
import type { PublicVehicleContext } from './publicContracts';
import type { RpcTeamRow,RpcVehicleDetailRow } from './rpcClient';

const now=Date.parse('2030-01-01T12:00:00Z');
const known:AvailabilityAuthority={status:'KNOWN',checkedAt:new Date(now).toISOString(),windowStart:'2030-01-01',windowEnd:'2030-06-01'};
const team:RpcTeamRow={slug:'agent-test-team',name:'Synthetic operator',logo_url:null,city:'Miami',state:'FL',timezone:'America/New_York'};
const row:RpcVehicleDetailRow={team_slug:team.slug,team_name:team.name,vehicle_slug:'agent-test-car',name:'Synthetic car',make:'Synthetic',model:'Car',year:2030,color:null,daily_rate:'100.25',hero_image_url:'https://example.invalid/car.jpg',min_rental_days:2,rate_3hr:null,rate_6hr:null,rate_multiday:null,default_mileage_limit:100,mileage_overage_rate:2,photos:null,pickup_city:'Miami',pickup_state:'FL',timezone:'America/New_York',currency:'usd'};

describe('availability authority DTO and adapter boundary',()=>{
  it('adapts detail as UNKNOWN without fabricating an empty authoritative calendar',()=>{
    const vehicle=adaptVehicleDetail(row,adaptTeam(team));
    expect(vehicle.availabilityAuthority).toMatchObject({status:'UNKNOWN',reason:'not_checked'});
    expect(vehicle.unavailableRanges).toBeUndefined();
    expect(vehicle.dailyRateCents).toBe(10025);expect(vehicle.heroImage).toBe(row.hero_image_url);
    expect(hasKnownAvailability(vehicle,'2030-01-02','2030-01-04',now)).toBe(false);
  });
  it('distinguishes validated known-empty from missing/UNKNOWN authority',()=>{
    const vehicle={...adaptVehicleDetail(row,adaptTeam(team)),unavailableRanges:adaptBusyRanges([]),availabilityAuthority:known};
    const context:PublicVehicleContext={team:adaptTeam(team),vehicle,availabilityAuthority:known};
    expect(context.availabilityAuthority).toBe(context.vehicle.availabilityAuthority);
    expect(hasKnownAvailability(vehicle,'2030-01-02','2030-01-04',now)).toBe(true);
    expect(hasKnownAvailability({...vehicle,availabilityAuthority:undefined},'2030-01-02','2030-01-04',now)).toBe(false);
    expect(hasKnownAvailability({...vehicle,unavailableRanges:undefined},'2030-01-02','2030-01-04',now)).toBe(false);
  });
  it('does not use grid checked:true or a stale/outside-window snapshot as authority',()=>{
    expect(hasKnownAvailability({unavailableRanges:[],availabilityAuthority:undefined},'2030-01-02','2030-01-04',now)).toBe(false);
    expect(hasKnownAvailability({unavailableRanges:[],availabilityAuthority:known},'2030-07-01','2030-07-04',now)).toBe(false);
    expect(currentAvailabilityAuthority(known,now+300001)).toMatchObject({status:'UNKNOWN',reason:'stale'});
    expect(currentAvailabilityAuthority({...known,checkedAt:'2030-01-02T00:00:00Z'},now).status).toBe('UNKNOWN');
  });
  it('rejects malformed, impossible or reversed busy ranges instead of dropping them',()=>{
    for(const value of [null,{},[{busy_start:'2030-02-30',busy_end:'2030-03-03'}],[{busy_start:'2030-01-03',busy_end:'2030-01-01'}],[{}]]){
      expect(()=>adaptBusyRanges(value as any)).toThrow();
    }
    expect(adaptBusyRanges([{busy_start:'2030-01-01',busy_end:'2030-01-01'}])).toEqual([{start:'2030-01-01',end:'2030-01-01'}]);
  });
});
