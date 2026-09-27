const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx={URL,HTMLElement:class{},customElements:{get:()=>false,define:()=>{}},window:{},structuredClone,localStorage:{setItem(){}}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/nfc-card-enroller.js','utf8')+'\nglobalThis.test={parseBatch,assign,escapeHtml,resolveNames,NfcCardEnroller,DEVICE,visibleCards};',ctx);
const {parseBatch,assign,escapeHtml}=ctx.test;
const dated={old:{name:'Old',assigned_at:'2026-01-01T10:00:00Z'},fresh:{name:'Fresh',assigned_at:'2026-02-01T10:00:00Z'},legacy:{name:'Legacy'},invalid:{name:'Invalid',assigned_at:'bad'}};
assert.equal(ctx.test.visibleCards(dated,'','newest')[0][0],'fresh');
assert.equal(ctx.test.visibleCards(dated,'','oldest')[0][0],'old');
assert.equal(ctx.test.visibleCards(dated,'','oldest')[1][0],'fresh');
assert.equal(ctx.test.visibleCards(dated,'Fresh','newest').length,1);
const assigned=[{name:'New',uri:'spotify:album:6Lr6waPB6WbWYc0dZddF1s'}];
assign(assigned,{},'AA-BB-CC-DD');assert.ok(Number.isFinite(Date.parse(assigned[0].assigned_at)));
const stamp=assigned[0].assigned_at;assign(assigned,{},'AA-BB-CC-DD');assert.equal(assigned[0].assigned_at,stamp);
console.log('PASS: assignment timestamps, chronological sorting, unknown dates last, duplicate scans preserve timestamp.');

for(const type of ['album','playlist','track']){
  for(const provider of ['spotify','spotify--kAzBfto7']){
    const row=parseBatch(`Custom | ${provider}://${type}/6Lr6waPB6WbWYc0dZddF1s`)[0];
    assert.equal(row.uri,`spotify:${type}:6Lr6waPB6WbWYc0dZddF1s`);assert.equal(row.name,'Custom');
  }
}
assert.equal(parseBatch('spotify--kAzBfto7://album/6Lr6waPB6WbWYc0dZddF1s')[0].manualName,false);
for(const bad of ['library://album/42','spotify--test://artist/6Lr6waPB6WbWYc0dZddF1s','spotify--test://album/short','spotify--test://album/6Lr6waPB6WbWYc0dZddF1s/extras'])assert.throws(()=>parseBatch(bad));
console.log('PASS: Music Assistant Spotify URIs normalize; invalid IDs, artists and library URIs rejected.');

const rows=parseBatch('Test | https://open.spotify.com/intl-de/album/6xTRKdIeqh0L83hQolUrYT?highlight=spotify:track:4svEQNlfJhLDDX8ZNPByW8\nMix | spotify:playlist:37i9dQZF1E4weo7Nn3vlcB');
assert.equal(rows[0].uri,'spotify:album:6xTRKdIeqh0L83hQolUrYT');assert.equal(rows[0].name,'Test');
assert.throws(()=>parseBatch('https://open.spotify.com/playlist/invalid'));
assert.throws(()=>parseBatch('{{ x }} | spotify:playlist:37i9dQZF1E4weo7Nn3vlcB'));
const map={'AA-BB-CC-01':{name:'Existing',uri:'spotify:album:6xTRKdIeqh0L83hQolUrYT'}};
assert.equal(assign(rows,map,'AA-BB-CC-01').candidate,'AA-BB-CC-01');assert.equal(rows[0].uid,null);
assert.match(assign(rows,map,'AA-BB-CC-01').message,/AA-BB-CC-01.*Existing/);
assign(rows,map,'AA-BB-CC-01',true);assert.equal(rows[0].uid,'AA-BB-CC-01');
assign(rows,map,'AA-BB-CC-01');assert.equal(rows[1].uid,null);
assert.match(assign(rows,map,'AA-BB-CC-01').message,/AA-BB-CC-01.*Test/);
assign(rows,map,'AA-BB-CC-DD');assert.equal(rows[1].uid,'AA-BB-CC-DD');
assert.equal(escapeHtml('<img src=x>'),'&lt;img src=x&gt;');assert.throws(()=>assign(rows,map,'bad'));
console.log('PASS: URLs, album semantics, validation, overwrite protection, duplicate scans, queue order, HTML escaping.');
const check={active:true,checking:true,busy:false,renewed:Date.now(),rows:structuredClone(rows),map:structuredClone(map),render(){},persist(){throw Error('Inspection must not modify the draft');}};
const before=JSON.stringify({rows:check.rows,map:check.map});
ctx.test.NfcCardEnroller.prototype.scan.call(check,{data:{device_id:ctx.test.DEVICE,tag_id:'aa-bb-cc-dd'}});
assert.equal(check.lastUid,'AA-BB-CC-DD');
assert.equal(JSON.stringify({rows:check.rows,map:check.map}),before);
console.log('PASS: inspection shows UID without changing draft or saved mappings.');
check.readerId='second-reader';const lastUid=check.lastUid;
ctx.test.NfcCardEnroller.prototype.scan.call(check,{data:{device_id:ctx.test.DEVICE,tag_id:'11-22-33-44'}});
assert.equal(check.lastUid,lastUid);
ctx.test.NfcCardEnroller.prototype.scan.call(check,{data:{device_id:'second-reader',tag_id:'11-22-33-44'}});
assert.equal(check.lastUid,'11-22-33-44');
const session={readerId:'a',_hass:{states:{'sensor.nfc_jukebox_sessions':{attributes:{leases:{a:123,b:456}}}}}};
assert.equal(ctx.test.NfcCardEnroller.prototype.leaseUntil.call(session),123);session.readerId='b';
assert.equal(ctx.test.NfcCardEnroller.prototype.leaseUntil.call(session),456);
console.log('PASS: scans and enrollment leases are isolated by selected reader.');
(async()=>{
  let stored={variables:{card_map:structuredClone(map)},sequence:[{action:'preserve'}]};
  let writes=0;
  const editor={base:structuredClone(stored),busy:false,render(){},read:async()=>structuredClone(stored),_hass:{callApi:async(method,path,data)=>{writes++;stored=structuredClone(data);},callService:async()=>{}}};
  await ctx.test.NfcCardEnroller.prototype.saveKind.call(editor,'AA-BB-CC-01','audiobook');
  assert.equal(stored.variables.card_map['AA-BB-CC-01'].kind,'audiobook');
  assert.equal(stored.variables.card_map['AA-BB-CC-01'].uri,map['AA-BB-CC-01'].uri);
  assert.deepEqual(stored.sequence,[{action:'preserve'}]);assert.equal(writes,1);
  stored.concurrentChange=true;
  await ctx.test.NfcCardEnroller.prototype.saveKind.call(editor,'AA-BB-CC-01','music');
  assert.equal(writes,1);assert.equal(stored.variables.card_map['AA-BB-CC-01'].kind,'audiobook');
  console.log('PASS: saved type update preserves mapping and script; concurrent edits block writes.');
  delete stored.concurrentChange;
  await ctx.test.NfcCardEnroller.prototype.saveKind.call(editor,'AA-BB-CC-01','  New title  ','name');
  assert.equal(stored.variables.card_map['AA-BB-CC-01'].name,'New title');
  assert.equal(stored.variables.card_map['AA-BB-CC-01'].kind,'audiobook');
  assert.equal(stored.variables.card_map['AA-BB-CC-01'].uri,map['AA-BB-CC-01'].uri);
  const renameWrites=writes;
  await ctx.test.NfcCardEnroller.prototype.saveKind.call(editor,'AA-BB-CC-01','{{ unsafe }}','name');
  await ctx.test.NfcCardEnroller.prototype.saveKind.call(editor,'AA-BB-CC-01','  ','name');
  assert.equal(writes,renameWrites);
  console.log('PASS: rename preserves URI/type and rejects blank/template titles.');
  const original=structuredClone(stored);
  await ctx.test.NfcCardEnroller.prototype.deleteCard.call(editor,'AA-BB-CC-01');
  assert.equal(Object.keys(stored.variables.card_map).length,0);assert.equal(editor.deleted.length,1);
  await ctx.test.NfcCardEnroller.prototype.deleteCard.call(editor,null,true);
  assert.deepEqual(stored,original);assert.equal(editor.deleted.length,0);
  editor.active=true;editor.checking=false;const oldWrites=writes;
  await ctx.test.NfcCardEnroller.prototype.deleteCard.call(editor,'AA-BB-CC-01');assert.equal(writes,oldWrites);
  const many=Object.fromEntries(Array.from({length:80},(_,i)=>[`AA-BB-${i}`,{name:`Elena ${80-i}`,kind:i%2?'music':'audiobook'}]));
  assert.equal(ctx.test.visibleCards(many,'','title')[0][1].name,'Elena 1');
  assert.equal(ctx.test.visibleCards(many,'AUDIOBOOK').length,40);
  assert.equal(ctx.test.visibleCards(many,'AA-BB-79').length,1);
  assert.equal(ctx.test.visibleCards(many,'no match').length,0);
  console.log('PASS: delete/undo restores full mapping; learning blocks deletion; 80-card search and numeric title sort.');
  const auto=parseBatch('https://open.spotify.com/intl-de/album/4Vo30C4a0cpVbTtVHZKYIg\nMy title | spotify:playlist:37i9dQZF1E4weo7Nn3vlcB');
  let calls=0;
  await ctx.test.resolveNames(auto,async uri=>{calls++;assert.equal(uri,'spotify:album:4Vo30C4a0cpVbTtVHZKYIg');return 'Album from Spotify';});
  assert.equal(auto[0].name,'Album from Spotify');assert.equal(auto[1].name,'My title');assert.equal(calls,1);
  const failed=parseBatch('spotify:album:4Vo30C4a0cpVbTtVHZKYIg');
  await ctx.test.resolveNames(failed,async()=>{throw Error('offline');});
  assert.equal(failed[0].name,'');assert.ok(failed[0].nameError);
  await ctx.test.resolveNames(failed,async()=>'Loaded on retry');assert.equal(failed[0].name,'Loaded on retry');assert.ok(!failed[0].nameError);
  console.log('PASS: automatic title, manual override, failure visibility, retry.');
  for(const backend of ['spotify','music_assistant']) for(const [status,uid] of [['connection','last_card_uid'],['verbindung','letzte_karten_uid']]){
    let profiles={variables:{profiles:{}}};
    const fields={'profile-backend':backend,'profile-device':'reader-1','profile-player':'media_player.spotify_test',
      'profile-source':'Office','profile-name':'Desk','profile-kind':'audiobook','profile-shuffle':'keep'};
    const pairing={busy:false,active:false,profiles:{},profileBase:structuredClone(profiles),
      shadowRoot:{querySelector:id=>({value:fields[id.slice(1)]})},
      entities:[{entity_id:'media_player.spotify_test',platform:backend},{device_id:'reader-1',entity_id:`binary_sensor.panel_${status}`},
                {device_id:'reader-1',entity_id:`sensor.panel_${uid}`}],
      leaseFor:()=>0,render(){},buildProfiles(){},loadProfile(){},
      _hass:{states:{'media_player.spotify_test':{attributes:{source_list:['Office']}}},
        callApi:async(method,path,data)=>{if(method==='POST')profiles=structuredClone(data);return structuredClone(profiles);},
        callService:async()=>{}}};
    await ctx.test.NfcCardEnroller.prototype.saveProfile.call(pairing);
    assert.equal(profiles.variables.profiles['reader-1'].status_entity,`binary_sensor.panel_${status}`);
    assert.equal(profiles.variables.profiles['reader-1'].last_uid_entity,`sensor.panel_${uid}`);
    assert.equal(profiles.variables.profiles['reader-1'].default_kind,'audiobook');
    assert.equal(profiles.variables.profiles['reader-1'].backend,backend);
    assert.equal(profiles.variables.profiles['reader-1'].source,backend==='spotify'?'Office':'');
  }
  console.log('PASS: reader pairing detects English and legacy sensor entity names.');
})().catch(e=>{console.error(e);process.exitCode=1;});
