// bit6 - v0.9.6

(function() {
  var slice = [].slice;

  window.bit6 || (window.bit6 = {});

  bit6.EventEmitter = (function() {
    function EventEmitter() {
      this.events = {};
    }

    EventEmitter.prototype.emit = function() {
      var args, event, i, len, listener, ref;
      event = arguments[0], args = 2 <= arguments.length ? slice.call(arguments, 1) : [];
      if (!this.events[event]) {
        return false;
      }
      ref = this.events[event];
      for (i = 0, len = ref.length; i < len; i++) {
        listener = ref[i];
        listener.apply(null, args);
      }
      return true;
    };

    EventEmitter.prototype.addListener = function(event, listener) {
      var base;
      this.emit('newListener', event, listener);
      ((base = this.events)[event] != null ? base[event] : base[event] = []).push(listener);
      return this;
    };

    EventEmitter.prototype.on = EventEmitter.prototype.addListener;

    EventEmitter.prototype.once = function(event, listener) {
      var fn;
      fn = (function(_this) {
        return function() {
          _this.removeListener(event, fn);
          return listener.apply(null, arguments);
        };
      })(this);
      this.on(event, fn);
      return this;
    };

    EventEmitter.prototype.removeListener = function(event, listener) {
      var l;
      if (!this.events[event]) {
        return this;
      }
      this.events[event] = (function() {
        var i, len, ref, results;
        ref = this.events[event];
        results = [];
        for (i = 0, len = ref.length; i < len; i++) {
          l = ref[i];
          if (l !== listener) {
            results.push(l);
          }
        }
        return results;
      }).call(this);
      return this;
    };

    EventEmitter.prototype.off = EventEmitter.prototype.removeListener;

    EventEmitter.prototype.removeAllListeners = function(event) {
      delete this.events[event];
      return this;
    };

    return EventEmitter;

  })();

}).call(this);

(function() {
  bit6.Conversation = (function() {
    function Conversation(id) {
      this.id = id;
      this.unread = 0;
      this.updated = 0;
      this.messages = [];
      this.modified = true;
      this.uri = this.id;
    }

    Conversation.prototype.getUnreadCount = function() {
      return this.unread;
    };

    Conversation.prototype.getLastMessage = function() {
      var n;
      n = this.messages.length;
      if (n > 0) {
        return this.messages[n - 1];
      } else {
        return null;
      }
    };

    Conversation.prototype.appendMessage = function(m) {
      this.messages.push(m);
      if (this.updated < m.created) {
        this.updated = m.created;
      }
      this._updateUnreadCount();
      this.modified = true;
      return this.modified;
    };

    Conversation.prototype.updateMessage = function(m) {
      this._updateUnreadCount();
      return this.modified;
    };

    Conversation.prototype.removeMessage = function(m) {
      var i, idx, j, len, n, o, ref, removed;
      n = this.messages.length;
      if (n > 0 && this.messages[n - 1].id === m.id) {
        this.modified = true;
      }
      idx = -1;
      ref = this.messages;
      for (i = j = 0, len = ref.length; j < len; i = ++j) {
        o = ref[i];
        if (o.id === m.id) {
          idx = i;
          break;
        }
      }
      if (idx >= 0) {
        removed = this.messages.splice(idx, 1);
      }
      this._updateUnreadCount();
      return this.modified;
    };

    Conversation.prototype._updateUnreadCount = function() {
      var j, len, m, num, ref;
      num = 0;
      ref = this.messages;
      for (j = 0, len = ref.length; j < len; j++) {
        m = ref[j];
        if (m.canMarkRead()) {
          num++;
        }
      }
      this.modified || (this.modified = num !== this.unread);
      return this.unread = num;
    };

    Conversation.prototype.domId = function() {
      if (!this.id) {
        console.log('ConvId is null', this);
        return null;
      }
      return this.id.replace(':', '--').replace('.', '_-').replace('+', '-_');
    };

    Conversation.fromDomId = function(t) {
      if (!t) {
        return t;
      }
      return t.replace('--', ':').replace('_-', '.').replace('-_', '+');
    };

    return Conversation;

  })();

}).call(this);

(function() {
  var extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  bit6.Dialog = (function(superClass) {
    extend(Dialog, superClass);

    function Dialog(client, outgoing, other, options) {
      var myaddr;
      this.client = client;
      this.outgoing = outgoing;
      this.other = other;
      this.options = options;
      Dialog.__super__.constructor.apply(this, arguments);
      this.me = this.client.session.identity;
      this.params = {
        useVideo: this.options.video,
        useStereo: false,
        tag: 'webcam',
        callID: null
      };
      myaddr = 'uid:' + this.client.session.userid + '@' + this.client.apikey;
      if (this.outgoing) {
        this.state = 'req';
        this.params.destination_number = this.other + '@' + this.client.apikey;
        this.params.caller_id_name = this.me;
        this.params.caller_id_number = myaddr;
        this.params.callID = bit6.JsonRpc.generateGUID();
      } else {
        this.state = 'pre-answer';
        this.params.callee_id_name = this.me;
        this.params.callee_id_number = myaddr;
      }
      this.transfers = [];
    }

    Dialog.prototype.connect = function(opts) {
      var i, k, len, ref, ref1;
      if (opts == null) {
        opts = {};
      }
      if (!this.options.audio && !this.options.video) {
        this._onMediaReady();
        return true;
      }
      if (this.options.video) {
        if (!(opts.containerEl || (opts.localMediaEl && opts.remoteMediaEl))) {
          this.emit('error', 'Need container or specific video elements');
          return this.hangup();
        }
      }
      ref = ['containerEl', 'localMediaEl', 'remoteMediaEl'];
      for (i = 0, len = ref.length; i < len; i++) {
        k = ref[i];
        this.options[k] = (ref1 = opts[k]) != null ? ref1 : null;
      }
      console.log('Dialog - calling ensure media', this);
      this.client._ensureRtcMedia(this.options, 1, (function(_this) {
        return function(ok) {
          console.log('Dialog - media available: ok=', ok, 'd=', _this);
          if (!ok) {
            _this.emit('error', 'Unable to start media');
            return _this.hangup();
          }
          _this._onMediaReady();
          if (_this.options.video) {
            return _this.emit('videos');
          }
        };
      })(this));
      return true;
    };

    Dialog.prototype._onMediaReady = function() {
      var iceServers;
      if (!this.outgoing) {
        this._sendAcceptRejectIncomingCall(true);
      }
      this.emit('progress');
      this.rtc = this.client._createRtc();
      this.rtc.on('offerAnswer', (function(_this) {
        return function(offerAnswer) {
          return _this._sendOfferAnswer(offerAnswer, function(err, result) {
            if (offerAnswer.type === 'answer') {
              return _this.emit('answer');
            }
          });
        };
      })(this));
      this.rtc.on('videos', (function(_this) {
        return function() {
          return _this.emit('videos');
        };
      })(this));
      this.rtc.on('dcOpen', (function(_this) {
        return function() {
          return _this._startNextPendingTransfer();
        };
      })(this));
      this.rtc.on('transfer', (function(_this) {
        return function(tr) {
          _this.emit('transfer', tr);
          if (tr.err) {

          } else if (tr.completed() && tr.outgoing) {
            return _this._startNextPendingTransfer();
          }
        };
      })(this));
      iceServers = this.client.session.config.rtc.iceServers;
      this.rtc.init(this.client.media, this.outgoing, iceServers, this.options);
      return this.rtc.start();
    };

    Dialog.prototype._startNextPendingTransfer = function() {
      var i, len, ref, results, t;
      ref = this.transfers;
      results = [];
      for (i = 0, len = ref.length; i < len; i++) {
        t = ref[i];
        if (t.pending()) {
          this.rtc.startOutgoingTransfer(t);
          break;
        } else {
          results.push(void 0);
        }
      }
      return results;
    };

    Dialog.prototype.sendFile = function(info, data) {
      var tr;
      tr = new bit6.Transfer(true, info, data);
      this.transfers.push(tr);
      return tr._ensureSourceData((function(_this) {
        return function() {
          if (tr.err != null) {
            _this.emit('transfer', tr);
          }
          if (tr.data != null) {
            return _this.rtc.startOutgoingTransfer(tr);
          }
        };
      })(this));
    };

    Dialog.prototype.hangup = function() {
      if (this.rtc) {
        this.rtc.stop();
        this.rtc = null;
        this.client._ensureRtcMedia(null, -1);
        this._sendHangupCall();
        if (this.options.video) {
          this.emit('videos');
        }
      } else if (!this.outgoing) {
        this._sendAcceptRejectIncomingCall(false);
      }
      return this.emit('end');
    };

    Dialog.prototype._sendOfferAnswer = function(offerAnswer, cb) {
      var msg, ref, ref1;
      msg = offerAnswer;
      if (msg.type === 'offer') {
        this.state = 'sent-offer';
        msg.dialogParams = this.params;
        return (ref = this.client.rpc) != null ? ref.call('verto.invite', msg, cb) : void 0;
      } else if (msg.type === 'answer') {
        this.state = 'sent-answer';
        this.params.wantVideo = this.options.video;
        msg.dialogParams = this.params;
        return (ref1 = this.client.rpc) != null ? ref1.call('verto.answer', msg, cb) : void 0;
      }
    };

    Dialog.prototype._sendAcceptRejectIncomingCall = function(accept) {
      var type;
      type = accept ? 'accept' : 'reject';
      return this.client._sendNotification(this.rdest, type);
    };

    Dialog.prototype._sendHangupCall = function() {
      var msg, ref;
      this.state = 'sent-bye';
      msg = {
        dialogParams: this.params
      };
      return (ref = this.client.rpc) != null ? ref.call('verto.bye', msg, (function(_this) {
        return function(err, result) {};
      })(this)) : void 0;
    };

    Dialog.prototype.handleRpcCall = function(method, params) {
      switch (method) {
        case 'verto.bye':
          return this._gotHangup(params);
        case 'verto.invite':
          this.params.callID = params.callID;
          this.params.caller_id_name = params.caller_id_name;
          this.params.caller_id_number = params.caller_id_number;
          return this._gotRemoteOfferAnswer('offer', params);
        case 'verto.answer':
          this._gotRemoteOfferAnswer('answer', params);
          return this.emit('answer');
      }
    };

    Dialog.prototype._gotRemoteOfferAnswer = function(type, offerAnswer) {
      this.state = 'got-' + type;
      offerAnswer.type = type;
      if (this.rtc != null) {
        return this.rtc.gotRemoteOfferAnswer(offerAnswer);
      } else {
        return console.log('Error: RTC not inited');
      }
    };

    Dialog.prototype._gotHangup = function(d) {
      this.state = 'got-bye';
      if (this.rtc != null) {
        this.rtc.stop();
        this.rtc = null;
        this.client._ensureRtcMedia(null, -1);
        if (this.options.video) {
          this.emit('videos');
        }
        return this.emit('end');
      }
    };

    return Dialog;

  })(bit6.EventEmitter);

}).call(this);

