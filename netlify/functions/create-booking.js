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

  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Configuración de Google incompleta' }) };
  }

  try {
    // 1. Obtener access token
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

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      throw new Error('No access token: ' + JSON.stringify(tokenData));
    }

    // 2. Parsear fecha y hora (zona horaria Chile)
    const [y, m, d] = data.date.split('-').map(Number);
    const [h, min]  = data.time.split(':').map(Number);

    const startISO = `${data.date}T${data.time}:00`;
    const endDate  = new Date(y, m - 1, d, h, min + 15);
    const endISO   = `${data.date}T${String(endDate.getHours()).padStart(2,'0')}:${String(endDate.getMinutes()).padStart(2,'0')}:00`;

    // 3. Crear evento con Google Meet
    const calRes = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all',
      {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          summary: `Asesoría MCC · ${data.name}`,
          description: [
            `👤 Nombre: ${data.name}`,
            `📧 Email: ${data.email}`,
            `📱 Teléfono: ${data.phone || '-'}`,
            `🏷️ Tipo: ${data.clientType || '-'}`,
            `📋 Situación: ${data.situation || data.experience || '-'}`,
            `🎯 Objetivos: ${data.goals || '-'}`,
            `💰 Presupuesto: ${data.budget || '-'}`,
          ].join('\n'),
          start: {
            dateTime: startISO,
            timeZone: 'America/Santiago',
          },
          end: {
            dateTime: endISO,
            timeZone: 'America/Santiago',
          },
          attendees: [
            { email: data.email },
          ],
          conferenceData: {
            createRequest: {
              requestId:           `mcc-${Date.now()}`,
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          },
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'email', minutes: 60 },
              { method: 'popup', minutes: 15 },
            ],
          },
        }),
      }
    );

    const calData = await calRes.json();

    if (!calRes.ok) {
      throw new Error('Calendar API error: ' + JSON.stringify(calData));
    }

    const meetLink = calData.conferenceData?.entryPoints?.[0]?.uri || '';

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, eventId: calData.id, meetLink }),
    };

  } catch (err) {
    console.error('Booking error:', err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'No se pudo crear el evento: ' + err.message }),
    };
  }
};
