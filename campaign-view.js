/* Read-only presentation rules. Historical shelters and relationships stay in saves. */
const SpiritCampaignView = (function(){
  'use strict';
  const met=(state,observer,name)=>!!(state.relations[observer]?.[name]?.met||state.relations[name]?.[observer]?.met);
  function relationshipOrder(state,observer){
    return Object.keys(characterGenders).filter(name=>name!==observer).sort((a,b)=>Number(met(state,observer,b))-Number(met(state,observer,a))||a.localeCompare(b,'en',{sensitivity:'base'}));
  }
  function visibleShelters(state,group){
    const ids=group.activeShelterId?[group.activeShelterId]:group.shelterIds;
    return [...new Set(ids)].filter(id=>state.shelters[id]?.status==='active');
  }
  return {met,relationshipOrder,visibleShelters};
})();