(function() {
  bit6.Group = (function() {
    function Group(id) {
      this.id = id;
      this.meta = null;
      this.permissions = null;
      this.members = [];
      this.updated = 0;
    }

    Group.prototype.update = function(o) {
      var k, v;
      if (o.updated == null) {
        return false;
      }
      if (this.updated === o.updated) {
        if (JSON.stringify(this.meta) === JSON.stringify(o != null ? o.meta : void 0)) {
          if (JSON.stringify(this.permissions) === JSON.stringify(o != null ? o.permissions : void 0)) {
            if (JSON.stringify(this.members) === JSON.stringify(o != null ? o.members : void 0)) {
              return false;
            }
          }
        }
      }
      for (k in o) {
        v = o[k];
        this[k] = v;
      }
      return true;
    };

    Group.prototype._updateMemberProfile = function(ident, profile) {
      var i, len, m, ref;
      ref = this.members;
      for (i = 0, len = ref.length; i < len; i++) {
        m = ref[i];
        if (m.id === ident) {
          m.profile = profile;
          return true;
        }
      }
      return false;
    };

    return Group;

  })();

}).call(this);

(function() {
  bit6.JsonRpc = (function() {
    JsonRpc.prototype.reconnectDelay = 2000;

    function JsonRpc(options) {
      var base;
      this.options = options;
      if ((base = this.options).sessid == null) {
        base.sessid = bit6.JsonRpc.generateGUID();
      }
      this.currentId = 1;
      this.callbacks = {};
      this.queue = [];
      this.closed = false;
    }

    JsonRpc.prototype.connect = function() {
      this.closed = false;
      if (this.ws != null) {
        return;
      }
      this.ws = new WebSocket(this.options.wsUrl);
      this.ws.onopen = (function(_this) {
        return function() {
          var i, len, m, ref;
          if (_this.queue.length > 0) {
            ref = _this.queue;
            for (i = 0, len = ref.length; i < len; i++) {
              m = ref[i];
              _this.ws.send(m);
            }
            return _this.queue = [];
          } else {
            return _this.call('login', {}, function(err, result) {
              return console.log('rpc login err=', err, 'result=', result);
            });
          }
        };
      })(this);
      this.ws.onmessage = (function(_this) {
        return function(e) {
          var cb, error, ex, m;
          try {
            m = JSON.parse(e.data);
            if ((m.result != null) || (m.error != null)) {
              if (m.id != null) {
                cb = _this.callbacks[m.id];
                delete _this.callbacks[m.id];
                cb(m.error, m.result);
              }
            }
            if ((m.method != null) && (m.params != null)) {
              if (m.id != null) {
                return _this.options.onRpcCall(m.method, m.params, function(err, result) {
                  var t;
                  t = {
                    jsonrpc: '2.0',
                    id: m.id
                  };
                  if (err != null) {
                    t.error = err;
                  }
                  if (result != null) {
                    t.result = result;
                  }
                  return _this._send(t);
                });
              } else {
                return _this.options.onRpcCall(m.method, m.params);
              }
            }
          } catch (error) {
            ex = error;
            console.log('Exception parsing JSON response ', ex);
            return console.log('  -- RAW {{{', e.data, '}}}');
          }
        };
      })(this);
      this.ws.onclose = (function(_this) {
        return function() {
          if (_this.closed) {
            return;
          }
          _this.ws = null;
          _this.queue = [];
          return setTimeout(function() {
            return _this.connect();
          }, _this.reconnectDelay);
        };
      })(this);
      return this.ws.onerror = (function(_this) {
        return function() {
          return console.log('Rpc ws got error. Socket state=' + _this.ws.readyState);
        };
      })(this);
    };

    JsonRpc.prototype.notify = function(m, params) {
      return this.call(m, params, false);
    };

    JsonRpc.prototype.call = function(m, params, cb) {
      var req;
      if (this.ws == null) {
        this.connect();
      }
      req = {
        jsonrpc: '2.0',
        method: m,
        params: params
      };
      req.params.login = this.options.login;
      req.params.passwd = this.options.password;
      if (this.options.sessid != null) {
        req.params.sessid = this.options.sessid;
      }
      if (cb !== false) {
        req.id = this.currentId++;
        this.callbacks[req.id] = cb;
      }
      return this._send(req);
    };

    JsonRpc.prototype._send = function(req) {
      var data;
      data = JSON.stringify(req);
      if ((this.ws != null) && this.ws.readyState === 1) {
        return this.ws.send(data);
      } else {
        return this.queue.push(data);
      }
    };

    JsonRpc.prototype.close = function() {
      this.closed = true;
      if (this.ws != null) {
        this.ws.close();
      }
      return this.ws = null;
    };

    JsonRpc.generateGUID = function() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r, v;
        r = Math.random() * 16 | 0;
        v = c === 'x' ? r : r & 0x3 | 0x8;
        return v.toString(16);
      });
    };

    return JsonRpc;

  })();

}).call(this);

