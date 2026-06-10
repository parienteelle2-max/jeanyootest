export default async function handler(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send('No authorization code provided');
  }

  const host = req.headers.host;
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const redirectUri = `${protocol}://${host}/api/callback`;

  try {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const data = await response.json();

    if (data.error) {
      return res.status(400).send(`OAuth Error: ${data.error_description || data.error}`);
    }

    const token = data.access_token;

    // Send the postMessage response to the opener window (Decap CMS)
    const script = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authenticated</title>
      </head>
      <body>
        <p>Completing authentication...</p>
        <script>
          const token = "${token}";
          const provider = "github";
          
          if (window.opener) {
            window.opener.postMessage(
              JSON.stringify({
                authorizing: false,
                token: token,
                provider: provider
              }),
              window.location.origin
            );
            window.close();
          } else {
            document.body.innerHTML = "<p>Authentication successful! You can close this window.</p>";
          }
        </script>
      </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(script);
  } catch (error) {
    console.error('OAuth Callback Error:', error);
    res.status(500).send('Authentication failed');
  }
}
