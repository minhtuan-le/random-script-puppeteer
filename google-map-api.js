import fetch from 'node-fetch';
import 'dotenv/config';


export async function getTransitTime(origin, destination) {
  const apiKey = 'YOUR_API_KEY';
  const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
  url.searchParams.set('origins', origin);
  url.searchParams.set('destinations', destination);
  url.searchParams.set('mode', 'transit');
  url.searchParams.set('key', apiKey);

  const response = await fetch(url.toString());
  const data = await response.json();

  const elem = data.rows[0]?.elements[0];
  if (!elem || elem.status !== 'OK') {
    console.error('Error or no route:', elem?.status);
    return null;
  }

  return {
    text: elem.duration.text,
    seconds: elem.duration.value
  };
}
