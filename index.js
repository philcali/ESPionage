/**
 * Global config variables...
 */
var wifi = require('Wifi')
  , http = require('http')
  , WIFI_SSID = 'ESP'
  , WIFI_OPTIONS = { authMode: 'open' }
  , RELAY_PIN = NodeMCU.D7;

function RequestBinding(request) {
  this.url = url.parse(request.url, true);
  this.method = request.method;
  this.headers = request.headers;
}

RequestBinding.prototype.getUrl = function() {
  return this.url;
};

RequestBinding.prototype.getMethod = function() {
  return this.method;
};

RequestBinding.prototype.getHeaders = function() {
  return this.headers;
};

function Route(method, path, callback) {
  this.method = method;
  this.path = path;
  this.callback = callback;
}

Route.prototype.filter = function(binding) {
  return (
    this.method == binding.getMethod() &&
    binding.getUrl().pathname == this.path
  );
};

Route.prototype.process = function(binding, res) {
  this.callback(binding, res);
};

function Application() {
  this.pipeline = [];
  this.notFound = function(res) {
    res.writeHead(404, { "Content-Type", "text/plain" });
    res.end("Not Found.");
  };
}

Application.prototype.method = function(method, path, callback) {
  this.pipeline.push(new Route(method.toUpperCase(), path, callback));
  return this;
};

['get', 'post', 'put', 'delete', 'options', 'head', 'purge'].forEach(function(method) {
  Application.prototype[method] = function(path, callback) {
    return this.method(method.toUpperCase(), path, callback);
  };
});

Application.prototype.route = function(req, res) {
  var binding = new RequestBinding(req)
    , sent = false;
  this.pipeline.forEach(function(route) {
    if (!sent && route.filter(binding)) {
      route.process(binding, res);
      sent = true;
    }
  });
  if (!sent) {
    this.notFound(res);
  }
};

Application.prototype.listen = function(port) {
  return http.createServer(this.route.bind(this)).listen(port);
};

E.on('init', function() {
  var currentPulse = HIGH
    , app = new Application();

  app.get('/', function(req, res) {
    var scriptTag = (function() {
      var toggle = document.getElementById('toggle');
      toggle.addEventListener('click', function() {
        toggle.innerText = toggle.innerText == 'Start' ? 'Stop' : 'Start';
        fetch('/toggle', { method: 'GET' })
          .then(function(resp) { console.log('Toggled!'); })
          .catch(function(error) { console.log('Error!'); });
      }, true);
    }).toString();
    res.writeHead(200, { "Content-Type": "text/html" });
    res.write("<!DOCTYPE html>\n");
    res.write("<html><head><meta name='viewport' content='width=device-width, initial-scale=1.0'><title>Relay ESP</title>");
    res.write("<style>body { background: black; font-family: sans-serif; } a { border: solid 2px #aaa; color: #fff; background-color: #ccc; padding:");
    res.write("5px 60px; border-radius: 5px;font-weight: bold; width: 90%; border: solid 1px #ccc; }</style></head><body>");
    res.write("<div style='text-align: center; margin-top: 20px;'><a id='toggle'>Start</a><script>(" + scriptTag +")();</script></div>");
    res.end("</body></html>");
  });

  app.get('/toggle', function(req, res) {
    digitalWrite(RELAY_PIN, currentPulse);
    currentPulse = currentPulse == HIGH ? LOW : HIGH;
    res.writeHead(204);
    res.end();
  });

  console.log('Initializing...');
  wifi.startAP(WIFI_SSID, WIFI_OPTIONS, function(err) {
    if (err) console.log(err); else {
      console.log('Access Point started');
      app.listen(80);
      console.log('Relay server started');
      pinMode(RELAY_PIN, 'output');
      console.log('Relay pin is ready for control');
    }
  });
});