(function() {
  var extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty,
    slice = [].slice;

  bit6.Client = (function(superClass) {
    var endpoints;

    extend(Client, superClass);

    Client.version = '0.9.6';

    endpoints = {
      prod: 'https://api.bit6.com',
      dev: 'https://api.b6dev.net',
      local: 'http://127.0.0.1:3000'
    };

    function Client(opts) {
      var hasWebRTC, ref;
      Client.__super__.constructor.apply(this, arguments);
      if ((opts != null ? opts.apikey : void 0) == null) {
        throw 'Missing required "apikey" option';
      }
      this.apikey = opts.apikey;
      this.env = (ref = opts.env) != null ? ref : 'prod';
      hasWebRTC = (window.RTCPeerConnection != null) || (window.mozRTCPeerConnection != null) || (window.webkitRTCPeerConnection != null);
      this.caps = {
        audio: hasWebRTC,
        video: hasWebRTC,
        websocket: typeof WebSocket !== "undefined" && WebSocket !== null,
        attachment: (typeof Blob !== "undefined" && Blob !== null) && (typeof FormData !== "undefined" && FormData !== null) && (typeof FileReader !== "undefined" && FileReader !== null)
      };
      this._clear();
      this.session = new bit6.Session(this);
    }

    Client.prototype._clear = function() {
      this.lastSince = 0;
      this.me = {};
      this.messages = {};
      this.conversations = {};
      this.groups = {};
      this.presence = {};
      this.lastTypingSent = 0;
      this.media = null;
      return this.dialogs = [];
    };

    Client.prototype._onLogin = function(cb) {
      this._connectRt();
      return this._loadMe((function(_this) {
        return function(err) {
          var g, id, ref;
          ref = _this.groups;
          for (id in ref) {
            g = ref[id];
            g.updated = 0;
            _this._loadGroupWithMembers(id);
          }
          return cb(null);
        };
      })(this));
    };

    Client.prototype._onLogout = function(cb) {
      this._disconnectRt();
      this._clear();
      if (cb != null) {
        return cb(null);
      }
    };

    Client.prototype._loadMe = function(cb) {
      var data;
      data = {
        embed: 'devices,identities,groups,messages',
        since: this.lastSince
      };
      return this.api('/me', data, (function(_this) {
        return function(err, result, headers) {
          var i, k, len, ref, ref1;
          if (err) {
            return cb(err);
          }
          console.log('LoadMe got', result, headers);
          _this.lastSince = (ref = headers != null ? headers.etag : void 0) != null ? ref : 0;
          ref1 = ['devices', 'identities', 'data', 'profile'];
          for (i = 0, len = ref1.length; i < len; i++) {
            k = ref1[i];
            if (result[k] != null) {
              _this.me[k] = result[k];
            }
          }
          if (result.groups != null) {
            _this._processGroupInfos(result.groups);
          }
          _this._processMessages(result.messages);
          return cb();
        };
      })(this));
    };

    Client.prototype.setPrivateData = function(o, cb) {
      return this._setDataOrProfile('data', o, cb);
    };

    Client.prototype.setPublicProfile = function(o, cb) {
      return this._setDataOrProfile('profile', o, cb);
    };

    Client.prototype._setDataOrProfile = function(name, o, cb) {
      var old, ref;
      old = (ref = this.me[name]) != null ? ref : null;
      this.me[name] = o;
      return this.api('/me/' + name, 'POST', o, (function(_this) {
        return function(err, x) {
          if (err) {
            delete _this.me[name];
            if (old) {
              _this.me[name] = old;
            }
          } else {
            _this.me[name] = x;
          }
          return typeof cb === "function" ? cb(err, x) : void 0;
        };
      })(this));
    };

    Client.prototype.getConversation = function(uri) {
      var ref;
      return (ref = this.conversations[uri]) != null ? ref : null;
    };

    Client.prototype.getConversationByUri = function(uri) {
      var ref;
      return (ref = this.conversations[uri]) != null ? ref : null;
    };

    Client.prototype.getSortedConversations = function() {
      var cc;
      cc = this.conversations;
      return Object.keys(cc).sort(function(a, b) {
        return cc[b].updated - cc[a].updated;
      }).map(function(sortedKey) {
        return cc[sortedKey];
      });
    };

    Client.prototype.addEmptyConversation = function(uri) {
      var conv, convId, ref;
      convId = uri;
      conv = (ref = this.conversations[convId]) != null ? ref : null;
      if (!conv) {
        conv = new bit6.Conversation(convId);
        this.conversations[convId] = conv;
        conv.updated = Date.now();
        this.emit('conversation', conv, 1);
      }
      return conv;
    };

    Client.prototype.deleteConversation = function(conv, cb) {
      var other;
      conv = (conv != null ? conv.id : void 0) ? conv : this.getConversation(conv);
      other = encodeURIComponent(conv.id);
      return this.api('/me/messages?other=' + other, 'DELETE', (function(_this) {
        return function(err, result) {
          var i, len, m, msgs;
          if (err) {
            return typeof cb === "function" ? cb(err) : void 0;
          }
          msgs = conv.messages.slice();
          for (i = 0, len = msgs.length; i < len; i++) {
            m = msgs[i];
            m.deleted = Date.now();
            _this._processMessage(m, true);
          }
          delete _this.conversations[conv.id];
          conv.deleted = Date.now();
          _this.emit('conversation', conv, -1);
          return typeof cb === "function" ? cb(null) : void 0;
        };
      })(this));
    };

    Client.prototype.markConversationAsRead = function(conv) {
      var i, len, m, num, other, ref;
      num = 0;
      if (!(conv != null ? conv.messages : void 0)) {
        return num;
      }
      ref = conv.messages;
      for (i = 0, len = ref.length; i < len; i++) {
        m = ref[i];
        if (!m.canMarkRead()) {
          continue;
        }
        m.status(bit6.Message.READ);
        console.log('Msg to be marked: ', m);
        this._processMessage(m);
        num++;
      }
      if (num === 0) {
        return;
      }
      other = encodeURIComponent(conv.uri);
      this.api('/me/messages?other=' + other, 'PUT', {
        status: 'read'
      }, function(err, result) {
        return console.log('markAsRead result=', result);
      });
      return num;
    };

    Client.prototype.compose = function(dest) {
      var m;
      m = new bit6.Outgoing(this);
      if (dest != null) {
        m.to(dest);
      }
      return m;
    };

    Client.prototype._failOutgoingMessage = function(m) {
      m.status(bit6.Message.FAILED);
      return this._processMessage(m);
    };

    Client.prototype._sendMessagePost = function(m, cb) {
      var tmpId;
      tmpId = m.id;
      return this.api('/me/messages', 'POST', m._export(), (function(_this) {
        return function(err, o) {
          var tmp;
          if (err) {
            _this._failOutgoingMessage(m);
            return typeof cb === "function" ? cb(err) : void 0;
          } else {
            console.log('Msg after POST', o);
            _this._processMessage(o);
            tmp = {
              id: tmpId,
              deleted: Date.now()
            };
            _this._processMessage(tmp);
            return typeof cb === "function" ? cb(null, _this.messages[o.id]) : void 0;
          }
        };
      })(this));
    };

    Client.prototype.markMessageAsRead = function(m) {
      if (!m.canMarkRead()) {
        return false;
      }
      m.status(bit6.Message.READ);
      console.log('Msg to be marked: ', m);
      this._processMessage(m);
      this.api('/me/messages/' + m.id, 'PUT', {
        status: 'read'
      }, function(err, result) {
        return console.log('markAsRead result=', result);
      });
      return true;
    };

    Client.prototype.deleteMessage = function(m, cb) {
      m = (m != null ? m.id : void 0) ? m : this.messages[m];
      return this.api('/me/messages/' + m.id, 'DELETE', (function(_this) {
        return function(err, result) {
          if (err) {
            return typeof cb === "function" ? cb(err) : void 0;
          }
          m.deleted = Date.now();
          _this._processMessage(m);
          return typeof cb === "function" ? cb(null) : void 0;
        };
      })(this));
    };

    Client.prototype._processMessages = function(messages) {
      var c, i, id, len, o, ref, results;
      if (!messages) {
        return;
      }
      for (i = 0, len = messages.length; i < len; i++) {
        o = messages[i];
        this._processMessage(o, true);
      }
      ref = this.conversations;
      results = [];
      for (id in ref) {
        c = ref[id];
        if (c.modified) {
          c.modified = false;
          results.push(this.emit('conversation', c, 0));
        } else {
          results.push(void 0);
        }
      }
      return results;
    };

    Client.prototype._processMessage = function(o, noConvUpdateEvents) {
      var conv, convId, m, oldConv, op, ref, ref1;
      m = (ref = this.messages[o.id]) != null ? ref : null;
      op = 0;
      if (!m) {
        if ((o != null ? o.deleted : void 0) > 0) {
          return null;
        }
        if (o instanceof bit6.Message) {
          m = o;
        } else {
          m = new bit6.Message(o);
        }
        this.messages[m.id] = m;
        op = 1;
      }
      convId = m.getConversationId();
      conv = oldConv = (ref1 = this.conversations[convId]) != null ? ref1 : null;
      if (!conv) {
        conv = new bit6.Conversation(convId);
        this.conversations[convId] = conv;
      }
      if (op > 0) {
        conv.appendMessage(m);
      } else {
        m.updateMessage(o);
        if ((o != null ? o.deleted : void 0) > 0) {
          delete this.messages[m.id];
          conv.removeMessage(m);
          op = -1;
        } else {
          conv.updateMessage(m);
        }
      }
      if (!oldConv) {
        conv.modified = false;
        this.emit('conversation', conv, 1);
      }
      this.emit('message', m, op);
      if (conv.modified && !noConvUpdateEvents) {
        conv.modified = false;
        this.emit('conversation', conv, 0);
      }
      return m;
    };

    Client.prototype.getGroup = function(id) {
      var ref;
      if ((id != null ? id.indexOf('grp:') : void 0) === 0) {
        id = id.substring(4);
      }
      return (ref = this.groups[id]) != null ? ref : null;
    };

    Client.prototype.getGroupById = function(id) {
      return this.getGroup(id);
    };

    Client.prototype.createGroup = function(info, cb) {
      if (info == null) {
        info = {};
      }
      info.identity = this.session.identity;
      return this.api('/groups', 'POST', info, (function(_this) {
        return function(err, o) {
          if (err) {
            return cb(err);
          }
          return _this._loadMe(function(err) {
            if (err) {
              return cb(err);
            }
            return _this._loadGroupWithMembers(o.id, function(err) {
              if (err) {
                return cb(err);
              }
              return cb(null, _this.getGroup(o.id));
            });
          });
        };
      })(this));
    };

    Client.prototype.joinGroup = function(id, role, cb) {
      var g, memberInfo, ref;
      g = this.getGroup(id);
      if ((g != null ? (ref = g.me) != null ? ref.role : void 0 : void 0) === role) {
        return cb(null, g);
      }
      memberInfo = {
        id: this.session.identity,
        role: role
      };
      return this.api('/groups/' + id + '/members', 'POST', memberInfo, (function(_this) {
        return function(err, member) {
          if (err) {
            return cb(err);
          }
          console.log('Became group member grpId', id);
          return _this._loadMe(function(err) {
            if (err) {
              return cb(err);
            }
            return _this._loadGroupWithMembers(id, function(err) {
              if (err) {
                return cb(err);
              }
              return cb(null, _this.getGroup(id));
            });
          });
        };
      })(this));
    };

    Client.prototype.leaveGroup = function(id, cb) {
      var g;
      g = this.getGroup(id);
      if (g == null) {
        return cb(null);
      }
      delete this.groups[id];
      this.emit('group', g, -1);
      return this.api('/groups/' + id + '/members/me', 'DELETE', (function(_this) {
        return function(err, member) {
          if (err) {
            return cb(err);
          }
          console.log('Left group', id);
          return cb(null);
        };
      })(this));
    };

    Client.prototype._loadGroupWithMembers = function(id, cb) {
      return this.api('/groups/' + id, {
        embed: 'members'
      }, (function(_this) {
        return function(err, result) {
          console.log('Loaded group', id, 'with members: ', result, err);
          if (result) {
            _this._processGroupDeltas(result);
          }
          if (cb != null) {
            return cb(err, result);
          }
        };
      })(this));
    };

    Client.prototype._processGroupInfos = function(infos) {
      var g, i, id, info, len, me, o, op, ref, ref1, results, tmp;
      tmp = this.groups;
      this.groups = {};
      for (i = 0, len = infos.length; i < len; i++) {
        info = infos[i];
        me = {
          identity: info.identity,
          role: info.role
        };
        o = (ref = info != null ? info.group : void 0) != null ? ref : {
          id: info.id
        };
        o.me = me;
        op = 0;
        g = (ref1 = tmp[o.id]) != null ? ref1 : null;
        if (g == null) {
          g = new bit6.Group(o.id);
          op = 1;
        } else {
          delete tmp[o.id];
        }
        this.groups[g.id] = g;
        if (g.update(o)) {
          this.emit('group', g, op);
        }
      }
      results = [];
      for (id in tmp) {
        g = tmp[id];
        results.push(this.emit('group', g, -1));
      }
      return results;
    };

    Client.prototype._processGroupDeltas = function(o) {
      var g, op;
      op = 0;
      g = this.groups[o.id];
      if (g == null) {
        g = new bit6.Group(o.id);
        op = 1;
        this.groups[g.id] = g;
      }
      if (g.update(o)) {
        return this.emit('group', g, op);
      }
    };

    Client.prototype.sendTypingNotification = function(to) {
      var now;
      now = Date.now();
      if (now - this.lastTypingSent > 7000) {
        this.lastTypingSent = now;
        return this._sendNotification(to, 'typing');
      }
    };

    Client.prototype.sendNotification = function(to, type, data) {
      if ((type != null ? type.length : void 0) < 1 || type.charAt(0) === '_') {
        return false;
      }
      return this._sendNotification(to, '_' + type, data);
    };

    Client.prototype._sendNotification = function(to, type, data) {
      var m, msg, ref;
      msg = {
        type: type,
        from: this.session.identity
      };
      if (data != null) {
        msg.data = data;
      }
      m = {
        'to': to,
        'body': JSON.stringify(msg)
      };
      if ((ref = this.rpc) != null) {
        ref.call('verto.info', {
          msg: m
        }, (function(_this) {
          return function(err, result) {};
        })(this));
      }
      return true;
    };

    Client.prototype.startCall = function(other, opts) {
      return this._createDialog(true, other, opts);
    };

    Client.prototype.findDialogByCallID = function(callID) {
      var c, i, len, ref, ref1;
      ref = this.dialogs;
      for (i = 0, len = ref.length; i < len; i++) {
        c = ref[i];
        if (((ref1 = c.params) != null ? ref1.callID : void 0) === callID) {
          return c;
        }
      }
      return null;
    };

    Client.prototype.findDialogByOther = function(other) {
      var c, i, len, ref;
      ref = this.dialogs;
      for (i = 0, len = ref.length; i < len; i++) {
        c = ref[i];
        if (c.other === other) {
          return c;
        }
      }
      return null;
    };

    Client.prototype.findDialogByRdest = function(rdest) {
      var c, i, len, ref;
      ref = this.dialogs;
      for (i = 0, len = ref.length; i < len; i++) {
        c = ref[i];
        if (c.rdest === rdest) {
          return c;
        }
      }
      return null;
    };

    Client.prototype.deleteDialog = function(d) {
      var c, i, idx, len, ref;
      ref = this.dialogs;
      for (idx = i = 0, len = ref.length; i < len; idx = ++i) {
        c = ref[idx];
        if (c === d) {
          this.dialogs.splice(idx, 1);
          return;
        }
      }
    };

    Client.prototype._createDialog = function(outgoing, other, opts) {
      var c;
      c = this.findDialogByOther(other);
      if (c != null) {
        return null;
      }
      c = new bit6.Dialog(this, outgoing, other, opts);
      this.dialogs.push(c);
      c.on('error', (function(_this) {
        return function() {
          return console.log('Dialog error: ', c);
        };
      })(this));
      c.on('end', (function(_this) {
        return function() {
          console.log('Dialog end in Main: ', c);
          return _this.deleteDialog(c);
        };
      })(this));
      return c;
    };

    Client.prototype._createDeviceId = function() {
      return 'web-' + bit6.JsonRpc.generateGUID();
    };

    Client.prototype._createRtc = function() {
      return new bit6.Rtc();
    };

    Client.prototype._createRtcMedia = function() {
      return new bit6.RtcMedia();
    };

    Client.prototype._ensureRtcMedia = function(opts, delta, cb) {
      if (!this.media && delta > 0) {
        this.media = this._createRtcMedia();
        this.media.init(opts);
        this.media.start();
      }
      if (this.media) {
        this.media.counter += delta;
        if (this.media.counter > 0) {
          if (cb != null) {
            return this.media.check(cb);
          }
        } else {
          this.media.stop();
          this.media = null;
          if (cb != null) {
            return cb(true);
          }
        }
      }
    };

    Client.prototype.getNameFromIdentity = function(ident) {
      var g, r, ref, ref1, ref2, t;
      t = ident;
      if (t == null) {
        console.log('getNameFromId null', ident);
        return null;
      }
      r = ident.split(':');
      if (r.length !== 2) {
        return t;
      }
      switch (r[0]) {
        case 'usr':
          t = r[1];
          break;
        case 'grp':
          g = this.getGroup(ident);
          t = (ref = g != null ? (ref1 = g.group) != null ? (ref2 = ref1.meta) != null ? ref2.title : void 0 : void 0 : void 0) != null ? ref : t;
      }
      return t;
    };

    Client.prototype._handleRtMessage = function(m) {
      var g, gid, i, len, o, old, p, ref, ref1, ref2, ref3, ref4, ref5, ref6, ref7, ref8;
      switch (m.type) {
        case 'push':
          return this._handlePushRtMessage(m.data);
        case 'update':
          if (((ref = m.data) != null ? ref.messages : void 0) != null) {
            this._processMessages(m.data.messages);
          }
          if (((ref1 = m.data) != null ? (ref2 = ref1.groups) != null ? ref2.length : void 0 : void 0) > 0) {
            ref3 = m.data.groups;
            for (i = 0, len = ref3.length; i < len; i++) {
              o = ref3[i];
              this._loadGroupWithMembers(o.id);
            }
            return this._loadMe(function(err) {
              return console.log('LoadMe on Group update done', err);
            });
          }
          break;
        case 'presence':
          if ((m != null ? m.from : void 0) && ((m != null ? m.data : void 0) != null)) {
            old = this.presence[m.from];
            this.presence[m.from] = m.data;
            if (m.data.status == null) {
              this.presence[m.from].status = (ref4 = old != null ? old.status : void 0) != null ? ref4 : 'offline';
            }
            p = (ref5 = (ref6 = m.data) != null ? ref6.profile : void 0) != null ? ref5 : null;
            if (p && (this.groups != null)) {
              ref7 = this.groups;
              for (gid in ref7) {
                g = ref7[gid];
                if (g._updateMemberProfile(m.from, p)) {
                  this.emit('group', g, 0);
                }
              }
            }
            return this.emit('notification', m);
          }
          break;
        case 'typing':
          return this.emit('notification', m);
        default:
          if ((m != null ? (ref8 = m.type) != null ? ref8.length : void 0 : void 0) > 1 && m.type.charAt(0) === '_') {
            m.type = m.type.substring(1);
            return this.emit('notification', m);
          }
      }
    };

    Client.prototype._handlePushRtMessage = function(d) {
      var c, ch, mtype, opts;
      mtype = bit6.Message.typeFromFlags(d.flags);
      switch (mtype) {
        case bit6.Message.INC_CALL:
          ch = bit6.Message.channelFromFlags(d.flags);
          opts = {
            audio: (ch & bit6.Message.AUDIO) === bit6.Message.AUDIO,
            video: (ch & bit6.Message.VIDEO) === bit6.Message.VIDEO,
            data: (ch & bit6.Message.DATA) === bit6.Message.DATA
          };
          c = this._createDialog(false, d.sender, opts);
          c.rdest = d.rdest;
          return this.emit('incomingCall', c);
        case bit6.Message.MISSED_CALL:
          console.log('missed call from', d.sender, 'rdest=', d.rdest);
          c = this.findDialogByRdest(d.rdest);
          if (c != null) {
            return c.hangup();
          }
          break;
        case bit6.Message.ACCEPTED_CALL:
          return console.log('accepted call from', d.sender, 'rdest=', d.rdest);
        case bit6.Message.REJECTED_CALL:
          return console.log('rejected call from', d.sender, 'rdest=', d.rdest);
        case 0x0100:
        case 0x0200:
        case 0x0300:
        case 0x0400:
          return this._loadMe(function(err) {
            return console.log('LoadMsgDeltas on push done', err);
          });
        default:
          return console.log('Unknown push: ', d);
      }
    };

    Client.prototype._handleRpcNotify = function(method, params) {};

    Client.prototype._handleRpcCall = function(method, params, done) {
      var c, error, ex, ref, t, x;
      switch (method) {
        case 'verto.info':
          if ((params != null ? (ref = params.msg) != null ? ref.body : void 0 : void 0) != null) {
            try {
              x = JSON.parse(params.msg.body);
              this._handleRtMessage(x);
            } catch (error) {
              ex = error;
              console.log('Exception parsing JSON response verto.info', ex);
              console.log('  -- RAW {{{', params.msg.body, '}}}');
            }
          }
          break;
        case 'verto.bye':
          c = this.findDialogByCallID(params.callID);
          if (c) {
            c.handleRpcCall(method, params);
          }
          break;
        case 'verto.invite':
          t = params.caller_id_name;
          if (t) {
            t = t.split('@');
          }
          c = this.findDialogByOther(params.caller_id_name);
          if (c) {
            c.handleRpcCall(method, params);
          }
          break;
        case 'verto.answer':
          c = this.findDialogByCallID(params.callID);
          if (c) {
            c.handleRpcCall(method, params);
          }
      }
      return done(null, {
        'method': method
      });
    };

    Client.prototype._connectRt = function() {
      var opts, ref, ref1, s, servers;
      servers = (ref = this.session.config) != null ? (ref1 = ref.rtc) != null ? ref1.vertoServers : void 0 : void 0;
      if (servers.length < 1) {
        console.log('Error: no Verto servers');
        return;
      }
      s = servers[0];
      opts = {
        wsUrl: s.url,
        login: s.username,
        password: s.credential,
        onRpcCall: (function(_this) {
          return function(m, params, done) {
            return _this._handleRpcCall(m, params, done);
          };
        })(this),
        onRpcNotify: (function(_this) {
          return function(m, params) {
            return _this._handleRpcNotify(m, params);
          };
        })(this)
      };
      this.rpc = new bit6.JsonRpc(opts);
      return this.rpc.connect();
    };

    Client.prototype._disconnectRt = function() {
      var ref;
      if ((ref = this.rpc) != null) {
        ref.close();
      }
      return this.rpc = null;
    };

    Client.prototype.api = function() {
      var cb, i, params, path;
      path = arguments[0], params = 3 <= arguments.length ? slice.call(arguments, 1, i = arguments.length - 1) : (i = 1, []), cb = arguments[i++];
      return this._api.apply(this, ['/app/1' + path].concat(slice.call(params), [cb]));
    };

    Client.prototype._api = function() {
      var cb, data, i, m, params, path, url, xhr;
      path = arguments[0], params = 3 <= arguments.length ? slice.call(arguments, 1, i = arguments.length - 1) : (i = 1, []), cb = arguments[i++];
      if (params.length === 1) {
        if (typeof params[0] === 'string') {
          m = params[0];
        }
        if (typeof params[0] === 'object') {
          data = params[0];
        }
      } else if (params.length >= 2) {
        m = params[0], data = params[1];
      }
      if (m == null) {
        m = 'get';
      }
      if (data == null) {
        data = {};
      }
      m = m.toLowerCase();
      url = endpoints[this.env] + path;
      url += path.indexOf('?') < 0 ? '?' : '&';
      url += 'apikey=' + this.apikey;
      if (m !== 'post') {
        url += '&_method=' + m;
      }
      url += '&envelope=1';
      if (this.session.token) {
        data._auth = 'bearer ' + this.session.token;
      }
      xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.onreadystatechange = function() {
        var error, ex, r;
        if (xhr.readyState === 4) {
          r = null;
          try {
            r = JSON.parse(xhr.response);
          } catch (error) {
            ex = error;
            if (typeof cb === "function") {
              cb({
                'status': 501,
                'message': 'Cannot parse response',
                'data': xhr.response
              });
            }
            return;
          }
          if ((r != null ? r.status : void 0) == null) {
            if (typeof cb === "function") {
              cb({
                'status': 501,
                'message': 'Incorrect envelope',
                'data': xhr.response
              });
            }
            return;
          }
          if (xhr.status === 200 && r.status >= 200 && r.status < 300) {
            return typeof cb === "function" ? cb(null, r.response, r.headers) : void 0;
          } else {
            return typeof cb === "function" ? cb(r.response, null, r.headers) : void 0;
          }
        }
      };
      return xhr.send(JSON.stringify(data));
    };

    Client.prototype.urlencodeJsObject = function(obj, prefix) {
      var k, p, str, v;
      str = [];
      str = (function() {
        var results;
        results = [];
        for (p in obj) {
          v = obj[p];
          k = prefix ? prefix + '[' + p + ']' : p;
          if (typeof v === 'object') {
            results.push(this.urlencodeJsObject(v, k));
          } else {
            results.push(encodeURIComponent(k) + "=" + encodeURIComponent(v));
          }
        }
        return results;
      }).call(this);
      return str.join('&');
    };

    Client.normalizeIdentityUri = function(u) {
      var filter, k, matcher, pos, v;
      pos = u.indexOf(':');
      if (pos < 0) {
        return null;
      }
      k = u.substr(0, pos);
      k = k.trim().toLowerCase();
      v = u.substr(pos + 1);
      filter = matcher = null;
      switch (k) {
        case 'mailto':
          v = v.toLowerCase();
          filter = /[^a-z0-9._%+-@]/;
          matcher = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,8}$/;
          break;
        case 'grp':
          filter = /[\s]/;
          matcher = /[0-9a-zA-Z._]{22}/;
          break;
        case 'tel':
          filter = /[^\\d+]/;
          matcher = /^\+[1-9]{1}[0-9]{8,15}$/;
          break;
        case 'uid':
          v = v.toLowerCase();
          filter = /[^0-9a-f-]/;
          matcher = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
          break;
        case 'usr':
          v = v.toLowerCase();
          filter = /[^a-z0-9.]/;
          matcher = /^[a-z0-9.]+$/;
          break;
        default:
          filter = /[^a-zA-Z0-9._%+-@]/;
      }
      if (filter) {
        v = v.replace(filter, '');
      }
      if (v.search(matcher) < 0) {
        return null;
      }
      return k + ':' + v;
    };

    return Client;

  })(bit6.EventEmitter);

}).call(this);

