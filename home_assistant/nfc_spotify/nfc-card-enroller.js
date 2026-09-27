/* HA-native Lovelace card; public Spotify oEmbed titles, no Spotify token. */
const SCRIPT = 'nfc_jukebox_play_card';
const PROFILE_SCRIPT='nfc_jukebox_reader_config';
const SESSIONS='sensor.nfc_jukebox_sessions';
const DEVICE = 'example-reader';
const DRAFT = 'nfc-card-enroller-draft-v1';
const kindOf = row => row?.kind === 'audiobook' ? 'audiobook' : 'music';
const kindLabel = row => kindOf(row)==='audiobook'?'Audiobook':'Music';
const kindSelect = (row,attrs) => `<select ${attrs} aria-label="Type for ${escapeHtml(row.name)}"><option value="music" ${kindOf(row)==='music'?'selected':''}>Music</option><option value="audiobook" ${kindOf(row)==='audiobook'?'selected':''}>Audiobook</option></select>`;
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const visibleCards = (map,query='',sort='title') => {
  const needle=query.trim().toLocaleLowerCase('en');
  return Object.entries(map||{}).filter(([uid,r])=>`${uid} ${r.name} ${kindLabel(r)}`.toLocaleLowerCase('en').includes(needle))
    .sort((a,b)=>{
      const key=sort==='id'?0:1;
      const value=entry=>key===0?entry[0]:sort==='type'?kindLabel(entry[1]):entry[1].name;
      return String(value(a)).localeCompare(String(value(b)),'en',{numeric:true,sensitivity:'base'})||a[0].localeCompare(b[0]);
    });
};
const parseBatch = text => {
  const rows = text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).map((line,i)=>{
    const m = line.match(/https:\/\/open\.spotify\.com\/[^\s]+|spotify(?:--[A-Za-z0-9_-]+)?:\/\/[^\s]+|spotify:(?:playlist|album|track):[A-Za-z0-9]+/);
    if (!m) throw Error(`Line ${i+1}: Missing Spotify link.`);
    let uri=m[0].replace(/[)>\]]+$/,'');
    const ma=uri.match(/^spotify(?:--[A-Za-z0-9_-]+)?:\/\/(playlist|album|track)\/([A-Za-z0-9]{22})\/?$/);
    if(ma)uri=`spotify:${ma[1]}:${ma[2]}`;
    if (uri.startsWith('https:')) {
      const url=new URL(uri), p=url.pathname.match(/^\/(?:intl-[a-zA-Z-]+\/)?(playlist|album|track)\/([A-Za-z0-9]{22})\/?$/);
      if(url.hostname!=='open.spotify.com'||!p) throw Error(`Line ${i+1}: Use a direct playlist, album or track link.`);
      uri=`spotify:${p[1]}:${p[2]}`;
    }
    if(!/^spotify:(playlist|album|track):[A-Za-z0-9]{22}$/.test(uri)) throw Error(`Line ${i+1}: Invalid link.`);
    const prefix=line.slice(0,m.index),manualName=prefix.includes('|');
    const name=manualName?prefix.slice(0,prefix.indexOf('|')).trim():'';
    if(manualName&&!name)throw Error(`Line ${i+1}: Enter a custom title before | or remove |.`);
    if(/[{}]/.test(name)) throw Error(`Line ${i+1}: Use a plain title without curly braces.`);
    return {name:name.slice(0,160),manualName,uri,uid:null,kind:'music'};
  });
  if(!rows.length||rows.length>200) throw Error('Enter 1 to 200 items.');
  return rows;
};
const titleCache = new Map();
const fetchTitle = uri => {
  if(titleCache.has(uri))return titleCache.get(uri);
  const pending=(async()=>{
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);
    try{
      const url='https://open.spotify.com/'+uri.split(':').slice(1).join('/');
      const response=await fetch('https://open.spotify.com/oembed?url='+encodeURIComponent(url),{credentials:'omit',referrerPolicy:'no-referrer',signal:controller.signal});
      if(!response.ok)throw Error('Spotify is not responding.');
      const data=await response.json();
      if(typeof data.title!=='string'||!data.title.trim())throw Error('Spotify did not return a title.');
      // HA renders strings inside script variables as templates: keep braces literal.
      return data.title.trim().replaceAll('{','｛').replaceAll('}','｝').slice(0,160);
    }finally{clearTimeout(timeout);}
  })();
  titleCache.set(uri,pending);
  pending.catch(()=>titleCache.delete(uri));
  return pending;
};
const resolveNames = async(rows,lookup=fetchTitle)=>{
  let index=0;
  await Promise.all(Array.from({length:Math.min(4,rows.length)},async()=>{
    while(index<rows.length){
      const row=rows[index++],legacy=`${row.uri.split(':')[1]} ${row.uri.split(':')[2]}`;
      if(row.name&&row.name!==legacy&&!row.nameError)continue;
      try{row.name=await lookup(row.uri);delete row.nameError;}
      catch{row.name='';row.nameError='Title could not be loaded. Try again or enter a custom title.';}
    }
  }));
  return rows;
};
const assign = (rows,map,uid,replace=false)=>{
  if(!/^[0-9A-F]{2}(?:-[0-9A-F]{2}){3,9}$/.test(uid)) throw Error('Invalid card ID.');
  const duplicate=rows.find(r=>r.uid===uid);
  if(duplicate) return {message:`Card ${uid} is already in the batch: “${duplicate.name}”. Scan the next card.`};
  const row=rows.find(r=>!r.uid);
  if(!row) return {message:'All cards scanned. Save the batch now.'};
  if(map[uid]&&!replace) return {candidate:uid,message:`Card ${uid} is saved as “${map[uid].name}”.`};
  row.uid=uid;
  return {message:`Scanned: ${row.name} · Card ${uid}. Remove the card.`};
};

