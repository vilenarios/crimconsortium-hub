export function generateRouter() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CrimConsortium - Loading...</title>
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #ffffff;
      color: #000000;
    }
    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      font-size: 1.2rem;
      color: #666;
    }
    .error {
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      text-align: center;
      padding: 2rem;
    }
    .error h1 {
      font-size: 3rem;
      margin-bottom: 1rem;
    }
    .error p {
      font-size: 1.2rem;
      color: #666;
      margin-bottom: 2rem;
    }
    .error a {
      color: #ff6b35;
      text-decoration: none;
      font-weight: 600;
      font-size: 1.1rem;
    }
    .error a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="loading" id="loading">Loading...</div>
  <div class="error" id="error">
    <h1>404</h1>
    <p>Page not found</p>
    <a href="/">Return to Homepage</a>
  </div>

  <script>
    (async function() {
      // Get the requested path
      var path = window.location.pathname;

      // Remove trailing slash
      path = path.replace(/\\/$/, '');

      // Map clean URLs to their actual HTML files
      var routeMap = {
        '': '/index.html',
        '/': '/index.html',
        '/members': '/members/index.html',
        '/articles': '/articles/index.html'
      };

      // Check for member pages (e.g., /members/university-name)
      if (path.startsWith('/members/') && path.split('/').length === 3) {
        routeMap[path] = path + '/index.html';
      }

      // Check for article pages (e.g., /articles/article-id)
      if (path.startsWith('/articles/') && path.split('/').length === 3) {
        routeMap[path] = path + '/index.html';
      }

      // Get the actual file path
      var actualPath = routeMap[path] || path;

      // If it's already an HTML file or has an extension, leave it
      if (!actualPath.endsWith('.html') && !actualPath.includes('.')) {
        // Try adding index.html for directory-like paths
        actualPath = actualPath + '/index.html';
      }

      try {
        // Fetch the actual content
        var response = await fetch(actualPath);

        if (response.ok) {
          var html = await response.text();

          // Parse the HTML to extract title
          var parser = new DOMParser();
          var doc = parser.parseFromString(html, 'text/html');
          var title = doc.querySelector('title');
          if (title) {
            document.title = title.textContent;
          }

          // Replace the entire document with the fetched content
          document.open();
          document.write(html);
          document.close();

          // Update the URL in the browser without redirecting
          if (window.history && window.history.replaceState) {
            window.history.replaceState({}, '', path);
          }
        } else {
          // Show 404 error
          document.getElementById('loading').style.display = 'none';
          document.getElementById('error').style.display = 'flex';
        }
      } catch (error) {
        console.error('Router error:', error);
        // Show error page
        document.getElementById('loading').style.display = 'none';
        document.getElementById('error').style.display = 'flex';
      }
    })();
  </script>
</body>
</html>`;
}