(function() {
  bit6.Message = (function() {
    var CHANNEL_MASK, INCOMING, STATUS_MASK, TYPE_MASK, callStatusAsString, messageStatusAsString;

    INCOMING = 0x1000;

    STATUS_MASK = 0x000f;

    CHANNEL_MASK = 0x00f0;

    TYPE_MASK = 0x0f00;

    Message.DELETED = 0x0000;

    Message.SENDING = 0x0001;

    Message.SENT = 0x0002;

    Message.FAILED = 0x0003;

    Message.DELIVERED = 0x0004;

    Message.READ = 0x0005;

    Message.ANSWER = 0x0001;

    Message.MISSED = 0x0002;

    Message.NOANSWER = 0x0004;

    Message.SMS = 0x0010;

    Message.AUDIO = 0x0010;

    Message.VIDEO = 0x0080;

    Message.DATA = 0x0020;

    Message.TEXT = 0x0100;

    Message.ATTACH = 0x0200;

    Message.GEOLOC = 0x0300;

    Message.CUSTOM = 0x0400;

    Message.CALL = 0x0500;

    Message.INC_CALL = 0x0500;

    Message.MISSED_CALL = 0x0600;

    messageStatusAsString = {
      0x0001: 'Sending',
      0x0002: 'Sent',
      0x0003: 'Failed',
      0x0004: 'Delivered',
      0x0005: 'Read'
    };

    callStatusAsString = {
      0x0001: 'Answered',
      0x0002: 'Missed',
      0x0003: 'Failed',
      0x0004: 'No answer'
    };

    function Message(o) {
      this.id = null;
      this.me = null;
      this.other = null;
      this.flags = 0;
      if (o != null) {
        this.populate(o);
      }
    }

    Message.prototype.populate = function(o) {
      var j, k, len, ref, results;
      ref = ['id', 'flags', 'me', 'other', 'content', 'data', 'created', 'updated', 'deleted'];
      results = [];
      for (j = 0, len = ref.length; j < len; j++) {
        k = ref[j];
        if ((o != null ? o[k] : void 0) != null) {
          results.push(this[k] = o[k]);
        } else {
          results.push(void 0);
        }
      }
      return results;
    };

    Message.prototype.updateMessage = function(t) {
      if (t.deleted != null) {
        this.deleted = t.deleted;
      }
      if (t.flags) {
        this.flags = t.flags;
      }
      if (t.others == null) {
        return;
      }
      if (this.others != null) {
        return this._updateMessageOthers(this.others, t.others);
      } else {
        return this.others = t.others;
      }
    };

    Message.prototype._updateMessageOthers = function(old, others) {
      var i, idx, j, l, len, len1, o, ref, results, s, t;
      results = [];
      for (j = 0, len = others.length; j < len; j++) {
        t = others[j];
        idx = -1;
        for (i = l = 0, len1 = old.length; l < len1; i = ++l) {
          o = old[i];
          if (o.uri === t.uri) {
            idx = i;
            break;
          }
        }
        if (idx < 0) {
          results.push(old.push(t));
        } else {
          s = (ref = old[idx]) != null ? ref.status : void 0;
          if (!s || s < t.status) {
            results.push(old[idx].status = t.status);
          } else {
            results.push(void 0);
          }
        }
      }
      return results;
    };

    Message.prototype.incoming = function() {
      return (this.flags & INCOMING) !== 0;
    };

    Message.prototype.status = function(s) {
      if (s != null) {
        this.flags = (this.flags & (~STATUS_MASK)) | (s & STATUS_MASK);
      }
      return this.flags & STATUS_MASK;
    };

    Message.prototype.channel = function(s) {
      if (s != null) {
        this.flags = (this.flags & (~CHANNEL_MASK)) | (s & CHANNEL_MASK);
      }
      return this.flags & CHANNEL_MASK;
    };

    Message.prototype.type = function(s) {
      if (s != null) {
        this.flags = (this.flags & (~TYPE_MASK)) | (s & TYPE_MASK);
      }
      return this.flags & TYPE_MASK;
    };

    Message.prototype.isCall = function() {
      return (this.flags & TYPE_MASK) === Message.CALL;
    };

    Message.prototype.canMarkRead = function() {
      return this.incoming() && !this.isCall() && this.status() < bit6.Message.READ;
    };

    Message.prototype.getConversationId = function() {
      var convId;
      convId = (this.me != null) && this.me.indexOf('grp:') === 0 ? this.me : this.other;
      if (!convId) {
        console.log('msgConvId is null', convId);
      }
      return convId;
    };

    Message.prototype.getStatusString = function() {
      var r, s, t;
      t = this.flags & TYPE_MASK;
      s = this.flags & STATUS_MASK;
      r = t === Message.CALL ? callStatusAsString : messageStatusAsString;
      return r[s];
    };

    Message.prototype.domId = function() {
      return 'm' + this.id;
    };

    Message.fromDomId = function(t) {
      if (t.length > 0 && t.charAt(0) === 'm') {
        return t.substring(1);
      } else {
        return t;
      }
    };

    Message.typeFromFlags = function(s) {
      return s & TYPE_MASK;
    };

    Message.channelFromFlags = function(s) {
      return s & CHANNEL_MASK;
    };

    Message.statusFromFlags = function(s) {
      return s & STATUS_MASK;
    };

    return Message;

  })();

}).call(this);

