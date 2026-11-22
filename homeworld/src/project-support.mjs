export {buildingById,footprint} from './building.mjs';
export const completedProjectHomes=state=>(state.buildings||[]).filter(b=>b.status==='complete'&&['hut','tent','cottage','townhouse'].includes(b.kind));