class NfcCardEnroller extends HTMLElement {
  constructor(){
    super();this.attachShadow({mode:'open'});this.rows=[];this.active=false;this.busy=false;this.ready=false;this.message='Connecting to Home Assistant …';
    try{this.rows=JSON.parse(localStorage.getItem(DRAFT)||'[]');}catch{}
    try{this.deleted=JSON.parse(localStorage.getItem(DRAFT+'-deleted')||'[]');}catch{this.deleted=[];}
  }
  setConfig(config){this.config=config;}
  set hass(hass){this._hass=hass;if(this.isConnected&&!this.initializing&&!this.ready)this.init();if(this.ready)this.render();}
  getCardSize(){return 10;}
  connectedCallback(){if(this._hass&&!this.initializing&&!this.ready)this.init();}
  disconnectedCallback(){
    this.ready=false;clearInterval(this.timer);this.unsubscribe?.();this.unsubscribe=null;
    if(this.active){this.active=false;this.lease(-1).catch(()=>{});}
  }
  persist(){localStorage.setItem(this.readerId?DRAFT+'-reader-'+this.readerId:DRAFT,JSON.stringify(this.rows));}
  loadReaderDraft(){
    try{this.rows=JSON.parse(localStorage.getItem(DRAFT+'-reader-'+this.readerId)||'[]');}catch{this.rows=[];}
    this.candidate=null;
  }
  async read(){return this._hass.callApi('GET',`config/script/config/${SCRIPT}`);}
  async deleteCard(uid,restore=false){
    if(this.busy||this.active&&!this.checking)return;
    const item=restore?this.deleted?.at(-1):null;
    if(restore&&!item)return;
    if(restore)uid=item.uid;
    this.busy=true;this.render();
    try{
      const current=await this.read();
      if(JSON.stringify(current)!==JSON.stringify(this.base))throw Error('Mappings have changed. Reload the page.');
      const card=restore?item.card:current.variables.card_map[uid];
      if(!card)throw Error('This card is no longer saved.');
      if(restore&&current.variables.card_map[uid])throw Error('This ID has been reassigned. Restore cancelled.');
      localStorage.setItem(DRAFT+'-last-backup',JSON.stringify(current));
      const updated=structuredClone(current);
      if(restore)updated.variables.card_map[uid]=structuredClone(card);
      else delete updated.variables.card_map[uid];
      await this._hass.callApi('POST',`config/script/config/${SCRIPT}`,updated);
      await this._hass.callService('script','reload',{});
      const verified=await this.read();
      if(JSON.stringify(verified.variables.card_map)!==JSON.stringify(updated.variables.card_map))throw Error('Could not verify the save.');
      this.base=verified;this.map=verified.variables.card_map;
      this.deleted=this.deleted||[];
      if(restore)this.deleted.pop();else this.deleted.push({uid,card});
      localStorage.setItem(DRAFT+'-deleted',JSON.stringify(this.deleted));
      this.message=`${card.name} (${uid}): mapping ${restore?'restored':'deleted'}.`;
    }catch(e){this.message=e.message||'Change failed.';}
    finally{this.busy=false;this.render();}
  }
  async saveKind(uid,kind,field='kind'){
    if(this.busy||this.active&&!this.checking)return;
    if(field==='name'){
      kind=String(kind).trim();
      if(!kind||kind.length>160||/[{}]/.test(kind)){this.message='Enter a title of 1 to 160 characters without curly braces.';this.render();return;}
    }else if(field!=='kind'||!['music','audiobook'].includes(kind))return;
    this.busy=true;this.render();
    try{
      const current=await this.read();
      if(JSON.stringify(current)!==JSON.stringify(this.base))throw Error('Mappings have changed. Reload the page.');
      if(!current.variables.card_map[uid])throw Error('This card is no longer saved.');
      localStorage.setItem(DRAFT+'-last-backup',JSON.stringify(current));
      const updated=structuredClone(current);updated.variables.card_map[uid][field]=kind;
      await this._hass.callApi('POST',`config/script/config/${SCRIPT}`,updated);
      await this._hass.callService('script','reload',{});
      const verified=await this.read();
      if(JSON.stringify(verified.variables.card_map)!==JSON.stringify(updated.variables.card_map))throw Error('Could not verify the save.');
      this.base=verified;this.map=verified.variables.card_map;
      this.editing=null;this.message=field==='name'?'Title saved.':`${this.map[uid].name}: ${kindLabel(this.map[uid])} saved.`;
    }catch(e){this.message=e.message||'Could not save the card type.';}
    finally{this.busy=false;this.render();}
  }
  readerOnline(){const entity=this.profiles?.[this.readerId]?.status_entity;return !!this.profiles?.[this.readerId]&&(!entity||this._hass.states[entity]?.state==='on');}
  leaseUntil(){return Number(this._hass.states[SESSIONS]?.attributes.leases?.[this.readerId]||0);}
  async lease(seconds){await this._hass.callService('script','nfc_jukebox_session',{reader_id:this.readerId,seconds});this.renewed=Date.now();}
  async init(){
    this.initializing=true;
    try{
      if(!this._hass.user?.is_admin)throw Error('A Home Assistant administrator account is required to manage cards.');
      this.base=await this.read();this.map=this.base.variables.card_map;
      [this.profileBase,this.devices,this.entities,this.tags]=await Promise.all([this._hass.callApi('GET',`config/script/config/${PROFILE_SCRIPT}`),this._hass.callWS({type:'config/device_registry/list'}),this._hass.callWS({type:'config/entity_registry/list'}),this._hass.callWS({type:'tag/list'})]);
      this.profiles=this.profileBase.variables.profiles;this.readerId=Object.keys(this.profiles)[0]||'';
      if(this.readerId){
        const key=DRAFT+'-reader-'+this.readerId;
        if(localStorage.getItem(key)===null&&this.rows.length){this.persist();localStorage.removeItem(DRAFT);}
        this.loadReaderDraft();
      }
      const last=this._hass.states[this.profiles[this.readerId]?.last_uid_entity]?.state;
      if(/^[0-9A-F]{2}(?:-[0-9A-F]{2}){3,9}$/.test(last||''))this.lastUid=last;
      if(!this.isConnected)return;
      this.unsubscribe=await this._hass.connection.subscribeEvents(e=>this.scan(e),'tag_scanned');
      this.ready=true;this.message='Ready. Paste links or resume your saved draft.';this.build();
      this.timer=setInterval(()=>this.tick(),10000);
    }catch(e){this.shadowRoot.innerHTML=`<ha-card><div style="padding:24px">${escapeHtml(e.message||'Connection failed.')}</div></ha-card>`;}
    finally{this.initializing=false;}
  }
  async tick(){
    if(this.active){
      if(!this._hass.connected||!this.readerOnline()||Date.now()-this.renewed>75000){
        this.active=false;this.message='Enrollment paused: connection lost. Your draft has been kept.';
        this.lease(-1).catch(()=>{});
      }else if(Date.now()-this.renewed>25000){
        try{await this.lease(90);}catch{this.active=false;this.message='Enrollment paused: could not acquire the playback lock.';}
      }
    }
    this.render();
  }
  scan(event){
    if(event.data.device_id!==(this.readerId||DEVICE))return;
    const uid=String(event.data.tag_id).toUpperCase();
    if(!/^[0-9A-F]{2}(?:-[0-9A-F]{2}){3,9}$/.test(uid))return;
    this.lastUid=uid;this.render();
    if(!this.active||this.busy)return;
    if(Date.now()-this.renewed>75000){this.active=false;this.message='Enrollment expired. Start again.';this.render();return;}
    if(this.checking){this.message='Card detected. Inspection does not change mappings.';this.render();return;}
    try{const r=assign(this.rows,this.map,uid);this.message=r.message;this.candidate=r.candidate;this.persist();}
    catch(e){this.message=e.message;}
    this.render();
  }
  async run(action){
    if(this.busy)return;this.actionError=null;this.busy=true;this.render();
    try{
      if(action==='inspect'){
        if(!this.readerOnline())throw Error('The NFC reader is disconnected.');
        if(this.leaseUntil()>Date.now()/1000)throw Error('Another enrollment or inspection session is still active.');
        this.base=await this.read();this.map=this.base.variables.card_map;
        await this.lease(90);this.active=true;this.checking=true;this.candidate=null;
        this.message='Scan cards one at a time. Their IDs and titles appear below without starting playback.';
      }else if(action==='start'){
        if(!this.readerOnline())throw Error('The NFC reader is disconnected.');
        const lease=this.leaseUntil();
        if(lease>Date.now()/1000)throw Error('Enrollment is active in another page. End it there or wait up to 90 seconds.');
        const text=this.shadowRoot.querySelector('textarea').value.trim();
        const rows=text?parseBatch(text):this.rows;
        if(text)for(const row of rows)row.kind=this.profiles[this.readerId]?.default_kind||'music';
        if(text)for(const [i,row] of rows.entries())if(this.rows[i]?.uri===row.uri)row.kind=kindOf(this.rows[i]);
        if(!rows.length)throw Error('Paste Spotify links first.');
        if(text&&this.rows.some(r=>r.uid))throw Error('Your draft already contains scanned cards. Clear the text field to resume, or discard the draft first.');
        this.message='Loading titles from Spotify …';this.render();
        await resolveNames(rows);
        if(rows.some(r=>r.nameError)){
          this.rows=rows;this.persist();
          throw Error('Title could not be loaded. Try again or add a custom title before the link.');
        }
        this.base=await this.read();this.map=this.base.variables.card_map;
        // Re-check resumed assignments against their original known values.
        for(const row of rows)if(row.uid&&this.map[row.uid]&&this.map[row.uid].uri!==row.uri&&!row.replace)
          throw Error(`Card ${row.uid} now has a different mapping. Correct the draft first.`);
        await this.lease(90);this.rows=rows;this.active=true;this.checking=false;this.candidate=null;
        this.shadowRoot.querySelector('textarea').value='';this.message='Scan a card for the next item.';this.persist();
      }else if(action==='stop'){
        this.active=false;await this.lease(-1);this.message='Enrollment ended. Your draft has been kept.';
      }else if(action==='clear'){
        if(this.active)throw Error('End enrollment first.');
        this.rows=[];this.persist();this.message='Draft discarded. Saved cards have been kept.';
      }else if(action==='undo'){
        const row=[...this.rows].reverse().find(r=>r.uid);if(row){row.uid=null;delete row.replace;this.persist();}
        this.candidate=null;this.message='Last assignment undone. Scan the intended card again.';
      }else if(action==='replace'){
        if(!this.active||!this.candidate)throw Error('No card selected for replacement.');
        const row=this.rows.find(r=>!r.uid);const r=assign(this.rows,this.map,this.candidate,true);if(row)row.replace=true;
        this.candidate=null;this.message=r.message;this.persist();
      }else if(action==='save'){
        if(!this.active||this.checking||!this.rows.length||this.rows.some(r=>!r.uid))throw Error('Scan all cards first.');
        const current=await this.read();
        if(JSON.stringify(current)!==JSON.stringify(this.base))throw Error('The configuration has changed. End this session and start again to load the latest version.');
        const updated=structuredClone(current);
        for(const row of this.rows)updated.variables.card_map[row.uid]={name:row.name,uri:row.uri,kind:kindOf(row)};
        localStorage.setItem(DRAFT+'-last-backup',JSON.stringify(current));
        await this.lease(90);
        await this._hass.callApi('POST',`config/script/config/${SCRIPT}`,updated);
        await this._hass.callService('script','reload',{});
        const verified=await this.read();
        if(JSON.stringify(verified.variables.card_map)!==JSON.stringify(updated.variables.card_map))throw Error('Could not verify the save. Your draft has been kept.');
        this.base=verified;this.map=verified.variables.card_map;this.rows=[];this.persist();this.candidate=null;this.active=false;
        try{await this.lease(-1);}catch{this.message='Saved. Enrollment mode will end within 90 seconds.';return;}
        this.message='Saved and activated. The cards can now start playback.';
      }
    }catch(e){this.message=e.message||'Action failed. Your draft has been kept.';this.actionError={action,message:this.message};}
    finally{this.busy=false;this.render();}
  }
  buildProfiles(){
    const el=id=>this.shadowRoot.querySelector('#'+id);
    const options=Object.entries(this.profiles).map(([id,p])=>`<option value="${escapeHtml(id)}">${escapeHtml(p.name)}</option>`).join('');
    el('active-reader').innerHTML=options;el('active-reader').value=this.readerId;
    const known=new Set([...Object.keys(this.profiles),...(this.tags||[]).map(t=>t.device_id)]);
    const readers=this.devices.filter(d=>known.has(d.id)||/nfc|rfid|tag.reader/i.test(`${d.name} ${d.name_by_user} ${d.model}`));
    el('profile-device').innerHTML='<option value="">Select a reader</option>'+readers.map(d=>`<option value="${escapeHtml(d.id)}">${escapeHtml(d.name_by_user||d.name||d.id)}</option>`).join('');
    el('profile-backend').onchange=()=>{this.profilePlayers();this.profileSources();};
    el('active-reader').onchange=()=>{this.persist();this.readerId=el('active-reader').value;this.loadReaderDraft();el('links').value='';this.lastUid=this._hass.states[this.profiles[this.readerId]?.last_uid_entity]?.state;this.loadProfile(this.readerId);};
    el('profile-player').onchange=()=>this.profileSources();
    el('new-profile').onclick=()=>this.loadProfile('');
    el('save-profile').onclick=()=>this.saveProfile();
    el('save-timeout').onclick=()=>this.saveTimeout();
    this.loadProfile(this.readerId);
  }
  profilePlayers(selected=''){
    const el=id=>this.shadowRoot.querySelector('#'+id),ma=el('profile-backend').value==='music_assistant';
    const platform=ma?'music_assistant':'spotify';
    el('profile-player').innerHTML='<option value="">Select player</option>'+this.entities.filter(e=>e.platform===platform&&!e.disabled_by&&e.entity_id.startsWith('media_player.')).map(e=>`<option value="${escapeHtml(e.entity_id)}">${escapeHtml(this._hass.states[e.entity_id]?.attributes.friendly_name||e.entity_id)} (${escapeHtml(e.entity_id)})</option>`).join('');
    el('profile-player').value=selected;
    this.shadowRoot.querySelector('label[for=profile-player]').textContent=ma?'Music Assistant player':'Spotify player / account';
    el('profile-source').hidden=ma;this.shadowRoot.querySelector('label[for=profile-source]').hidden=ma;el('ma-account-note').hidden=!ma;
  }
  profileSources(selected=''){
    const el=id=>this.shadowRoot.querySelector('#'+id);
    const sources=this._hass.states[el('profile-player').value]?.attributes.source_list||[];
    el('profile-source').innerHTML='<option value="">Select a speaker</option>'+sources.map(s=>`<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
    if(selected&&!sources.includes(selected))el('profile-source').innerHTML+=`<option value="${escapeHtml(selected)}">${escapeHtml(selected)} (currently unavailable)</option>`;
    el('profile-source').value=selected;
  }
  loadProfile(id){
    const el=n=>this.shadowRoot.querySelector('#'+n),p=this.profiles[id]||{};
    this.editProfileId=id;this.setupReaderId=null;el('profile-device').value=id;
    el('profile-name').value=p.name||'';el('profile-backend').value=p.backend||'spotify';this.profilePlayers(p.player||'');
    el('profile-kind').value=p.default_kind||'music';el('profile-shuffle').value=p.music_shuffle||'keep';
    this.timeoutEntities={};
    for(const mode of ['playing','idle']){
      const entity=this.entities.find(e=>e.device_id===id&&!e.disabled_by&&e.entity_id.startsWith('number.')&&e.entity_id.endsWith('_display_timeout_'+mode))?.entity_id;
      this.timeoutEntities[mode]=entity;el('display-timeout-'+mode).value=this._hass.states[entity]?.state||'60';
    }
    this.profileSources(p.source||'');this.profileMessage=id?'':'Select and pair a new reader. If it is missing, scan a card with it and reload this page.';this.render();
  }
  async saveTimeout(){
    if(this.busy||this.active||!this.timeoutEntities?.playing||!this.timeoutEntities?.idle)return;
    const values=['playing','idle'].map(mode=>({mode,value:Number(this.shadowRoot.querySelector('#display-timeout-'+mode).value)}));
    if(values.some(({value})=>!Number.isFinite(value)||value<0||value>1800||value%10)){this.profileMessage='Use 0–1800 seconds in steps of 10.';this.render();return;}
    this.busy=true;this.render();
    try{for(const {mode,value} of values)await this._hass.callService('number','set_value',{entity_id:this.timeoutEntities[mode],value});this.profileMessage='Display timeout saved.';}
    catch(e){this.profileMessage=e.message||'Could not save the timeout.';}
    finally{this.busy=false;this.render();}
  }
  async saveProfile(){
    if(this.busy||this.active)return;
    const el=n=>this.shadowRoot.querySelector('#'+n),id=el('profile-device').value,backend=el('profile-backend').value||'spotify',player=el('profile-player').value,source=el('profile-source').value,name=el('profile-name').value.trim();
    if(!id||!name||!player||(backend==='spotify'&&!source)||!['spotify','music_assistant'].includes(backend)||/[{}]/.test(name+source)){this.profileMessage='Select a reader, name, Spotify account and speaker. Do not use curly braces.';this.render();return;}
    if(!this.editProfileId&&this.profiles[id]){this.profileMessage='This reader is already paired. Select its existing profile.';this.render();return;}
    if(backend==='spotify'&&!(this._hass.states[player]?.attributes.source_list||[]).includes(source)){this.profileMessage='The speaker is currently unavailable for this account.';this.render();return;}
    if(!this.entities.some(e=>e.entity_id===player&&e.platform===backend&&!e.disabled_by)){this.profileMessage='Select a player from the chosen playback integration.';this.render();return;}
    if(this.leaseFor(id)>Date.now()/1000){this.profileMessage='This reader has an active enrollment session. End that session first.';this.render();return;}
    const firstSetup=!this.profiles[id];
    this.busy=true;this.render();
    try{
      const current=await this._hass.callApi('GET',`config/script/config/${PROFILE_SCRIPT}`);
      if(JSON.stringify(current)!==JSON.stringify(this.profileBase))throw Error('Profiles have changed. Reload the page.');
      const related=this.entities.filter(e=>e.device_id===id&&!e.disabled_by);
      const previous=current.variables.profiles[id]||{};
      const profile={...previous,name,backend,player,source:backend==='spotify'?source:'',default_kind:el('profile-kind').value,music_shuffle:el('profile-shuffle').value,
        status_entity:previous.status_entity||related.find(e=>e.entity_id.startsWith('binary_sensor.')&&(e.original_device_class==='connectivity'||/connection|verbindung|status/.test(e.entity_id)))?.entity_id||'',
        last_uid_entity:previous.last_uid_entity||related.find(e=>/last_card_uid|letzte_karten_uid|last_tag|last_uid/.test(e.entity_id))?.entity_id||''};
      const updated=structuredClone(current);updated.variables.profiles[id]=profile;
      localStorage.setItem(DRAFT+'-profile-backup',JSON.stringify(current));
      await this._hass.callApi('POST',`config/script/config/${PROFILE_SCRIPT}`,updated);
      await this._hass.callService('script','reload',{});
      const verified=await this._hass.callApi('GET',`config/script/config/${PROFILE_SCRIPT}`);
      if(JSON.stringify(verified.variables.profiles)!==JSON.stringify(updated.variables.profiles))throw Error('Save not confirmed.');
      await this._hass.callService('script',PROFILE_SCRIPT,{});
      this.profileBase=verified;this.profiles=verified.variables.profiles;this.readerId=id;this.buildProfiles();this.loadProfile(id);this.setupReaderId=firstSetup?id:null;
      this.profileMessage=firstSetup?'Pairing saved. See the setup steps below.':'Pairing updated.';this.shadowRoot.querySelector('#reader-setup').open=true;
    }catch(e){this.profileMessage=e.message||'Could not save the pairing.';}
    finally{this.busy=false;this.render();}
  }
  leaseFor(id){return Number(this._hass.states[SESSIONS]?.attributes.leases?.[id]||0);}
  build(){
    this.shadowRoot.innerHTML=`<style>
      :host{display:block;max-width:980px;margin:0 auto;color:var(--primary-text-color)}
      ha-card{padding:24px}h1{font-size:26px;margin:0 0 6px}h2{font-size:18px;margin:24px 0 12px}
      p{line-height:1.5;margin:6px 0 16px;color:var(--secondary-text-color)}
      .status{font-size:14px;margin:16px 0}.focus{padding:18px;background:var(--secondary-background-color);border-radius:12px;margin:18px 0}
      #enrollment-feedback.error{border:2px solid var(--error-color,#db4437);border-left-width:6px}#enrollment-feedback.error #next,#message.error{color:var(--error-color,#db4437)}#message.error{font-weight:600}
      #next{font-size:22px;font-weight:600;margin:6px 0;overflow-wrap:anywhere}#message{line-height:1.5;margin-top:10px}
      textarea{box-sizing:border-box;width:100%;min-height:150px;resize:vertical;padding:12px;border:1px solid var(--divider-color);border-radius:8px;background:var(--card-background-color);color:inherit;font:inherit}
      label{display:block;margin:10px 0}.buttons{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}button{padding:11px 15px;border:1px solid var(--divider-color);border-radius:8px;background:var(--secondary-background-color);color:inherit;font:inherit;cursor:pointer}
      button.primary{background:var(--primary-color);color:var(--text-primary-color)}button:disabled{opacity:.45;cursor:default}small{color:var(--secondary-text-color)}
      select{padding:8px;border:1px solid var(--divider-color);border-radius:6px;background:var(--card-background-color);color:inherit;font:inherit}
      .card-tools{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:14px 0}.card-tools input{flex:1;min-width:180px;padding:10px;border:1px solid var(--divider-color);border-radius:6px;background:var(--card-background-color);color:inherit;font:inherit}
      .table-scroll{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;padding:8px;border-bottom:1px solid var(--divider-color);white-space:nowrap}th{color:var(--secondary-text-color);font-weight:500}.card-id{font-family:monospace}.card-name{max-width:340px;overflow:hidden;text-overflow:ellipsis}td button,td select{padding:6px 8px;font-size:13px}.delete{color:var(--error-color)}td .icon-action{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:0;border-radius:5px;background:transparent;text-decoration:none;font-size:22px;line-height:1}td .icon-action:hover{background:var(--secondary-background-color)}.icon-action svg{width:16px;height:16px;pointer-events:none}
      #panel-config select,#panel-config input{box-sizing:border-box;width:100%;padding:10px;background:var(--card-background-color);color:inherit;border:1px solid var(--divider-color);border-radius:6px;font:inherit}#panel-config small{display:block;margin-top:14px}
      .tabs{display:flex;gap:8px;border-bottom:1px solid var(--divider-color);margin:18px 0}.tabs button{border:0;border-radius:0;background:transparent}.tabs button[aria-selected="true"]{color:var(--primary-color);border-bottom:2px solid var(--primary-color)}#title-editor{padding:14px;background:var(--secondary-background-color);border-radius:8px;margin:12px 0}#edit-title{box-sizing:border-box;width:100%;padding:10px;background:var(--card-background-color);color:inherit;border:1px solid var(--divider-color);border-radius:6px;font:inherit}
      .row{padding:12px 0;border-bottom:1px solid var(--divider-color);overflow-wrap:anywhere;display:grid;grid-template-columns:1fr auto;gap:10px}.row small{display:block;margin-top:4px}.flag{align-self:center;font-size:13px}
      #conflict{padding:14px;border:1px solid var(--warning-color);border-radius:8px;margin:12px 0}[hidden]{display:none!important}
      a{color:var(--primary-color)}@media(max-width:500px){ha-card{padding:16px}.row{grid-template-columns:1fr}.buttons button{flex:1}}
    </style><ha-card>
      <h1>NFC Cards</h1><div class="tabs" role="tablist" aria-label="Card management"><button role="tab" id="tab-learn" data-tab="learn" aria-controls="panel-learn">Enroll</button><button role="tab" id="tab-saved" data-tab="saved" aria-controls="panel-saved">Saved cards</button><button role="tab" id="tab-config" data-tab="config" aria-controls="panel-config">Configuration</button></div>
      <label for="active-reader">Reader</label><select id="active-reader" aria-label="Select a reader"></select><div class="status" id="status"></div>
      <section id="panel-learn" role="tabpanel" aria-labelledby="tab-learn"><p>Paste Spotify links, scan cards one at a time, then save the entire batch.</p><section id="entry"><label for="links">One Spotify link per line</label>
      <textarea id="links" placeholder="Paste Spotify links here – titles are loaded automatically"></textarea>
      <small>Titles are fetched from Spotify when enrollment starts. Optional: Custom title | Link. Album links play the entire album.</small>
      </section>
      <div class="buttons"><button data-action="start" class="primary">Start enrollment</button><button data-action="inspect">Inspect cards</button><button data-action="stop">Stop</button><button data-action="clear">Discard draft</button></div>
      <div class="focus" id="enrollment-feedback"><small id="count"></small><div id="next"></div><div id="message" role="status" aria-live="polite"></div></div>
      <section class="focus" aria-live="polite"><small>Last scanned card</small><div id="last-card"></div></section>
      <div id="conflict" hidden><div id="conflict-text"></div><button data-action="replace">Replace this card assignment</button></div>
      <div id="queue"></div><div class="buttons"><button data-action="save" class="primary">Save batch</button><button data-action="undo">Undo last assignment</button></div>
      </section><section id="panel-saved" role="tabpanel" aria-labelledby="tab-saved" hidden><div class="buttons"><button data-action="inspect">Inspect cards</button><button data-action="stop">Stop</button></div><div id="saved-message" role="status" aria-live="polite"></div><div id="saved-last-card"></div><h2 id="existing-title">Saved cards</h2><div id="title-editor" hidden><label for="edit-title">Edit title</label><input id="edit-title" maxlength="160"><div class="buttons"><button id="save-title" class="primary">Save</button><button id="cancel-title">Cancel</button></div></div>
      <div class="card-tools"><input id="card-search" type="search" aria-label="Search cards" placeholder="Search ID, title or type …"><label for="card-sort">Sort:</label><select id="card-sort"><option value="title">Title A–Z</option><option value="id">Card ID</option><option value="type">Audiobook / Music</option></select><button id="restore-card" hidden>Undo deletion</button></div>
      <small id="card-results"></small><div class="table-scroll"><table><thead><tr><th>ID</th><th>Title</th><th>Type</th><th colspan="3">Actions</th></tr></thead><tbody id="existing"></tbody></table></div></section>
      <section id="panel-config" role="tabpanel" aria-labelledby="tab-config" hidden>
      <p>One pairing per reader. All readers share the card library. Independent simultaneous playback requires separate Spotify accounts.</p>
      <div class="buttons"><button id="new-profile">Pair another reader</button></div>
      <label for="profile-device">NFC reader</label><select id="profile-device"></select>
      <label for="profile-name">Name</label><input id="profile-name" maxlength="80">
      <label for="profile-backend">Playback through</label><select id="profile-backend"><option value="spotify">Spotify Connect</option><option value="music_assistant">Music Assistant</option></select><small id="ma-account-note" hidden>Spotify accounts and music providers are configured in Music Assistant. The Spotify account selector above does not apply to this mode.</small>
      <label for="profile-player">Spotify player / account</label><select id="profile-player"></select>
      <label for="profile-source">Target speaker</label><select id="profile-source"></select>
      <section id="timeout-settings"><label for="display-timeout-playing">Display off while playing (seconds; 0 = always on)</label><input id="display-timeout-playing" type="number" min="0" max="1800" step="10"><label for="display-timeout-idle">Display off while paused/stopped (seconds; 0 = always on)</label><input id="display-timeout-idle" type="number" min="0" max="1800" step="10"><button id="save-timeout">Save timeout</button></section>
      <label for="profile-kind">Default for new cards</label><select id="profile-kind"><option value="music">Music</option><option value="audiobook">Audiobook</option></select>
      <label for="profile-shuffle">Shuffle for music</label><select id="profile-shuffle"><option value="keep">Keep current setting</option><option value="on">On</option><option value="off">Off</option></select>
      <small>Audiobooks always turn shuffle off. Readers without displays can be paired directly; additional displays need the reader-aware firmware installed once.</small>
      <div class="buttons"><button id="save-profile" class="primary">Save pairing</button></div><div id="profile-message" role="status"></div><details id="reader-setup" class="focus" hidden><summary>Finish setting up this reader</summary><p>Pairing saved. This does not confirm that the display is configured. If it already shows the correct playback state, no firmware update is needed.</p><ol><li>If the display says “Set up this reader”: open this device in ESPHome → Edit. Under substitutions, replace the existing reader_id line with:<pre><code id="reader-setup-id"></code></pre></li><li>Save → Install → Wirelessly. This is needed once per new display, or if its HA device ID changes. Changing the Spotify account or speaker needs no flash.</li><li>In the device’s ESPHome integration options, allow Home Assistant actions. Then scan a saved card and verify the selected speaker and display. Readers without a display do not need the display-ID step.</li></ol></details>
      </section>
    </ha-card>`;
    this.buildProfiles();
    this.shadowRoot.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{this.tab=b.dataset.tab;this.render();}));
    this.shadowRoot.querySelector('#save-title').addEventListener('click',()=>this.saveKind(this.editing,this.shadowRoot.querySelector('#edit-title').value,'name'));
    this.shadowRoot.querySelector('#cancel-title').addEventListener('click',()=>{this.editing=null;this.render();});
    this.shadowRoot.querySelector('#edit-title').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();this.shadowRoot.querySelector('#save-title').click();}if(e.key==='Escape'){this.editing=null;this.render();}});
    this.shadowRoot.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>this.run(b.dataset.action)));
    this.shadowRoot.querySelector('#card-search').addEventListener('input',e=>{this.search=e.target.value;this.render();});
    this.shadowRoot.querySelector('#card-sort').addEventListener('change',e=>{this.sort=e.target.value;this.render();});
    this.shadowRoot.querySelector('#restore-card').addEventListener('click',()=>this.deleteCard(null,true));
    this.shadowRoot.querySelector('#existing').addEventListener('click',e=>{const button=e.target.closest('[data-delete]');if(button)this.deleteCard(button.dataset.delete);const edit=e.target.closest('[data-edit]');if(edit&&!this.busy){this.editing=edit.dataset.edit;this.shadowRoot.querySelector('#edit-title').value=this.map[this.editing].name;this.render();this.shadowRoot.querySelector('#edit-title').focus();}});
    this.shadowRoot.addEventListener('change',e=>{
      const select=e.target;
      if(select.matches('[data-row-kind]')){this.rows[Number(select.dataset.rowKind)].kind=select.value;this.persist();this.render();}
      if(select.matches('[data-saved-kind]'))this.saveKind(select.dataset.savedKind,select.value);
    });
    this.render();
  }
  render(){
    if(!this.ready||!this.shadowRoot.querySelector('#status'))return;
    const el=id=>this.shadowRoot.querySelector('#'+id), online=this.readerOnline();
    const done=this.rows.filter(r=>r.uid).length,next=this.rows.find(r=>!r.uid);
    el('status').textContent=`${online?'● Reader connected':'○ Reader disconnected'} · ${this.active?(this.checking?'Inspection active – playback disabled':'Enrollment active – card scans do not start playback'):'Normal playback enabled'}`;
    el('entry').hidden=this.active;el('count').textContent=this.rows.length?`${done} of ${this.rows.length} cards scanned`:'New batch';
    el('next').textContent=this.active?(this.checking?'Which card is this?':next?next.name:'All cards scanned'):this.rows.length?'Resume draft':'Ready to enroll';
    const staged=this.rows.find(r=>r.uid===this.lastUid),saved=this.map?.[this.lastUid];
    el('last-card').innerHTML=this.lastUid?`<strong>${escapeHtml(this.lastUid)}</strong><div>${staged?`In batch: ${escapeHtml(staged.name)} · ${kindLabel(staged)}`:''}</div><div>${saved?`Saved: ${escapeHtml(saved.name)} · ${kindLabel(saved)}`:staged?'Not saved yet':'Not assigned yet'}</div>`:'No card scanned yet.';
    el('message').textContent=this.message;el('saved-message').textContent=this.message;
    const actionFailed=!!this.actionError&&this.actionError.message===this.message;
    el('enrollment-feedback').classList.toggle('error',actionFailed);el('message').classList.toggle('error',actionFailed);
    el('message').setAttribute('role',actionFailed?'alert':'status');el('message').setAttribute('aria-live',actionFailed?'assertive':'polite');
    if(actionFailed){el('next').textContent=this.actionError.action==='start'?'Enrollment not started':'Action failed';el('message').textContent='Error: '+this.message;}
    el('saved-last-card').innerHTML=this.checking&&this.active?el('last-card').innerHTML:'';
    const selectedTab=this.tab||'learn';el('panel-learn').hidden=selectedTab!=='learn';el('panel-saved').hidden=selectedTab!=='saved';el('panel-config').hidden=selectedTab!=='config';
    el('active-reader').disabled=this.active||this.busy;el('profile-message').textContent=this.profileMessage||'';
    el('reader-setup').hidden=this.setupReaderId!==this.editProfileId||!this.setupReaderId;
    el('profile-device').hidden=!!this.editProfileId;this.shadowRoot.querySelector('label[for=profile-device]').hidden=!!this.editProfileId;el('reader-setup-id').textContent=`reader_id: ${this.editProfileId||''}`;
    el('timeout-settings').hidden=!this.timeoutEntities?.playing||!this.timeoutEntities?.idle;el('save-timeout').disabled=this.busy||this.active||Object.values(this.timeoutEntities||{}).some(entity=>!entity||['unavailable','unknown'].includes(this._hass.states[entity]?.state));
    el('save-profile').disabled=this.active||this.busy;
    for(const field of ['profile-device','profile-name','profile-backend','profile-player','profile-source','profile-kind','profile-shuffle','new-profile'])el(field).disabled=this.active||this.busy||(field==='profile-device'&&!!this.editProfileId);
    for(const b of this.shadowRoot.querySelectorAll('[data-tab]'))b.setAttribute('aria-selected',String(b.dataset.tab===(this.tab||'learn')));
    el('title-editor').hidden=!this.editing;el('save-title').disabled=this.busy;el('cancel-title').disabled=this.busy;
    el('conflict').hidden=!this.candidate||!this.active;
    el('conflict-text').textContent=this.candidate?`Card ${this.candidate}: currently “${this.map[this.candidate]?.name||'untitled'}”. Alternatively, scan a different card.`:'';
    el('queue').innerHTML=this.rows.map((r,i)=>`<div class="row"><div>${i+1}. ${escapeHtml(r.name||'Title not loaded')}<small>${escapeHtml(r.nameError||r.uid||'No card yet')}</small></div><span class="flag">${kindSelect(r,`data-row-kind="${i}" ${this.busy?'disabled':''}`)} ${r.uid?'✓ Scanned':'Waiting'}</span></div>`).join('');
    const entries=Object.entries(this.map||{});el('existing-title').textContent=`${entries.length} saved cards`;
    const visible=visibleCards(this.map,this.search,this.sort),locked=this.busy||this.active&&!this.checking;
    el('card-results').textContent=`${visible.length} of ${entries.length} cards`;
    el('restore-card').hidden=!this.deleted?.length;el('restore-card').disabled=locked;
    el('existing').innerHTML=visible.map(([uid,r])=>`<tr><td class="card-id">${escapeHtml(uid)}</td><td class="card-name" title="${escapeHtml(r.name)}">${escapeHtml(r.name)}</td><td>${kindSelect(r,`data-saved-kind="${escapeHtml(uid)}" ${locked?'disabled':''}`)}</td><td><button class="icon-action" title="Edit title" aria-label="Edit title: ${escapeHtml(r.name)}" data-edit="${escapeHtml(uid)}" ${locked?'disabled':''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m16 3 5 5-12 12H4v-5ZM14 5l5 5"/></svg></button></td><td><a class="icon-action" title="Open Spotify" aria-label="Open Spotify: ${escapeHtml(r.name)}" href="https://open.spotify.com/${escapeHtml(r.uri.split(':').slice(1).join('/'))}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7 .1l3-3a5 5 0 0 0-7.1-7.1l-1.7 1.7M14 11a5 5 0 0 0-7-.1l-3 3a5 5 0 0 0 7.1 7.1l1.7-1.7"/></svg></a></td><td><button class="delete icon-action" title="Delete mapping" data-delete="${escapeHtml(uid)}" aria-label="Delete mapping: ${escapeHtml(r.name)} (${escapeHtml(uid)})" ${locked?'disabled':''}><span aria-hidden="true">×</span></button></td></tr>`).join('')||'<tr><td colspan="6">No matching cards.</td></tr>';
    for(const b of this.shadowRoot.querySelectorAll('[data-action]')){
      const a=b.dataset.action;
      b.disabled=this.busy||(['start','inspect'].includes(a)&&(this.active||!online))||(a==='stop'&&!this.active)||(a==='clear'&&(this.active||!this.rows.length))||(a==='save'&&(!this.active||this.checking||!this.rows.length||!!next))||(a==='undo'&&(this.checking&&this.active||!done));
    }
  }
}
if(!customElements.get('nfc-card-enroller'))customElements.define('nfc-card-enroller',NfcCardEnroller);
window.customCards=window.customCards||[];
window.customCards.push({type:'nfc-card-enroller',name:'Enroll NFC cards',description:'Assign Spotify content to cards in batches.'});