(function() {
  var extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  bit6.Outgoing = (function(superClass) {
    extend(Outgoing, superClass);

    function Outgoing(client) {
      this.client = client;
      Outgoing.__super__.constructor.apply(this, arguments);
      this.id = bit6.JsonRpc.generateGUID();
      this.me = this.client.session.identity;
      this.created = this.updated = Date.now();
      this.flags = bit6.Message.TEXT | bit6.Message.SENDING;
    }

    Outgoing.prototype._export = function() {
      var i, k, len, n, x;
      n = ['id', 'flags', 'me', 'other', 'content', 'data'];
      x = {};
      for (i = 0, len = n.length; i < len; i++) {
        k = n[i];
        if (this[k]) {
          x[k] = this[k];
        }
      }
      return x;
    };

    Outgoing.prototype.hasAttachment = function() {
      return this.attachFile != null;
    };

    Outgoing.prototype.to = function(other) {
      this.other = other;
      return this;
    };

    Outgoing.prototype.text = function(text) {
      this.content = text;
      return this;
    };

    Outgoing.prototype.attach = function(f) {
      this.attachFile = f;
      this.flags = bit6.Message.ATTACH | this.status();
      this.progress = 0;
      this.total = -1;
      return this;
    };

    Outgoing.prototype.send = function(cb) {
      console.log('Sending: ', this);
      if (!this.hasAttachment()) {
        this.client._processMessage(this);
        return this.client._sendMessagePost(this, cb);
      }
      this._loadAttachmentAndThumbnail((function(_this) {
        return function(err) {
          _this.client._processMessage(_this);
          if (err != null) {
            return cb(err);
          }
          return _this._getUploadParams(function(err, params) {
            console.log('Got upload params', params, 'err=', err);
            if (err != null) {
              return cb(err);
            }
            return _this._uploadAttachmentAndThumbnail(params, function(err) {
              if (err != null) {
                return cb(err);
              }
              return _this.client._sendMessagePost(_this, cb);
            });
          });
        };
      })(this));
      return this;
    };

    Outgoing.prototype._getUploadParams = function(cb) {
      var opts, ref, ref1;
      if (((ref = this.data) != null ? ref.type : void 0) == null) {
        return cb('Attachment type is not specified', null);
      }
      opts = {
        type: this.data.type
      };
      opts.thumb = (ref1 = this.thumbBlob) != null ? ref1.type : void 0;
      return this.client.api('/me/messages/attach', 'post', opts, cb);
    };

    Outgoing.prototype._loadAttachmentAndThumbnail = function(cb) {
      return bit6.Transfer.readFileAsArrayBuffer(this.attachFile, (function(_this) {
        return function(err, info, data) {
          console.log('Read file ', info, 'err=', err);
          if (err != null) {
            return cb(err);
          }
          return _this._handleAttachmentFileLoaded(info, data, cb);
        };
      })(this));
    };

    Outgoing.prototype._uploadAttachmentAndThumbnail = function(params, cb) {
      var f, fileUploadedSize, x;
      f = this.attachFile;
      fileUploadedSize = 0;
      x = params.uploads.attach;
      return bit6.Outgoing.uploadFile(x.endpoint, x.params, f, (function(_this) {
        return function(err) {
          console.log('Main attach uploaded err=', err);
          if (err != null) {
            return cb(err);
          }
          _this.data.attach = params.keys.attach;
          if ((_this.data.thumb == null) || (_this.thumbBlob == null)) {
            return cb(null);
          }
          x = params.uploads.thumb;
          return bit6.Outgoing.uploadFile(x.endpoint, x.params, _this.thumbBlob, function(err) {
            console.log('Thumb uploaded err=', err);
            if (err != null) {
              return cb(err);
            }
            _this.data.thumb = params.keys.thumb;
            return cb(null);
          }, function(val, total) {
            _this.progress = val + fileUploadedSize;
            _this.total = total + fileUploadedSize;
            return _this.client.emit('message', _this, 0);
          });
        };
      })(this), (function(_this) {
        return function(val, total) {
          fileUploadedSize = val;
          _this.progress = val;
          _this.total = total;
          return _this.client.emit('message', _this, 0);
        };
      })(this));
    };

    Outgoing.prototype._handleAttachmentFileLoaded = function(info, data, cb) {
      var blob, isAudio, isImage, isVideo, media, ref, srcUrl, t;
      t = (ref = info != null ? info.type : void 0) != null ? ref : '';
      isImage = t.indexOf('image/') === 0;
      isVideo = t.indexOf('video/') === 0;
      isAudio = t.indexOf('audio/') === 0;
      if (isImage || isVideo) {
        blob = new Blob([data], info);
        srcUrl = (window.URL || window.webkitURL).createObjectURL(blob);
        media = null;
        if (isImage) {
          media = new Image();
          media.onload = (function(_this) {
            return function() {
              return _this._attachmentMediaLoaded(media, info, cb);
            };
          })(this);
        } else {
          media = document.createElement('video');
          media.setAttribute('preload', '');
          media.setAttribute('muted', '');
          media.onloadedmetadata = (function(_this) {
            return function() {
              return console.log('Video meta loaded', media.videoWidth, media.videoHeight, media.duration);
            };
          })(this);
          media.onloadeddata = (function(_this) {
            return function() {
              console.log('Video loaded', media);
              return _this._attachmentMediaLoaded(media, info, cb);
            };
          })(this);
        }
        return media.src = srcUrl;
      } else if (isAudio) {
        this.data = {
          type: info.type
        };
        return cb(null);
      } else {
        return cb('Cannot handle files with type' + t);
      }
    };

    Outgoing.prototype._attachmentMediaLoaded = function(media, info, cb) {
      (window.URL || window.webkitURL).revokeObjectURL(media.src);
      return bit6.Outgoing.createThumbnail(media, (function(_this) {
        return function(err, thumbDataUrl) {
          console.log('Thumb created err=', err);
          if (err != null) {
            return cb(err);
          }
          if (thumbDataUrl != null) {
            _this.thumbBlob = bit6.Transfer.dataUrlToBlob(thumbDataUrl);
          }
          _this.data = {
            type: info.type,
            attach: thumbDataUrl,
            thumb: thumbDataUrl
          };
          return cb(null);
        };
      })(this));
    };

    Outgoing.createThumbnail = function(media, cb) {
      var canvas, ctx, dataUrl, maxHeight, maxWidth, ref, ref1, th, tw;
      maxWidth = 320;
      maxHeight = 320;
      tw = (ref = media != null ? media.videoWidth : void 0) != null ? ref : media.width;
      th = (ref1 = media != null ? media.videoHeight : void 0) != null ? ref1 : media.height;
      console.log('Orig media loaded. dimen=', tw, th);
      if (tw > th) {
        if (tw > maxWidth) {
          th *= maxWidth / tw;
          tw = maxWidth;
        }
      } else {
        if (th > maxHeight) {
          tw *= maxHeight / th;
          th = maxHeight;
        }
      }
      canvas = document.createElement('canvas');
      canvas.width = tw;
      canvas.height = th;
      ctx = canvas.getContext('2d');
      ctx.drawImage(media, 0, 0, tw, th);
      dataUrl = canvas.toDataURL('image/jpeg');
      return cb(null, dataUrl);
    };

    Outgoing.uploadFile = function(endpoint, params, f, cb, progressCb) {
      var b;
      b = new bit6.Outgoing.UploadDataBuilder(params, f);
      return b.build(function(err, uploadData, contentType) {
        if (err != null) {
          return cb(err);
        }
        return bit6.Outgoing._upload(endpoint, uploadData, contentType, cb, progressCb);
      });
    };

    Outgoing._upload = function(endpoint, uploadData, contentType, cb, progressCb) {
      var ref, up, xhr;
      xhr = new XMLHttpRequest();
      xhr.open('POST', endpoint, true);
      xhr.onload = function(e) {
        console.log('xhr complete status=' + xhr.status + ' ' + xhr.statusText);
        if (xhr.status >= 200 && xhr.status < 300) {
          return cb(null);
        } else {
          return cb({
            status: xhr.status,
            text: xhr.statusText,
            info: xhr.responseText
          });
        }
      };
      xhr.onerror = function(e) {
        console.log('xhr error', e);
        return cb(e);
      };
      xhr.onabort = function(e) {
        console.log('xhr cancel');
        return cb(e);
      };
      xhr.onprogress = function(e) {
        return console.log('xhr progress', e);
      };
      up = (ref = xhr != null ? xhr.upload : void 0) != null ? ref : null;
      if (up) {
        up.onload = function(e) {
          return console.log('xhr upload complete', e);
        };
        up.onerror = function(e) {
          return console.log('xhr upload error', e);
        };
        up.onabort = function(e) {
          return console.log('xhr upload cancel', e);
        };
        up.onprogress = function(e) {
          var total;
          total = e.lengthComputable ? e.total : -1;
          return typeof progressCb === "function" ? progressCb(e.loaded, total) : void 0;
        };
      }
      if (contentType != null) {
        xhr.setRequestHeader('Content-Type', contentType);
      }
      return xhr.send(uploadData);
    };

    return Outgoing;

  })(bit6.Message);

  bit6.Outgoing.UploadDataBuilder = (function() {
    function UploadDataBuilder(params, f) {
      if (!this._needsFormDataShim()) {
        return this._createFormData(params, f);
      }
      this._initMultiPart(params, f);
    }

    UploadDataBuilder.prototype._createFormData = function(params, f) {
      var k, v;
      this.fd = new FormData();
      for (k in params) {
        v = params[k];
        this.fd.append(k, v);
      }
      return this.fd.append('file', f);
    };

    UploadDataBuilder.prototype._initMultiPart = function(params, f) {
      var k, v;
      this.boundary = Array(21).join('-') + (+new Date() * (1e16 * Math.random())).toString(36);
      this.parts = [];
      for (k in params) {
        v = params[k];
        this._append(k, v);
      }
      if (f instanceof File) {
        return this.fileToLoad = f;
      } else {
        return this._append('file', f);
      }
    };

    UploadDataBuilder.prototype._append = function(name, value, filename) {
      this.parts.push('--' + this.boundary + '\r\nContent-Disposition: form-data; name="' + name + '"');
      if (value instanceof Blob) {
        if (filename == null) {
          filename = 'blob';
        }
        this.parts.push('; filename="' + filename + '"\r\nContent-Type: ' + value.type);
      }
      this.parts.push('\r\n\r\n');
      this.parts.push(value);
      return this.parts.push('\r\n');
    };

    UploadDataBuilder.prototype.build = function(cb) {
      if (this.fd != null) {
        return cb(null, this.fd);
      }
      return this._ensureFileLoaded('file', this.fileToLoad, (function(_this) {
        return function(err) {
          if (err) {
            return cb(err);
          }
          return _this._completeMultiPart(cb);
        };
      })(this));
    };

    UploadDataBuilder.prototype._ensureFileLoaded = function(name, f, cb) {
      if (f == null) {
        return cb(null);
      }
      return bit6.Transfer.readFileAsArrayBuffer(f, (function(_this) {
        return function(err, info, data) {
          if (err) {
            return cb(err);
          }
          _this._append(name, new Blob([data], {
            type: info.type
          }, info.name));
          return cb(null);
        };
      })(this));
    };

    UploadDataBuilder.prototype._completeMultiPart = function(cb) {
      var data, fr;
      this.parts.push('--' + this.boundary + '--');
      data = new Blob(this.parts);
      fr = new FileReader();
      fr.onload = (function(_this) {
        return function() {
          return cb(null, fr.result, 'multipart/form-data; boundary=' + _this.boundary);
        };
      })(this);
      fr.onerror = function(err) {
        return cb(err);
      };
      return fr.readAsArrayBuffer(data);
    };

    UploadDataBuilder.prototype._needsFormDataShim = function() {
      var flag, ua, v;
      ua = navigator.userAgent;
      v = navigator.vendor;
      flag = ~ua.indexOf('Android') && ~v.indexOf('Google') && !~ua.indexOf('Chrome');
      return flag && ua.match(/AppleWebKit\/(\d+)/).pop() <= 534;
    };

    return UploadDataBuilder;

  })();

}).call(this);

