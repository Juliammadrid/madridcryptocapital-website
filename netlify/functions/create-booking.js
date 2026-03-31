const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwFvZG6mDN2Vyd_9p3GbHiBexGlbaSuxjmvEFgC1nWKuSmN7M1_pqkwQZ-ngy5mZe4l/exec';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let data;
  try {
    data = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request' }) };
  }

  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      redirect: 'follow',
    });

    const text = await res.text();
    let result;
    try { result = JSON.parse(text); } catch { result = { success: true }; }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, ...result }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'No se pudo crear el evento: ' + err.message }),
    };
  }
};
