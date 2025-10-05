exports.handler = async (context, event, callback) => {
  const headers = event.headers || {};
  const proto = headers['x-forwarded-proto'] || headers['X-Forwarded-Proto'] || 'https';
  const host  = headers.host || headers.Host || (context.DOMAIN_NAME || '').replace(/^https?:\/\//,'');
  const base  = `${proto}://${host}`;

  const lat = parseFloat(event.lat);
  const lng = parseFloat(event.lng);

  // Small helper: JSON response via Twilio.Response so fetchers see proper headers
  function json(statusCode, payload) {
    const res = new Twilio.Response();
    res.setStatusCode(statusCode);
    res.appendHeader('Content-Type', 'application/json');
    res.setBody(payload);
    return callback(null, res);
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    console.log('[geo-reboot] missing lat/lng', { lat: event.lat, lng: event.lng });
    return json(400, { ok:false, error:'missing lat/lng' });
  }

  // Load device map
  let map = [];
  try { map = JSON.parse(context.DPL_MAP_JSON || '[]'); }
  catch (e) {
    console.log('[geo-reboot] bad DPL_MAP_JSON', String(e));
    return json(500, { ok:false, error:'bad dpl map json' });
  }
  if (!Array.isArray(map) || map.length === 0) {
    return json(500, { ok:false, error:'no dpl map configured' });
  }

  // Haversine to find nearest device
  const R = 6371; const toRad = d => d*Math.PI/180;
  const here = { lat, lng };
  function distKm(a,b){
    const dLat = toRad(b.lat-a.lat), dLng = toRad(b.lng-a.lng);
    const s = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2;
    return 2*R*Math.asin(Math.sqrt(s));
  }
  let best = null;
  for (const row of map) {
    if (!row || !Number.isFinite(row.lat) || !Number.isFinite(row.lng)) continue;
    const d = distKm(here, row);
    if (!best || d < best.km) best = { km:d, row };
  }
  if (!best) return json(404, { ok:false, error:'no nearby device' });

  const deviceId = best.row.deviceId;
  const km = Number(best.km.toFixed(2));
  console.log('[geo-reboot] nearest', { deviceId, km, lat, lng });

  // Call your public reboot function
  const url = `${base}/dpl-remote-reboot?deviceId=${encodeURIComponent(deviceId)}&km=${encodeURIComponent(km)}`;
  let ok = false, status = 0, text = '';
  try {
    const r = await fetch(url, { method:'POST' });
    status = r.status;
    ok = r.ok;
    text = await r.text().catch(()=> '');
  } catch (e) {
    console.log('[geo-reboot] reboot error', String(e));
    return json(502, { ok:false, error:String(e) });
  }

  console.log('[geo-reboot] reboot result', { deviceId, km, ok, status, text: (text||'').slice(0,200) });
  if (!ok) return json(502, { ok:false, status, error:'reboot request failed' });
  return json(200, { ok:true, deviceId, km });
};
