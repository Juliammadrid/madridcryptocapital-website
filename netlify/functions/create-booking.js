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

    // Mapeos de valores a texto legible
    const situationMap = {
      active: 'Tengo portafolio activo y quiero optimizarlo',
      losses: 'Tengo inversiones en pérdidas y necesito orientación',
      new:    'Soy nuevo, quiero empezar desde cero',
    };
    const experienceMap = {
      active:    'Ya tenemos un proyecto blockchain activo',
      idea:      'Tenemos la idea pero no sabemos por dónde empezar',
      exploring: 'Solo estamos explorando posibilidades',
    };
    const budgetMap = {
      small:  'Menos de $5,000',
      medium: '$5,000 – $20,000',
      large:  '$20,000 – $100,000',
      xlarge: 'Más de $100,000',
    };
    const goalsMap = {
      dca:       'Estrategia de inversión a largo plazo (DCA, Bitcoin)',
      trading:   'Trading y análisis técnico',
      security:  'Seguridad y custodia de activos',
      diversify: 'Diversificación de portafolio',
      tokenize:  'Tokenizar un activo o empresa',
      payments:  'Aceptar pagos en criptomonedas',
      nft:       'Lanzar NFTs / colección digital',
      coin:      'Crear su propia criptomoneda',
      rwa:       'Activos del mundo real (RWA)',
      consulting:'Consultoría blockchain general',
    };
    const situationText = situationMap[data.situation] || experienceMap[data.experience] || data.situation || data.experience || '-';
    const budgetText    = budgetMap[data.budget] || data.budget || '-';
    const rawGoals  = data.goals || data.projectType || '-';
    const goalsText = rawGoals.split(', ').map(g => goalsMap[g] || g).join(', ');

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
            `🏷️ Tipo: ${data.clientType === 'empresa' ? 'Empresa' : 'Persona/Individuo'}`,
            data.companyName ? `🏢 Empresa: ${data.companyName}` : '',
            `📋 Situación: ${situationText}`,
            `🎯 Objetivos: ${goalsText}`,
            `💰 Presupuesto: ${budgetText}`,
          ].filter(Boolean).join('\n'),
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
            { email: 'juliam.madrid7@gmail.com' },
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

    // 4. Enviar email de notificación inmediata a juliam
    const emailBody = [
      `🔔 NUEVA RESERVA - Madrid Crypto Capital`,
      ``,
      `👤 Nombre: ${data.name}`,
      `📧 Email: ${data.email}`,
      `📱 Teléfono: ${data.phone || '-'}`,
      `🏷️ Tipo de cliente: ${data.clientType === 'empresa' ? 'Empresa' : 'Persona/Individuo'}`,
      data.companyName ? `🏢 Empresa: ${data.companyName}` : '',
      `📋 Situación: ${situationText}`,
      `🎯 Objetivos: ${goalsText}`,
      `💰 Presupuesto: ${budgetText}`,
      ``,
      `📅 Fecha: ${data.date}`,
      `🕐 Hora: ${data.time} hrs (Hora Chile)`,
      `🎥 Google Meet: ${meetLink}`,
    ].filter(Boolean).join('\n');

    const emailRaw = [
      `To: juliam.madrid7@gmail.com`,
      `Subject: Nueva reserva: ${data.name} - ${data.date} ${data.time}`,
      `Content-Type: text/plain; charset=utf-8`,
      ``,
      emailBody,
    ].join('\n');

    const encodedEmail = Buffer.from(emailRaw).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ raw: encodedEmail }),
    });

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