(function() {
  var extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  bit6.RtcMedia = (function(superClass) {
    extend(RtcMedia, superClass);

    function RtcMedia() {
      return RtcMedia.__super__.constructor.apply(this, arguments);
    }

    RtcMedia.prototype.init = function(options) {
      this.options = options;
      this.preparing = true;
      this.ok = true;
      this.cbs = [];
      return this.counter = 0;
    };

    RtcMedia.prototype.start = function() {
      this.localStream = null;
      this.localEl = null;
      console.log('RtcMedia start', this.options);
      return RtcMedia.getUserMedia(this.options, (function(_this) {
        return function(stream) {
          _this._handleUserMedia(stream);
          return _this._done(true);
        };
      })(this), (function(_this) {
        return function(err) {
          console.log('getUserMedia error: ', err);
          return _this._done(false);
        };
      })(this));
    };

    RtcMedia.prototype.check = function(cb) {
      if (this.preparing) {
        return this.cbs.push(cb);
      } else {
        return cb(this.ok);
      }
    };

    RtcMedia.prototype._done = function(ok) {
      var cb, i, len, results, x;
      this.preparing = false;
      this.ok = ok;
      x = this.cbs;
      this.cbs = [];
      results = [];
      for (i = 0, len = x.length; i < len; i++) {
        cb = x[i];
        results.push(cb(this.ok));
      }
      return results;
    };

    RtcMedia.prototype.stop = function() {
      var ref, ref1;
      if (this.localStream) {
        this.localStream.stop();
        this.localStream = null;
      }
      if (this.localEl) {
        this.localEl.src = '';
        if (!this.options.localMediaEl) {
          if ((ref = this.localEl) != null) {
            if ((ref1 = ref.parentNode) != null) {
              ref1.removeChild(this.localEl);
            }
          }
        }
        return this.localEl = null;
      }
    };

    RtcMedia.prototype._handleUserMedia = function(stream) {
      var e, ref;
      this.localStream = stream;
      e = (ref = this.options.localMediaEl) != null ? ref : null;
      if (!e && this.options.video) {
        e = document.createElement('video');
        e.setAttribute('class', 'local');
        e.setAttribute('autoplay', 'true');
        e.setAttribute('muted', 'true');
        e.muted = true;
        this.options.containerEl.appendChild(e);
      }
      this.localEl = e;
      if (e) {
        return this.localEl = RtcMedia.attachMediaStream(e, stream);
      }
    };

    RtcMedia.getUserMedia = function(opts, success, error) {
      if ((typeof window !== "undefined" && window !== null ? window.getUserMedia : void 0) != null) {
        return window.getUserMedia(opts, success, error);
      }
      if ((typeof navigator !== "undefined" && navigator !== null ? navigator.getUserMedia : void 0) != null) {
        return navigator.getUserMedia(opts, success, error);
      }
      if ((typeof navigator !== "undefined" && navigator !== null ? navigator.mozGetUserMedia : void 0) != null) {
        return navigator.mozGetUserMedia(opts, success, error);
      }
      if ((typeof navigator !== "undefined" && navigator !== null ? navigator.webkitGetUserMedia : void 0) != null) {
        return navigator.webkitGetUserMedia(opts, success, error);
      }
      return error('WebRTC not supported. Could not find getUserMedia()');
    };

    RtcMedia.attachMediaStream = function(elem, stream) {
      if ((typeof window !== "undefined" && window !== null ? window.attachMediaStream : void 0) != null) {
        return window.attachMediaStream(elem, stream);
      }
      if ((elem != null ? elem.srcObject : void 0) != null) {
        elem.srcObject = stream;
      } else if ((elem != null ? elem.mozSrcObject : void 0) != null) {
        elem.mozSrcObject = stream;
      } else if ((elem != null ? elem.src : void 0) != null) {
        elem.src = window.URL.createObjectURL(stream);
      } else {
        console.log('Error attaching stream to element', elem);
      }
      return elem;
    };

    return RtcMedia;

  })(bit6.EventEmitter);

}).call(this);

