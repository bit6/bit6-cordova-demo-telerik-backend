var app = {
    // Application Constructor
    initialize: function() {
        this.bindEvents();
    },
    // Bind Event Listeners
    //
    // Bind any events that are required on startup. Common events are:
    // 'load', 'deviceready', 'offline', and 'online'.
    bindEvents: function() {
        document.addEventListener('deviceready', this.onDeviceReady, false);
    },
    onDeviceReady: function() {
        // Fix for iOS status bar overlap
        if (typeof StatusBar != "undefined") {
             StatusBar.overlaysWebView(false);
             StatusBar.styleDefault();
        }
        // Init Bit6 SDK
        var opts = {'apikey': ''};
        var b6 = Bit6.init(opts);
        // Init Telerik SDK
        var el = new Everlive({
            apiKey: '',
            scheme: 'https'
        });
        // Prepare the app
        initApp(b6, el);
    }
};

app.initialize();