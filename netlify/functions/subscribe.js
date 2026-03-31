exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let email;
  try {
    const body = JSON.parse(event.body);
    email = body.email;
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request' }) };
  }

  if (!email) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Email requerido' }) };
  }

  const pubId  = process.env.BEEHIIV_PUBLICATION_ID  || 'pub_2491035b-0741-43f9-beb9-9f2b474069fc';
  const apiKey = process.env.BEEHIIV_API_KEY || 'Bw1UapS1ifi3S5RC1h9xUoAy39mNh5BCxyo9LPzF94N6ra6AN6bfHoWH5tEaiIJa';

  try {
    const res = await fetch(
      `https://api.beehiiv.com/v2/publications/${pubId}/subscriptions`,
      {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          email,
          reactivate_existing: true,
          send_welcome_email:  true,
        }),
      }
    );

    const data = await res.json();

    if (res.ok) {
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } else {
      return { statusCode: 400, body: JSON.stringify({ error: data.message || 'Error al suscribir' }) };
    }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Error interno' }) };
  }
};