(function() {
  var extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  bit6.Rtc = (function(superClass) {
    extend(Rtc, superClass);

    function Rtc() {
      return Rtc.__super__.constructor.apply(this, arguments);
    }

    Rtc.prototype.init = function(media, outgoing, iceServers, options) {
      this.media = media;
      this.outgoing = outgoing;
      this.options = options;
      this.pcConstraints = {
        optional: [
          {
            'DtlsSrtpKeyAgreement': true
          }
        ]
      };
      this.pcConfig = this._createPcConfig(iceServers);
      this.isStarted = false;
      this.remoteStream = null;
      this.pc = null;
      this.outgoingTransfer = null;
      this.incomingTransfer = null;
      this.bufferedIceCandidates = [];
      this.bufferedIceCandidatesDone = false;
      return this.bufferedOfferAnswer = null;
    };

    Rtc.prototype.start = function() {
      console.log('Rtc start', this.options);
      this.remoteEl = null;
      if (this.outgoing && this._preparePeerConnection()) {
        if (this.options.data) {
          this._createDataChannel();
        }
        return this.pc.createOffer((function(_this) {
          return function(offer) {
            return _this._setLocalAndSendOfferAnswer(offer);
          };
        })(this), (function(_this) {
          return function(err) {
            return console.log('CreateOffer error', err);
          };
        })(this));
      }
    };

    Rtc.prototype.stop = function() {
      var ref, ref1;
      this.isStarted = false;
      if (this.remoteStream) {
        this.remoteStream = null;
      }
      if (this.remoteEl) {
        this.remoteEl.src = '';
        if (!this.options.remoteMediaEl) {
          if ((ref = this.remoteEl) != null) {
            if ((ref1 = ref.parentNode) != null) {
              ref1.removeChild(this.remoteEl);
            }
          }
        }
        this.remoteEl = null;
      }
      if (this.dc) {
        this.dc.close();
        this.dc = null;
      }
      if (this.pc) {
        this.pc.close();
        return this.pc = null;
      }
    };

    Rtc.prototype._preparePeerConnection = function() {
      var ref;
      if (this.isStarted) {
        return false;
      }
      this.pc = this._createPeerConnection();
      if (this.pc == null) {
        return false;
      }
      if ((ref = this.media) != null ? ref.localStream : void 0) {
        this.pc.addStream(this.media.localStream);
      }
      this.isStarted = true;
      return true;
    };

    Rtc.prototype._createPeerConnection = function() {
      var PeerConnection, error, ex, pc, ref, ref1;
      try {
        PeerConnection = (ref = (ref1 = window.RTCPeerConnection) != null ? ref1 : window.mozRTCPeerConnection) != null ? ref : window.webkitRTCPeerConnection;
        pc = new PeerConnection(this.pcConfig, this.pcConstraints);
        pc.onicecandidate = (function(_this) {
          return function(evt) {
            return _this._handleIceCandidate(evt);
          };
        })(this);
        pc.onaddstream = (function(_this) {
          return function(evt) {
            return _this._handleRemoteStreamAdded(evt);
          };
        })(this);
        pc.onremovestream = (function(_this) {
          return function(evt) {
            return _this._handleRemoteStreamRemoved(evt);
          };
        })(this);
        pc.ondatachannel = (function(_this) {
          return function(evt) {
            return _this._createDataChannel(evt.channel);
          };
        })(this);
        return pc;
      } catch (error) {
        ex = error;
        console.log('Failed to create PeerConnection, exception: ', ex);
        return null;
      }
    };

    Rtc.prototype._createDataChannel = function(dc) {
      var opts;
      if (!dc) {
        opts = {
          ordered: true
        };
        dc = this.pc.createDataChannel('mydc', opts);
      }
      this.dc = dc;
      dc.binaryType = 'arraybuffer';
      dc.onopen = (function(_this) {
        return function() {
          return _this._handleDcOpen();
        };
      })(this);
      dc.onclose = (function(_this) {
        return function() {
          return _this._handleDcClose();
        };
      })(this);
      dc.onerror = (function(_this) {
        return function(err) {
          return _this._handleDcError(err);
        };
      })(this);
      return dc.onmessage = (function(_this) {
        return function(evt) {
          return _this._handleDcMessage(evt);
        };
      })(this);
    };

    Rtc.prototype._handleDcOpen = function() {
      console.log("The Data Channel is Opened");
      return this.emit('dcOpen');
    };

    Rtc.prototype._handleDcClose = function() {
      console.log("The Data Channel is Closed");
      if (this.outgoingTransfer || this.incomingTransfer) {
        return this._handleDcError('DataChannel closed');
      }
    };

    Rtc.prototype._handleDcError = function(err) {
      var i, len, ref, tr;
      console.log("Data Channel Error:", err);
      ref = [this.outgoingTransfer, this.incomingTransfer];
      for (i = 0, len = ref.length; i < len; i++) {
        tr = ref[i];
        if (tr) {
          tr.err = err;
        }
        if (tr) {
          this.emit('transfer', tr);
        }
      }
      return this.outgoingTransfer = this.incomingTransfer = null;
    };

    Rtc.prototype._handleDcMessage = function(evt) {
      var d, done, info;
      d = evt.data;
      if (this.incomingTransfer) {
        if (d.byteLength != null) {
          done = this.incomingTransfer._gotChunk(d);
          this.emit('transfer', this.incomingTransfer);
          if (done) {
            return this.incomingTransfer = null;
          }
        } else {
          return console.log('Error: incoming transfer data', d);
        }
      } else {
        if (d.byteLength != null) {
          return console.log('Error: incoming transfer not created for:', d);
        } else {
          info = JSON.parse(d);
          if (info) {
            this.incomingTransfer = new bit6.Transfer(false, info);
            return this.emit('transfer', this.incomingTransfer);
          } else {
            return console.log('Error: could not parse incoming transfer info:', d);
          }
        }
      }
    };

    Rtc.prototype._handleIceCandidate = function(evt) {
      var base, c, idx;
      console.log('handleIceCandidate event: ', evt);
      if (evt.candidate != null) {
        c = evt.candidate;
        idx = c.sdpMLineIndex;
        if ((base = this.bufferedIceCandidates)[idx] == null) {
          base[idx] = [];
        }
        return this.bufferedIceCandidates[idx].push(c);
      } else {
        console.log('End of candidates.');
        console.log('BufferedCandidates', this.bufferedIceCandidates);
        this.bufferedIceCandidatesDone = true;
        return this._maybeSendOfferAnswer();
      }
    };

    Rtc.prototype._maybeSendOfferAnswer = function() {
      var offerAnswer;
      if (this.bufferedOfferAnswer && this.bufferedIceCandidatesDone) {
        offerAnswer = this._mergeSdp(this.bufferedOfferAnswer, this.bufferedIceCandidates);
        this.bufferedOfferAnswer = null;
        this.bufferedIceCandidates = [];
        this.bufferedIceCandidatesDone = false;
        console.log('Send OfferAnswer:', offerAnswer);
        if (offerAnswer) {
          return this.emit('offerAnswer', offerAnswer);
        }
      }
    };

    Rtc.prototype._createPcConfig = function(iceServers) {
      var c;
      console.log('RTC createPcConfig got ICE servers:', iceServers);
      return c = {
        iceServers: iceServers
      };
    };

    Rtc.prototype._mergeSdp = function(offerAnswer, candidatesByMlineIndex) {
      var chunk, chunks, end, i, idx, len, sdp, start;
      sdp = offerAnswer.sdp;
      chunks = [];
      start = 0;
      while ((end = sdp.indexOf('m=', start + 1)) >= 0) {
        chunks.push(sdp.substring(start, end));
        start = end;
      }
      chunks.push(sdp.substring(start));
      sdp = '';
      for (idx = i = 0, len = chunks.length; i < len; idx = ++i) {
        chunk = chunks[idx];
        sdp += chunk;
        if (idx > 0 && (candidatesByMlineIndex[idx - 1] != null)) {
          sdp += this._iceCandidatesToSdp(candidatesByMlineIndex[idx - 1]);
        }
      }
      offerAnswer.sdp = sdp;
      return offerAnswer;
    };

    Rtc.prototype._iceCandidatesToSdp = function(arr) {
      var c, i, len, t;
      t = '';
      for (i = 0, len = arr.length; i < len; i++) {
        c = arr[i];
        t += 'a=' + c.candidate + '\r\n';
      }
      return t;
    };

    Rtc.prototype._handleRemoteStreamAdded = function(evt) {
      var e, ref, ref1;
      this.remoteStream = evt.stream;
      e = (ref = this.options.remoteMediaEl) != null ? ref : null;
      if (!e) {
        if (this.options.video) {
          e = document.createElement('video');
          this.options.containerEl.appendChild(e);
        } else if (this.options.audio) {
          e = document.createElement('audio');
          if ((typeof window !== "undefined" && window !== null ? window.webrtcDetectedType : void 0) === 'plugin') {
            if (typeof document !== "undefined" && document !== null) {
              if ((ref1 = document.body) != null) {
                ref1.appendChild(e);
              }
            }
          }
        }
        if (e) {
          e.setAttribute('class', 'remote');
          e.setAttribute('autoplay', 'true');
        }
      }
      this.remoteEl = e;
      if (e) {
        this.remoteEl = bit6.RtcMedia.attachMediaStream(e, evt.stream);
      }
      if (this.options.video) {
        return this.emit('videos');
      }
    };

    Rtc.prototype._handleRemoteStreamRemoved = function(evt) {
      return console.log('Remote stream removed:', evt);
    };

    Rtc.prototype._setLocalAndSendOfferAnswer = function(offerAnswer) {
      return this.pc.setLocalDescription(offerAnswer, (function(_this) {
        return function() {
          _this.bufferedOfferAnswer = {
            type: offerAnswer.type,
            sdp: offerAnswer.sdp
          };
          return _this._maybeSendOfferAnswer();
        };
      })(this), (function(_this) {
        return function(err) {
          return console.log('Error setting PeerConnection localDescription', err, offerAnswer);
        };
      })(this));
    };

    Rtc.prototype.gotRemoteOfferAnswer = function(msg) {
      var SessionDescription, offerAnswer;
      SessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription;
      offerAnswer = new SessionDescription(msg);
      switch (msg.type) {
        case 'offer':
          if (!this.outgoing && !this.isStarted) {
            this._preparePeerConnection();
          }
          this.pc.setRemoteDescription(offerAnswer);
          return this.pc.createAnswer((function(_this) {
            return function(answer) {
              return _this._setLocalAndSendOfferAnswer(answer);
            };
          })(this), (function(_this) {
            return function(err) {
              return console.log('CreateAnswer error', err);
            };
          })(this));
        case 'answer':
          if (this.isStarted) {
            return this.pc.setRemoteDescription(offerAnswer);
          }
      }
    };

    Rtc.prototype.gotHangup = function(msg) {
      return this.stop();
    };

    Rtc.prototype.startOutgoingTransfer = function(tr) {
      var chunk, data, delay, intervalId, sent, total;
      if (this.outgoingTransfer) {
        return false;
      }
      if (!this.dc) {
        return false;
      }
      if (this.dc.readyState !== 'open') {
        return false;
      }
      this.outgoingTransfer = tr;
      this.dc.send(JSON.stringify(tr.info));
      data = tr.data;
      delay = 10;
      chunk = 16384;
      sent = 0;
      total = data.byteLength;
      intervalId = 0;
      return intervalId = setInterval((function(_this) {
        return function() {
          var clear, end, ref;
          clear = false;
          tr = _this.outgoingTransfer;
          if (!tr || tr.err) {
            clear = true;
          }
          if (!clear) {
            if (((ref = _this.dc) != null ? ref.bufferedAmount : void 0) > chunk * 50) {
              return;
            }
            end = sent + chunk;
            if (end > total) {
              end = total;
            }
            _this.dc.send(data.slice(sent, end));
            sent = end;
            tr.progress = sent;
            clear = sent >= total;
          }
          if (clear) {
            _this.outgoingTransfer = null;
            clearInterval(intervalId);
          }
          if (tr) {
            return _this.emit('transfer', tr);
          }
        };
      })(this), delay);
    };

    return Rtc;

  })(bit6.EventEmitter);

}).call(this);

