Bit6 Demo App for Telerik AppBuilder
------------------------------------
Demo for [Bit6 Cordova Plugin](https://github.com/Telerik-Verified-Plugins/Bit6). Users can make voice/video calls and send messages.

<a href="https://platform.telerik.com/#appbuilder/clone/https%3A%2F%2Fgithub.com%2Fbit6%2Fbit6-cordova-demo-telerik-backend.git" target="_blank"><img src="http://docs.telerik.com/platform/appbuilder/sample-apps/images/try-in-appbuilder.png" alt="Try in AppBuilder" title="Try in AppBuilder" /></a>

### Prerequisites
* Get the API Key at [Bit6 Dashboard](https://dashboard.bit6.com).

### Installation
* Create a new AppBuilder project by cloning this repo.

### Configuration
1. Set [App ID](http://docs.telerik.com/platform/appbuilder/code-signing-your-app/code-sign-glossary#application-identifier) for your app: `Project Navigator > Properties > General`

2. Specify your Bit6 API Key in [js/index.js](Bit6%20Demo%20App/js/index.js#L19)
  ```js
  {'apikey': 'yourApiKey'}
  ```

3. [Configure](https://github.com/bit6/bit6-cordova#push-notifications) push notification support.

### Running the app
Build and deploy to an iOS or Android device.
