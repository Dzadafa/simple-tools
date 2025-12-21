export default async function handler(request, response) {
  const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;

  if (!APPS_SCRIPT_URL) {
    return response.status(500).json({ error: "Server misconfigured" });
  }

  const body = request.body || {};
  const targetUrl = new URL(APPS_SCRIPT_URL);
  
  Object.keys(body).forEach(key => {
    targetUrl.searchParams.append(key, body[key]);
  });

  try {
    const googleResponse = await fetch(targetUrl.toString(), {
      method: "POST",
    });
    
    const data = await googleResponse.json();
    return response.status(200).json(data);
    
  } catch (error) {
    return response.status(500).json({ error: error.message });
  }
}