(function() {
  var extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty,
    slice = [].slice;

  bit6.Session = (function(superClass) {
    extend(Session, superClass);

    Session.prototype._sprops = ['authenticated', 'authInfo', 'config', 'device', 'identity', 'token', 'userid'];

    function Session(client) {
      this.client = client;
      Session.__super__.constructor.apply(this, arguments);
      this._clear();
    }

    Session.prototype._clear = function() {
      var i, len, n, ref;
      ref = this._sprops;
      for (i = 0, len = ref.length; i < len; i++) {
        n = ref[i];
        this[n] = null;
      }
      return this.authenticated = false;
    };

    Session.prototype.logout = function(cb) {
      this._clear();
      this.client._onLogout(cb);
      return this.emit('deauth');
    };

    Session.prototype.getAuthInfo = function(cb) {
      if (this.authInfo) {
        return cb(null, this.authInfo);
      }
      return this.api('/info', (function(_this) {
        return function(err, info) {
          if (err) {
            return cb(err);
          }
          _this.authInfo = info;
          return cb(err, info);
        };
      })(this));
    };

    Session.prototype.login = function(data, cb) {
      data.identity = bit6.Client.normalizeIdentityUri(data.identity);
      return this._auth('login', data, cb);
    };

    Session.prototype.signup = function(data, cb) {
      data.identity = bit6.Client.normalizeIdentityUri(data.identity);
      return this._auth('signup', data, cb);
    };

    Session.prototype.anonymous = function(cb) {
      return this._auth('anonymous', {}, cb);
    };

    Session.prototype.external = function(token, cb) {
      return this._auth('external', {
        token: token
      }, cb);
    };

    Session.prototype.oauth = function(provider, opts, cb) {
      this._ensureOauthRedirectUri(opts);
      return this.getAuthInfo((function(_this) {
        return function(err, info) {
          if (err) {
            return cb(err);
          }
          return _this._auth(provider, opts, cb);
        };
      })(this));
    };

    Session.prototype.oauth1_redirect = function(provider, opts, cb) {
      this._ensureOauthRedirectUri(opts);
      return this.api('/' + provider, 'POST', opts, cb);
    };

    Session.prototype._ensureOauthRedirectUri = function(opts) {
      var redirectUrl, ref, ref1, ref2;
      redirectUrl = (ref = opts.redirect_uri) != null ? ref : opts.redirectUri;
      if (redirectUrl == null) {
        return opts.redirect_uri = typeof window !== "undefined" && window !== null ? (ref1 = window.location) != null ? (ref2 = ref1.href) != null ? ref2.split('?')[0] : void 0 : void 0 : void 0;
      }
    };

    Session.prototype.refresh = function(cb) {
      return this._auth('refresh_token', {}, cb);
    };

    Session.prototype.save = function() {
      var i, len, n, ref, x;
      x = {};
      ref = this._sprops;
      for (i = 0, len = ref.length; i < len; i++) {
        n = ref[i];
        x[n] = this[n];
      }
      return x;
    };

    Session.prototype.resume = function(x, cb) {
      var i, len, n, ref, ref1;
      ref = this._sprops;
      for (i = 0, len = ref.length; i < len; i++) {
        n = ref[i];
        this[n] = (ref1 = x != null ? x[n] : void 0) != null ? ref1 : null;
      }
      return this.refresh(cb);
    };

    Session.prototype._auth = function(type, data, cb) {
      if (data == null) {
        data = {};
      }
      if (this.device == null) {
        this.device = this.client._createDeviceId();
      }
      data.device = this.device;
      data.embed = 'config';
      return this.api('/' + type, 'POST', data, (function(_this) {
        return function(err, result) {
          var i, k, len, ref;
          if (err) {
            ref = ['config', 'identity', 'token', 'userid'];
            for (i = 0, len = ref.length; i < len; i++) {
              k = ref[i];
              delete _this[k];
            }
            return cb(err);
          }
          return _this._authDone(result, cb);
        };
      })(this));
    };

    Session.prototype._authDone = function(data, cb) {
      var apikey2, claims, claimsStr, error, ex, i, k, len, r, ref, ref1, ref2, uid, x;
      if (data.token == null) {
        return cb('Jwt token is missing');
      }
      try {
        r = data.token.split('.');
        claimsStr = r != null ? r[1] : void 0;
        if (claimsStr != null) {
          claims = JSON.parse(bit6.Session.base64urlDecode(claimsStr));
        }
        console.log('Jwt claims', claims);
      } catch (error) {
        ex = error;
        console.log('Error parsing Jwt claims', r[1]);
      }
      x = claims != null ? (ref = claims.sub) != null ? ref.split('@') : void 0 : void 0;
      if ((x != null) && x.length === 2) {
        uid = x[0], apikey2 = x[1];
      }
      if (!((uid != null) && (apikey2 != null))) {
        return cb('Jwt token has invalid format');
      }
      this.authenticated = true;
      ref1 = ['config', 'identity', 'token', 'userid'];
      for (i = 0, len = ref1.length; i < len; i++) {
        k = ref1[i];
        this[k] = (ref2 = data[k]) != null ? ref2 : this[k];
      }
      this.client._onLogin(cb);
      return this.emit('auth');
    };

    Session.prototype.api = function() {
      var cb, i, params, path, ref;
      path = arguments[0], params = 3 <= arguments.length ? slice.call(arguments, 1, i = arguments.length - 1) : (i = 1, []), cb = arguments[i++];
      return (ref = this.client)._api.apply(ref, ['/auth/1' + path].concat(slice.call(params), [cb]));
    };

    Session.base64urlDecode = function(s) {
      s += new Array(4 - ((s.length + 3) & 3)).join('=');
      s = s.replace(/\-/g, '+').replace(/_/g, '/');
      s = atob(s);
      return s;
    };

    return Session;

  })(bit6.EventEmitter);

}).call(this);

(function() {
  bit6.Transfer = (function() {
    function Transfer(outgoing, info1, data) {
      var ref;
      this.outgoing = outgoing;
      this.info = info1;
      this.progress = 0;
      this.total = (ref = this.info.size) != null ? ref : 0;
      this.err = null;
      this.data = data != null ? data : null;
      if (!this.outgoing) {
        this.buf = [];
      }
    }

    Transfer.prototype.pending = function() {
      return this.outgoing && this.data && !this.err && this.progress === 0;
    };

    Transfer.prototype.completed = function() {
      return this.progress === this.total && this.data && !this.err;
    };

    Transfer.prototype.percentage = function() {
      if (!this.total) {
        return 0;
      }
      return (this.progress * 100 / this.total).toFixed(2);
    };

    Transfer.prototype._ensureSourceData = function(cb) {
      if (this.data != null) {
        return cb(null);
      }
      return bit6.Transfer.readFileAsArrayBuffer(this.info, (function(_this) {
        return function(err, info2, data) {
          if (err != null) {
            _this.err = err;
          }
          if ((data != null) && (info2 != null)) {
            _this.info = info2;
          }
          if (data != null) {
            _this.data = data;
          }
          return cb(err);
        };
      })(this));
    };

    Transfer.prototype._gotChunk = function(chunk) {
      this.buf.push(chunk);
      this.progress += chunk.byteLength;
      if (this.progress < this.total) {
        return false;
      }
      this._prepareReceivedData();
      return true;
    };

    Transfer.prototype._prepareReceivedData = function() {
      var b, j, len, offset, ref, tmp;
      tmp = new Uint8Array(this.progress);
      offset = 0;
      ref = this.buf;
      for (j = 0, len = ref.length; j < len; j++) {
        b = ref[j];
        tmp.set(new Uint8Array(b), offset);
        offset += b.byteLength;
      }
      this.buf = null;
      return this.data = tmp.buffer;
    };

    Transfer.readFileAsArrayBuffer = function(f, cb) {
      var reader;
      reader = new FileReader();
      reader.onload = function(e) {
        var data, info;
        if (reader.readyState === FileReader.DONE) {
          data = e.target.result;
          console.log(f.name + ' - read ' + data.byteLength + 'b');
          info = {
            name: f.name,
            type: f.type,
            size: f.size
          };
          return cb(null, info, data);
        }
      };
      reader.onerror = function(e) {
        return cb(e);
      };
      reader.onabort = function(e) {
        return cb(e);
      };
      return reader.readAsArrayBuffer(f);
    };

    Transfer.dataUrlToBlob = function(url) {
      var ab, arr, contentType, i, j, marker, parts, raw, rawLength, ref;
      marker = ';base64,';
      raw = null;
      contentType = null;
      if (url.indexOf(marker) < 0) {
        parts = url.split(',');
        contentType = parts[0].split(':')[1];
        raw = decodeURIComponent(parts[1]);
      } else {
        parts = url.split(marker);
        contentType = parts[0].split(':')[1];
        raw = atob(parts[1]);
        rawLength = raw.length;
        ab = new ArrayBuffer(rawLength);
        arr = new Uint8Array(ab);
        for (i = j = 0, ref = rawLength - 1; 0 <= ref ? j < ref : j > ref; i = 0 <= ref ? ++j : --j) {
          arr[i] = raw.charCodeAt(i);
        }
        raw = ab;
      }
      return new Blob([raw], {
        type: contentType
      });
    };

    return Transfer;

  })();

}).call(this);
