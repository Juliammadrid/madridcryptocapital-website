exports.handler = async (event) => {
  const date = event.queryStringParameters?.date;
  if (!date) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing date' }) };
  }

  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return { statusCode: 200, body: JSON.stringify({ bookedTimes: [] }) };
  }

  try {
    // Obtener access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type:    'refresh_token',
      }),
    });
    const { access_token } = await tokenRes.json();

    if (!access_token) {
      return { statusCode: 200, body: JSON.stringify({ bookedTimes: [] }) };
    }

    // Consultar eventos del día en Google Calendar
    const timeMin = encodeURIComponent(`${date}T00:00:00-04:00`);
    const timeMax = encodeURIComponent(`${date}T23:59:59-04:00`);

    const calRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    const calData = await calRes.json();

    // Extraer horarios ocupados (solo asesorías MCC)
    const bookedTimes = (calData.items || [])
      .filter(e => e.summary?.startsWith('Asesoría MCC') && e.start?.dateTime)
      .map(e => {
        // Extraer HH:MM directamente del string de fecha
        const match = e.start.dateTime.match(/T(\d{2}:\d{2})/);
        return match ? match[1] : null;
      })
      .filter(Boolean);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ bookedTimes }),
    };

  } catch (err) {
    console.error('get-slots error:', err.message);
    return { statusCode: 200, body: JSON.stringify({ bookedTimes: [] }) };
  }
};
