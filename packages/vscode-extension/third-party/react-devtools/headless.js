/******/ var __webpack_modules__ = ({

/***/ 811:
/***/ ((module) => {

//  Import support https://stackoverflow.com/questions/13673346/supporting-both-commonjs-and-amd
(function (name, definition) {
  if (true) {
    module.exports = definition();
  } else {}
})("clipboard", function () {
  if (typeof document === 'undefined' || !document.addEventListener) {
    return null;
  }

  var clipboard = {};

  clipboard.copy = function () {
    var _intercept = false;
    var _data = null; // Map from data type (e.g. "text/html") to value.

    var _bogusSelection = false;

    function cleanup() {
      _intercept = false;
      _data = null;

      if (_bogusSelection) {
        window.getSelection().removeAllRanges();
      }

      _bogusSelection = false;
    }

    document.addEventListener("copy", function (e) {
      if (_intercept) {
        for (var key in _data) {
          e.clipboardData.setData(key, _data[key]);
        }

        e.preventDefault();
      }
    }); // Workaround for Safari: https://bugs.webkit.org/show_bug.cgi?id=156529

    function bogusSelect() {
      var sel = document.getSelection(); // If "nothing" is selected...

      if (!document.queryCommandEnabled("copy") && sel.isCollapsed) {
        // ... temporarily select the entire body.
        //
        // We select the entire body because:
        // - it's guaranteed to exist,
        // - it works (unlike, say, document.head, or phantom element that is
        //   not inserted into the DOM),
        // - it doesn't seem to flicker (due to the synchronous copy event), and
        // - it avoids modifying the DOM (can trigger mutation observers).
        //
        // Because we can't do proper feature detection (we already checked
        // document.queryCommandEnabled("copy") , which actually gives a false
        // negative for Blink when nothing is selected) and UA sniffing is not
        // reliable (a lot of UA strings contain "Safari"), this will also
        // happen for some browsers other than Safari. :-()
        var range = document.createRange();
        range.selectNodeContents(document.body);
        sel.removeAllRanges();
        sel.addRange(range);
        _bogusSelection = true;
      }
    }

    ;
    return function (data) {
      return new Promise(function (resolve, reject) {
        _intercept = true;

        if (typeof data === "string") {
          _data = {
            "text/plain": data
          };
        } else if (data instanceof Node) {
          _data = {
            "text/html": new XMLSerializer().serializeToString(data)
          };
        } else if (data instanceof Object) {
          _data = data;
        } else {
          reject("Invalid data type. Must be string, DOM node, or an object mapping MIME types to strings.");
        }

        function triggerCopy(tryBogusSelect) {
          try {
            if (document.execCommand("copy")) {
              // document.execCommand is synchronous: http://www.w3.org/TR/2015/WD-clipboard-apis-20150421/#integration-with-rich-text-editing-apis
              // So we can call resolve() back here.
              cleanup();
              resolve();
            } else {
              if (!tryBogusSelect) {
                bogusSelect();
                triggerCopy(true);
              } else {
                cleanup();
                throw new Error("Unable to copy. Perhaps it's not available in your browser?");
              }
            }
          } catch (e) {
            cleanup();
            reject(e);
          }
        }

        triggerCopy(false);
      });
    };
  }();

  clipboard.paste = function () {
    var _intercept = false;

    var _resolve;

    var _dataType;

    document.addEventListener("paste", function (e) {
      if (_intercept) {
        _intercept = false;
        e.preventDefault();
        var resolve = _resolve;
        _resolve = null;
        resolve(e.clipboardData.getData(_dataType));
      }
    });
    return function (dataType) {
      return new Promise(function (resolve, reject) {
        _intercept = true;
        _resolve = resolve;
        _dataType = dataType || "text/plain";

        try {
          if (!document.execCommand("paste")) {
            _intercept = false;
            reject(new Error("Unable to paste. Pasting only works in Internet Explorer at the moment."));
          }
        } catch (e) {
          _intercept = false;
          reject(new Error(e));
        }
      });
    };
  }(); // Handle IE behaviour.


  if (typeof ClipboardEvent === "undefined" && typeof window.clipboardData !== "undefined" && typeof window.clipboardData.setData !== "undefined") {
    /*! promise-polyfill 2.0.1 */
    (function (a) {
      function b(a, b) {
        return function () {
          a.apply(b, arguments);
        };
      }

      function c(a) {
        if ("object" != typeof this) throw new TypeError("Promises must be constructed via new");
        if ("function" != typeof a) throw new TypeError("not a function");
        this._state = null, this._value = null, this._deferreds = [], i(a, b(e, this), b(f, this));
      }

      function d(a) {
        var b = this;
        return null === this._state ? void this._deferreds.push(a) : void j(function () {
          var c = b._state ? a.onFulfilled : a.onRejected;
          if (null === c) return void (b._state ? a.resolve : a.reject)(b._value);
          var d;

          try {
            d = c(b._value);
          } catch (e) {
            return void a.reject(e);
          }

          a.resolve(d);
        });
      }

      function e(a) {
        try {
          if (a === this) throw new TypeError("A promise cannot be resolved with itself.");

          if (a && ("object" == typeof a || "function" == typeof a)) {
            var c = a.then;
            if ("function" == typeof c) return void i(b(c, a), b(e, this), b(f, this));
          }

          this._state = !0, this._value = a, g.call(this);
        } catch (d) {
          f.call(this, d);
        }
      }

      function f(a) {
        this._state = !1, this._value = a, g.call(this);
      }

      function g() {
        for (var a = 0, b = this._deferreds.length; b > a; a++) d.call(this, this._deferreds[a]);

        this._deferreds = null;
      }

      function h(a, b, c, d) {
        this.onFulfilled = "function" == typeof a ? a : null, this.onRejected = "function" == typeof b ? b : null, this.resolve = c, this.reject = d;
      }

      function i(a, b, c) {
        var d = !1;

        try {
          a(function (a) {
            d || (d = !0, b(a));
          }, function (a) {
            d || (d = !0, c(a));
          });
        } catch (e) {
          if (d) return;
          d = !0, c(e);
        }
      }

      var j = c.immediateFn || "function" == typeof setImmediate && setImmediate || function (a) {
        setTimeout(a, 1);
      },
          k = Array.isArray || function (a) {
        return "[object Array]" === Object.prototype.toString.call(a);
      };

      c.prototype["catch"] = function (a) {
        return this.then(null, a);
      }, c.prototype.then = function (a, b) {
        var e = this;
        return new c(function (c, f) {
          d.call(e, new h(a, b, c, f));
        });
      }, c.all = function () {
        var a = Array.prototype.slice.call(1 === arguments.length && k(arguments[0]) ? arguments[0] : arguments);
        return new c(function (b, c) {
          function d(f, g) {
            try {
              if (g && ("object" == typeof g || "function" == typeof g)) {
                var h = g.then;
                if ("function" == typeof h) return void h.call(g, function (a) {
                  d(f, a);
                }, c);
              }

              a[f] = g, 0 === --e && b(a);
            } catch (i) {
              c(i);
            }
          }

          if (0 === a.length) return b([]);

          for (var e = a.length, f = 0; f < a.length; f++) d(f, a[f]);
        });
      }, c.resolve = function (a) {
        return a && "object" == typeof a && a.constructor === c ? a : new c(function (b) {
          b(a);
        });
      }, c.reject = function (a) {
        return new c(function (b, c) {
          c(a);
        });
      }, c.race = function (a) {
        return new c(function (b, c) {
          for (var d = 0, e = a.length; e > d; d++) a[d].then(b, c);
        });
      },  true && module.exports ? module.exports = c : a.Promise || (a.Promise = c);
    })(this);

    clipboard.copy = function (data) {
      return new Promise(function (resolve, reject) {
        // IE supports string and URL types: https://msdn.microsoft.com/en-us/library/ms536744(v=vs.85).aspx
        // We only support the string type for now.
        if (typeof data !== "string" && !("text/plain" in data)) {
          throw new Error("You must provide a text/plain type.");
        }

        var strData = typeof data === "string" ? data : data["text/plain"];
        var copySucceeded = window.clipboardData.setData("Text", strData);

        if (copySucceeded) {
          resolve();
        } else {
          reject(new Error("Copying was rejected."));
        }
      });
    };

    clipboard.paste = function () {
      return new Promise(function (resolve, reject) {
        var strData = window.clipboardData.getData("Text");

        if (strData) {
          resolve(strData);
        } else {
          // The user rejected the paste request.
          reject(new Error("Pasting was rejected."));
        }
      });
    };
  }

  return clipboard;
});

/***/ }),

/***/ 730:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

 // A linked list to keep track of recently-used-ness

const Yallist = __webpack_require__(695);

const MAX = Symbol('max');
const LENGTH = Symbol('length');
const LENGTH_CALCULATOR = Symbol('lengthCalculator');
const ALLOW_STALE = Symbol('allowStale');
const MAX_AGE = Symbol('maxAge');
const DISPOSE = Symbol('dispose');
const NO_DISPOSE_ON_SET = Symbol('noDisposeOnSet');
const LRU_LIST = Symbol('lruList');
const CACHE = Symbol('cache');
const UPDATE_AGE_ON_GET = Symbol('updateAgeOnGet');

const naiveLength = () => 1; // lruList is a yallist where the head is the youngest
// item, and the tail is the oldest.  the list contains the Hit
// objects as the entries.
// Each Hit object has a reference to its Yallist.Node.  This
// never changes.
//
// cache is a Map (or PseudoMap) that matches the keys to
// the Yallist.Node object.


class LRUCache {
  constructor(options) {
    if (typeof options === 'number') options = {
      max: options
    };
    if (!options) options = {};
    if (options.max && (typeof options.max !== 'number' || options.max < 0)) throw new TypeError('max must be a non-negative number'); // Kind of weird to have a default max of Infinity, but oh well.

    const max = this[MAX] = options.max || Infinity;
    const lc = options.length || naiveLength;
    this[LENGTH_CALCULATOR] = typeof lc !== 'function' ? naiveLength : lc;
    this[ALLOW_STALE] = options.stale || false;
    if (options.maxAge && typeof options.maxAge !== 'number') throw new TypeError('maxAge must be a number');
    this[MAX_AGE] = options.maxAge || 0;
    this[DISPOSE] = options.dispose;
    this[NO_DISPOSE_ON_SET] = options.noDisposeOnSet || false;
    this[UPDATE_AGE_ON_GET] = options.updateAgeOnGet || false;
    this.reset();
  } // resize the cache when the max changes.


  set max(mL) {
    if (typeof mL !== 'number' || mL < 0) throw new TypeError('max must be a non-negative number');
    this[MAX] = mL || Infinity;
    trim(this);
  }

  get max() {
    return this[MAX];
  }

  set allowStale(allowStale) {
    this[ALLOW_STALE] = !!allowStale;
  }

  get allowStale() {
    return this[ALLOW_STALE];
  }

  set maxAge(mA) {
    if (typeof mA !== 'number') throw new TypeError('maxAge must be a non-negative number');
    this[MAX_AGE] = mA;
    trim(this);
  }

  get maxAge() {
    return this[MAX_AGE];
  } // resize the cache when the lengthCalculator changes.


  set lengthCalculator(lC) {
    if (typeof lC !== 'function') lC = naiveLength;

    if (lC !== this[LENGTH_CALCULATOR]) {
      this[LENGTH_CALCULATOR] = lC;
      this[LENGTH] = 0;
      this[LRU_LIST].forEach(hit => {
        hit.length = this[LENGTH_CALCULATOR](hit.value, hit.key);
        this[LENGTH] += hit.length;
      });
    }

    trim(this);
  }

  get lengthCalculator() {
    return this[LENGTH_CALCULATOR];
  }

  get length() {
    return this[LENGTH];
  }

  get itemCount() {
    return this[LRU_LIST].length;
  }

  rforEach(fn, thisp) {
    thisp = thisp || this;

    for (let walker = this[LRU_LIST].tail; walker !== null;) {
      const prev = walker.prev;
      forEachStep(this, fn, walker, thisp);
      walker = prev;
    }
  }

  forEach(fn, thisp) {
    thisp = thisp || this;

    for (let walker = this[LRU_LIST].head; walker !== null;) {
      const next = walker.next;
      forEachStep(this, fn, walker, thisp);
      walker = next;
    }
  }

  keys() {
    return this[LRU_LIST].toArray().map(k => k.key);
  }

  values() {
    return this[LRU_LIST].toArray().map(k => k.value);
  }

  reset() {
    if (this[DISPOSE] && this[LRU_LIST] && this[LRU_LIST].length) {
      this[LRU_LIST].forEach(hit => this[DISPOSE](hit.key, hit.value));
    }

    this[CACHE] = new Map(); // hash of items by key

    this[LRU_LIST] = new Yallist(); // list of items in order of use recency

    this[LENGTH] = 0; // length of items in the list
  }

  dump() {
    return this[LRU_LIST].map(hit => isStale(this, hit) ? false : {
      k: hit.key,
      v: hit.value,
      e: hit.now + (hit.maxAge || 0)
    }).toArray().filter(h => h);
  }

  dumpLru() {
    return this[LRU_LIST];
  }

  set(key, value, maxAge) {
    maxAge = maxAge || this[MAX_AGE];
    if (maxAge && typeof maxAge !== 'number') throw new TypeError('maxAge must be a number');
    const now = maxAge ? Date.now() : 0;
    const len = this[LENGTH_CALCULATOR](value, key);

    if (this[CACHE].has(key)) {
      if (len > this[MAX]) {
        del(this, this[CACHE].get(key));
        return false;
      }

      const node = this[CACHE].get(key);
      const item = node.value; // dispose of the old one before overwriting
      // split out into 2 ifs for better coverage tracking

      if (this[DISPOSE]) {
        if (!this[NO_DISPOSE_ON_SET]) this[DISPOSE](key, item.value);
      }

      item.now = now;
      item.maxAge = maxAge;
      item.value = value;
      this[LENGTH] += len - item.length;
      item.length = len;
      this.get(key);
      trim(this);
      return true;
    }

    const hit = new Entry(key, value, len, now, maxAge); // oversized objects fall out of cache automatically.

    if (hit.length > this[MAX]) {
      if (this[DISPOSE]) this[DISPOSE](key, value);
      return false;
    }

    this[LENGTH] += hit.length;
    this[LRU_LIST].unshift(hit);
    this[CACHE].set(key, this[LRU_LIST].head);
    trim(this);
    return true;
  }

  has(key) {
    if (!this[CACHE].has(key)) return false;
    const hit = this[CACHE].get(key).value;
    return !isStale(this, hit);
  }

  get(key) {
    return get(this, key, true);
  }

  peek(key) {
    return get(this, key, false);
  }

  pop() {
    const node = this[LRU_LIST].tail;
    if (!node) return null;
    del(this, node);
    return node.value;
  }

  del(key) {
    del(this, this[CACHE].get(key));
  }

  load(arr) {
    // reset the cache
    this.reset();
    const now = Date.now(); // A previous serialized cache has the most recent items first

    for (let l = arr.length - 1; l >= 0; l--) {
      const hit = arr[l];
      const expiresAt = hit.e || 0;
      if (expiresAt === 0) // the item was created without expiration in a non aged cache
        this.set(hit.k, hit.v);else {
        const maxAge = expiresAt - now; // dont add already expired items

        if (maxAge > 0) {
          this.set(hit.k, hit.v, maxAge);
        }
      }
    }
  }

  prune() {
    this[CACHE].forEach((value, key) => get(this, key, false));
  }

}

const get = (self, key, doUse) => {
  const node = self[CACHE].get(key);

  if (node) {
    const hit = node.value;

    if (isStale(self, hit)) {
      del(self, node);
      if (!self[ALLOW_STALE]) return undefined;
    } else {
      if (doUse) {
        if (self[UPDATE_AGE_ON_GET]) node.value.now = Date.now();
        self[LRU_LIST].unshiftNode(node);
      }
    }

    return hit.value;
  }
};

const isStale = (self, hit) => {
  if (!hit || !hit.maxAge && !self[MAX_AGE]) return false;
  const diff = Date.now() - hit.now;
  return hit.maxAge ? diff > hit.maxAge : self[MAX_AGE] && diff > self[MAX_AGE];
};

const trim = self => {
  if (self[LENGTH] > self[MAX]) {
    for (let walker = self[LRU_LIST].tail; self[LENGTH] > self[MAX] && walker !== null;) {
      // We know that we're about to delete this one, and also
      // what the next least recently used key will be, so just
      // go ahead and set it now.
      const prev = walker.prev;
      del(self, walker);
      walker = prev;
    }
  }
};

const del = (self, node) => {
  if (node) {
    const hit = node.value;
    if (self[DISPOSE]) self[DISPOSE](hit.key, hit.value);
    self[LENGTH] -= hit.length;
    self[CACHE].delete(hit.key);
    self[LRU_LIST].removeNode(node);
  }
};

class Entry {
  constructor(key, value, length, now, maxAge) {
    this.key = key;
    this.value = value;
    this.length = length;
    this.now = now;
    this.maxAge = maxAge || 0;
  }

}

const forEachStep = (self, fn, node, thisp) => {
  let hit = node.value;

  if (isStale(self, hit)) {
    del(self, node);
    if (!self[ALLOW_STALE]) hit = undefined;
  }

  if (hit) fn.call(thisp, hit.value, hit.key, self);
};

module.exports = LRUCache;

/***/ }),

/***/ 169:
/***/ ((module) => {

// shim for using process in browser
var process = module.exports = {}; // cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
  throw new Error('setTimeout has not been defined');
}

function defaultClearTimeout() {
  throw new Error('clearTimeout has not been defined');
}

(function () {
  try {
    if (typeof setTimeout === 'function') {
      cachedSetTimeout = setTimeout;
    } else {
      cachedSetTimeout = defaultSetTimout;
    }
  } catch (e) {
    cachedSetTimeout = defaultSetTimout;
  }

  try {
    if (typeof clearTimeout === 'function') {
      cachedClearTimeout = clearTimeout;
    } else {
      cachedClearTimeout = defaultClearTimeout;
    }
  } catch (e) {
    cachedClearTimeout = defaultClearTimeout;
  }
})();

function runTimeout(fun) {
  if (cachedSetTimeout === setTimeout) {
    //normal enviroments in sane situations
    return setTimeout(fun, 0);
  } // if setTimeout wasn't available but was latter defined


  if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
    cachedSetTimeout = setTimeout;
    return setTimeout(fun, 0);
  }

  try {
    // when when somebody has screwed with setTimeout but no I.E. maddness
    return cachedSetTimeout(fun, 0);
  } catch (e) {
    try {
      // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
      return cachedSetTimeout.call(null, fun, 0);
    } catch (e) {
      // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
      return cachedSetTimeout.call(this, fun, 0);
    }
  }
}

function runClearTimeout(marker) {
  if (cachedClearTimeout === clearTimeout) {
    //normal enviroments in sane situations
    return clearTimeout(marker);
  } // if clearTimeout wasn't available but was latter defined


  if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
    cachedClearTimeout = clearTimeout;
    return clearTimeout(marker);
  }

  try {
    // when when somebody has screwed with setTimeout but no I.E. maddness
    return cachedClearTimeout(marker);
  } catch (e) {
    try {
      // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
      return cachedClearTimeout.call(null, marker);
    } catch (e) {
      // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
      // Some versions of I.E. have different rules for clearTimeout vs setTimeout
      return cachedClearTimeout.call(this, marker);
    }
  }
}

var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
  if (!draining || !currentQueue) {
    return;
  }

  draining = false;

  if (currentQueue.length) {
    queue = currentQueue.concat(queue);
  } else {
    queueIndex = -1;
  }

  if (queue.length) {
    drainQueue();
  }
}

function drainQueue() {
  if (draining) {
    return;
  }

  var timeout = runTimeout(cleanUpNextTick);
  draining = true;
  var len = queue.length;

  while (len) {
    currentQueue = queue;
    queue = [];

    while (++queueIndex < len) {
      if (currentQueue) {
        currentQueue[queueIndex].run();
      }
    }

    queueIndex = -1;
    len = queue.length;
  }

  currentQueue = null;
  draining = false;
  runClearTimeout(timeout);
}

process.nextTick = function (fun) {
  var args = new Array(arguments.length - 1);

  if (arguments.length > 1) {
    for (var i = 1; i < arguments.length; i++) {
      args[i - 1] = arguments[i];
    }
  }

  queue.push(new Item(fun, args));

  if (queue.length === 1 && !draining) {
    runTimeout(drainQueue);
  }
}; // v8 likes predictible objects


function Item(fun, array) {
  this.fun = fun;
  this.array = array;
}

Item.prototype.run = function () {
  this.fun.apply(null, this.array);
};

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues

process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) {
  return [];
};

process.binding = function (name) {
  throw new Error('process.binding is not supported');
};

process.cwd = function () {
  return '/';
};

process.chdir = function (dir) {
  throw new Error('process.chdir is not supported');
};

process.umask = function () {
  return 0;
};

/***/ }),

/***/ 718:
/***/ ((module) => {

if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor;
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor;

    var TempCtor = function () {};

    TempCtor.prototype = superCtor.prototype;
    ctor.prototype = new TempCtor();
    ctor.prototype.constructor = ctor;
  };
}

/***/ }),

/***/ 715:
/***/ ((module) => {

module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object' && typeof arg.copy === 'function' && typeof arg.fill === 'function' && typeof arg.readUInt8 === 'function';
};

/***/ }),

/***/ 82:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

/* provided dependency */ var process = __webpack_require__(169);
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.
var formatRegExp = /%[sdj%]/g;

exports.format = function (f) {
  if (!isString(f)) {
    var objects = [];

    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }

    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function (x) {
    if (x === '%%') return '%';
    if (i >= len) return x;

    switch (x) {
      case '%s':
        return String(args[i++]);

      case '%d':
        return Number(args[i++]);

      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }

      default:
        return x;
    }
  });

  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }

  return str;
}; // Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.


exports.deprecate = function (fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function () {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;

  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }

      warned = true;
    }

    return fn.apply(this, arguments);
  }

  return deprecated;
};

var debugs = {};
var debugEnviron;

exports.debuglog = function (set) {
  if (isUndefined(debugEnviron)) debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();

  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;

      debugs[set] = function () {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function () {};
    }
  }

  return debugs[set];
};
/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */

/* legacy: obj, showHidden, depth, colors*/


function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  }; // legacy...

  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];

  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  } // set default options


  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}

exports.inspect = inspect; // http://en.wikipedia.org/wiki/ANSI_escape_code#graphics

inspect.colors = {
  'bold': [1, 22],
  'italic': [3, 23],
  'underline': [4, 24],
  'inverse': [7, 27],
  'white': [37, 39],
  'grey': [90, 39],
  'black': [30, 39],
  'blue': [34, 39],
  'cyan': [36, 39],
  'green': [32, 39],
  'magenta': [35, 39],
  'red': [31, 39],
  'yellow': [33, 39]
}; // Don't use 'blue' not visible on cmd.exe

inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};

function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str + '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}

function stylizeNoColor(str, styleType) {
  return str;
}

function arrayToHash(array) {
  var hash = {};
  array.forEach(function (val, idx) {
    hash[val] = true;
  });
  return hash;
}

function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect && value && isFunction(value.inspect) && // Filter out the util module, it's inspect function is special
  value.inspect !== exports.inspect && // Also filter out any prototype objects using the circular check.
  !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);

    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }

    return ret;
  } // Primitive types cannot have properties


  var primitive = formatPrimitive(ctx, value);

  if (primitive) {
    return primitive;
  } // Look up the keys of the object.


  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  } // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx


  if (isError(value) && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  } // Some type of object without properties can be shortcutted.


  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }

    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }

    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }

    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '',
      array = false,
      braces = ['{', '}']; // Make Array say that they are Array

  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  } // Make functions say that they are functions


  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  } // Make RegExps say that they are RegExps


  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  } // Make dates with properties first say the date


  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  } // Make error with message first say the error


  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);
  var output;

  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function (key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();
  return reduceToSingleString(output, base, braces);
}

function formatPrimitive(ctx, value) {
  if (isUndefined(value)) return ctx.stylize('undefined', 'undefined');

  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '').replace(/'/g, "\\'").replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }

  if (isNumber(value)) return ctx.stylize('' + value, 'number');
  if (isBoolean(value)) return ctx.stylize('' + value, 'boolean'); // For some reason typeof null is "object", so special case here.

  if (isNull(value)) return ctx.stylize('null', 'null');
}

function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}

function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];

  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys, String(i), true));
    } else {
      output.push('');
    }
  }

  keys.forEach(function (key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys, key, true));
    }
  });
  return output;
}

function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || {
    value: value[key]
  };

  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }

  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }

  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }

      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function (line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function (line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }

  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }

    name = JSON.stringify('' + key);

    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'").replace(/\\"/g, '"').replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}

function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function (prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] + (base === '' ? '' : base + '\n ') + ' ' + output.join(',\n  ') + ' ' + braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
} // NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.


function isArray(ar) {
  return Array.isArray(ar);
}

exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}

exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}

exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}

exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}

exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}

exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}

exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}

exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}

exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}

exports.isDate = isDate;

function isError(e) {
  return isObject(e) && (objectToString(e) === '[object Error]' || e instanceof Error);
}

exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}

exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null || typeof arg === 'boolean' || typeof arg === 'number' || typeof arg === 'string' || typeof arg === 'symbol' || // ES6 symbol
  typeof arg === 'undefined';
}

exports.isPrimitive = isPrimitive;
exports.isBuffer = __webpack_require__(715);

function objectToString(o) {
  return Object.prototype.toString.call(o);
}

function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}

var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; // 26 Feb 16:19:34

function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()), pad(d.getMinutes()), pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
} // log is just a thin wrapper to console.log that prepends a timestamp


exports.log = function () {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};
/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */


exports.inherits = __webpack_require__(718);

exports._extend = function (origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;
  var keys = Object.keys(add);
  var i = keys.length;

  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }

  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

/***/ }),

/***/ 476:
/***/ ((module) => {



module.exports = function (Yallist) {
  Yallist.prototype[Symbol.iterator] = function* () {
    for (let walker = this.head; walker; walker = walker.next) {
      yield walker.value;
    }
  };
};

/***/ }),

/***/ 695:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



module.exports = Yallist;
Yallist.Node = Node;
Yallist.create = Yallist;

function Yallist(list) {
  var self = this;

  if (!(self instanceof Yallist)) {
    self = new Yallist();
  }

  self.tail = null;
  self.head = null;
  self.length = 0;

  if (list && typeof list.forEach === 'function') {
    list.forEach(function (item) {
      self.push(item);
    });
  } else if (arguments.length > 0) {
    for (var i = 0, l = arguments.length; i < l; i++) {
      self.push(arguments[i]);
    }
  }

  return self;
}

Yallist.prototype.removeNode = function (node) {
  if (node.list !== this) {
    throw new Error('removing node which does not belong to this list');
  }

  var next = node.next;
  var prev = node.prev;

  if (next) {
    next.prev = prev;
  }

  if (prev) {
    prev.next = next;
  }

  if (node === this.head) {
    this.head = next;
  }

  if (node === this.tail) {
    this.tail = prev;
  }

  node.list.length--;
  node.next = null;
  node.prev = null;
  node.list = null;
  return next;
};

Yallist.prototype.unshiftNode = function (node) {
  if (node === this.head) {
    return;
  }

  if (node.list) {
    node.list.removeNode(node);
  }

  var head = this.head;
  node.list = this;
  node.next = head;

  if (head) {
    head.prev = node;
  }

  this.head = node;

  if (!this.tail) {
    this.tail = node;
  }

  this.length++;
};

Yallist.prototype.pushNode = function (node) {
  if (node === this.tail) {
    return;
  }

  if (node.list) {
    node.list.removeNode(node);
  }

  var tail = this.tail;
  node.list = this;
  node.prev = tail;

  if (tail) {
    tail.next = node;
  }

  this.tail = node;

  if (!this.head) {
    this.head = node;
  }

  this.length++;
};

Yallist.prototype.push = function () {
  for (var i = 0, l = arguments.length; i < l; i++) {
    push(this, arguments[i]);
  }

  return this.length;
};

Yallist.prototype.unshift = function () {
  for (var i = 0, l = arguments.length; i < l; i++) {
    unshift(this, arguments[i]);
  }

  return this.length;
};

Yallist.prototype.pop = function () {
  if (!this.tail) {
    return undefined;
  }

  var res = this.tail.value;
  this.tail = this.tail.prev;

  if (this.tail) {
    this.tail.next = null;
  } else {
    this.head = null;
  }

  this.length--;
  return res;
};

Yallist.prototype.shift = function () {
  if (!this.head) {
    return undefined;
  }

  var res = this.head.value;
  this.head = this.head.next;

  if (this.head) {
    this.head.prev = null;
  } else {
    this.tail = null;
  }

  this.length--;
  return res;
};

Yallist.prototype.forEach = function (fn, thisp) {
  thisp = thisp || this;

  for (var walker = this.head, i = 0; walker !== null; i++) {
    fn.call(thisp, walker.value, i, this);
    walker = walker.next;
  }
};

Yallist.prototype.forEachReverse = function (fn, thisp) {
  thisp = thisp || this;

  for (var walker = this.tail, i = this.length - 1; walker !== null; i--) {
    fn.call(thisp, walker.value, i, this);
    walker = walker.prev;
  }
};

Yallist.prototype.get = function (n) {
  for (var i = 0, walker = this.head; walker !== null && i < n; i++) {
    // abort out of the list early if we hit a cycle
    walker = walker.next;
  }

  if (i === n && walker !== null) {
    return walker.value;
  }
};

Yallist.prototype.getReverse = function (n) {
  for (var i = 0, walker = this.tail; walker !== null && i < n; i++) {
    // abort out of the list early if we hit a cycle
    walker = walker.prev;
  }

  if (i === n && walker !== null) {
    return walker.value;
  }
};

Yallist.prototype.map = function (fn, thisp) {
  thisp = thisp || this;
  var res = new Yallist();

  for (var walker = this.head; walker !== null;) {
    res.push(fn.call(thisp, walker.value, this));
    walker = walker.next;
  }

  return res;
};

Yallist.prototype.mapReverse = function (fn, thisp) {
  thisp = thisp || this;
  var res = new Yallist();

  for (var walker = this.tail; walker !== null;) {
    res.push(fn.call(thisp, walker.value, this));
    walker = walker.prev;
  }

  return res;
};

Yallist.prototype.reduce = function (fn, initial) {
  var acc;
  var walker = this.head;

  if (arguments.length > 1) {
    acc = initial;
  } else if (this.head) {
    walker = this.head.next;
    acc = this.head.value;
  } else {
    throw new TypeError('Reduce of empty list with no initial value');
  }

  for (var i = 0; walker !== null; i++) {
    acc = fn(acc, walker.value, i);
    walker = walker.next;
  }

  return acc;
};

Yallist.prototype.reduceReverse = function (fn, initial) {
  var acc;
  var walker = this.tail;

  if (arguments.length > 1) {
    acc = initial;
  } else if (this.tail) {
    walker = this.tail.prev;
    acc = this.tail.value;
  } else {
    throw new TypeError('Reduce of empty list with no initial value');
  }

  for (var i = this.length - 1; walker !== null; i--) {
    acc = fn(acc, walker.value, i);
    walker = walker.prev;
  }

  return acc;
};

Yallist.prototype.toArray = function () {
  var arr = new Array(this.length);

  for (var i = 0, walker = this.head; walker !== null; i++) {
    arr[i] = walker.value;
    walker = walker.next;
  }

  return arr;
};

Yallist.prototype.toArrayReverse = function () {
  var arr = new Array(this.length);

  for (var i = 0, walker = this.tail; walker !== null; i++) {
    arr[i] = walker.value;
    walker = walker.prev;
  }

  return arr;
};

Yallist.prototype.slice = function (from, to) {
  to = to || this.length;

  if (to < 0) {
    to += this.length;
  }

  from = from || 0;

  if (from < 0) {
    from += this.length;
  }

  var ret = new Yallist();

  if (to < from || to < 0) {
    return ret;
  }

  if (from < 0) {
    from = 0;
  }

  if (to > this.length) {
    to = this.length;
  }

  for (var i = 0, walker = this.head; walker !== null && i < from; i++) {
    walker = walker.next;
  }

  for (; walker !== null && i < to; i++, walker = walker.next) {
    ret.push(walker.value);
  }

  return ret;
};

Yallist.prototype.sliceReverse = function (from, to) {
  to = to || this.length;

  if (to < 0) {
    to += this.length;
  }

  from = from || 0;

  if (from < 0) {
    from += this.length;
  }

  var ret = new Yallist();

  if (to < from || to < 0) {
    return ret;
  }

  if (from < 0) {
    from = 0;
  }

  if (to > this.length) {
    to = this.length;
  }

  for (var i = this.length, walker = this.tail; walker !== null && i > to; i--) {
    walker = walker.prev;
  }

  for (; walker !== null && i > from; i--, walker = walker.prev) {
    ret.push(walker.value);
  }

  return ret;
};

Yallist.prototype.splice = function (start, deleteCount
/*, ...nodes */
) {
  if (start > this.length) {
    start = this.length - 1;
  }

  if (start < 0) {
    start = this.length + start;
  }

  for (var i = 0, walker = this.head; walker !== null && i < start; i++) {
    walker = walker.next;
  }

  var ret = [];

  for (var i = 0; walker && i < deleteCount; i++) {
    ret.push(walker.value);
    walker = this.removeNode(walker);
  }

  if (walker === null) {
    walker = this.tail;
  }

  if (walker !== this.head && walker !== this.tail) {
    walker = walker.prev;
  }

  for (var i = 2; i < arguments.length; i++) {
    walker = insert(this, walker, arguments[i]);
  }

  return ret;
};

Yallist.prototype.reverse = function () {
  var head = this.head;
  var tail = this.tail;

  for (var walker = head; walker !== null; walker = walker.prev) {
    var p = walker.prev;
    walker.prev = walker.next;
    walker.next = p;
  }

  this.head = tail;
  this.tail = head;
  return this;
};

function insert(self, node, value) {
  var inserted = node === self.head ? new Node(value, null, node, self) : new Node(value, node, node.next, self);

  if (inserted.next === null) {
    self.tail = inserted;
  }

  if (inserted.prev === null) {
    self.head = inserted;
  }

  self.length++;
  return inserted;
}

function push(self, item) {
  self.tail = new Node(item, self.tail, null, self);

  if (!self.head) {
    self.head = self.tail;
  }

  self.length++;
}

function unshift(self, item) {
  self.head = new Node(item, null, self.head, self);

  if (!self.tail) {
    self.tail = self.head;
  }

  self.length++;
}

function Node(value, prev, next, list) {
  if (!(this instanceof Node)) {
    return new Node(value, prev, next, list);
  }

  this.list = list;
  this.value = value;

  if (prev) {
    prev.next = this;
    this.prev = prev;
  } else {
    this.prev = null;
  }

  if (next) {
    next.prev = this;
    this.next = next;
  } else {
    this.next = null;
  }
}

try {
  // add if support for Symbol.iterator is present
  __webpack_require__(476)(Yallist);
} catch (er) {}

/***/ }),

/***/ 74:
/***/ (function(module) {

(function (global, factory) {
   true ? module.exports = factory() : 0;
})(this, function () {
  'use strict';

  function createCommonjsModule(fn, module) {
    return module = {
      exports: {}
    }, fn(module, module.exports), module.exports;
  }

  var _global = createCommonjsModule(function (module) {
    // https://github.com/zloirock/core-js/issues/86#issuecomment-115759028
    var global = module.exports = typeof window != 'undefined' && window.Math == Math ? window : typeof self != 'undefined' && self.Math == Math ? self // eslint-disable-next-line no-new-func
    : Function('return this')();

    if (typeof __g == 'number') {
      __g = global;
    } // eslint-disable-line no-undef

  });

  var _core = createCommonjsModule(function (module) {
    var core = module.exports = {
      version: '2.6.5'
    };

    if (typeof __e == 'number') {
      __e = core;
    } // eslint-disable-line no-undef

  });

  var _core_1 = _core.version;

  var _isObject = function (it) {
    return typeof it === 'object' ? it !== null : typeof it === 'function';
  };

  var _anObject = function (it) {
    if (!_isObject(it)) {
      throw TypeError(it + ' is not an object!');
    }

    return it;
  };

  var _fails = function (exec) {
    try {
      return !!exec();
    } catch (e) {
      return true;
    }
  }; // Thank's IE8 for his funny defineProperty


  var _descriptors = !_fails(function () {
    return Object.defineProperty({}, 'a', {
      get: function () {
        return 7;
      }
    }).a != 7;
  });

  var document = _global.document; // typeof document.createElement is 'object' in old IE

  var is = _isObject(document) && _isObject(document.createElement);

  var _domCreate = function (it) {
    return is ? document.createElement(it) : {};
  };

  var _ie8DomDefine = !_descriptors && !_fails(function () {
    return Object.defineProperty(_domCreate('div'), 'a', {
      get: function () {
        return 7;
      }
    }).a != 7;
  }); // 7.1.1 ToPrimitive(input [, PreferredType])
  // instead of the ES6 spec version, we didn't implement @@toPrimitive case
  // and the second argument - flag - preferred type is a string


  var _toPrimitive = function (it, S) {
    if (!_isObject(it)) {
      return it;
    }

    var fn, val;

    if (S && typeof (fn = it.toString) == 'function' && !_isObject(val = fn.call(it))) {
      return val;
    }

    if (typeof (fn = it.valueOf) == 'function' && !_isObject(val = fn.call(it))) {
      return val;
    }

    if (!S && typeof (fn = it.toString) == 'function' && !_isObject(val = fn.call(it))) {
      return val;
    }

    throw TypeError("Can't convert object to primitive value");
  };

  var dP = Object.defineProperty;
  var f = _descriptors ? Object.defineProperty : function defineProperty(O, P, Attributes) {
    _anObject(O);

    P = _toPrimitive(P, true);

    _anObject(Attributes);

    if (_ie8DomDefine) {
      try {
        return dP(O, P, Attributes);
      } catch (e) {
        /* empty */
      }
    }

    if ('get' in Attributes || 'set' in Attributes) {
      throw TypeError('Accessors not supported!');
    }

    if ('value' in Attributes) {
      O[P] = Attributes.value;
    }

    return O;
  };
  var _objectDp = {
    f: f
  };

  var _propertyDesc = function (bitmap, value) {
    return {
      enumerable: !(bitmap & 1),
      configurable: !(bitmap & 2),
      writable: !(bitmap & 4),
      value: value
    };
  };

  var _hide = _descriptors ? function (object, key, value) {
    return _objectDp.f(object, key, _propertyDesc(1, value));
  } : function (object, key, value) {
    object[key] = value;
    return object;
  };

  var hasOwnProperty = {}.hasOwnProperty;

  var _has = function (it, key) {
    return hasOwnProperty.call(it, key);
  };

  var id = 0;
  var px = Math.random();

  var _uid = function (key) {
    return 'Symbol('.concat(key === undefined ? '' : key, ')_', (++id + px).toString(36));
  };

  var _library = false;

  var _shared = createCommonjsModule(function (module) {
    var SHARED = '__core-js_shared__';
    var store = _global[SHARED] || (_global[SHARED] = {});
    (module.exports = function (key, value) {
      return store[key] || (store[key] = value !== undefined ? value : {});
    })('versions', []).push({
      version: _core.version,
      mode: _library ? 'pure' : 'global',
      copyright: '© 2019 Denis Pushkarev (zloirock.ru)'
    });
  });

  var _functionToString = _shared('native-function-to-string', Function.toString);

  var _redefine = createCommonjsModule(function (module) {
    var SRC = _uid('src');

    var TO_STRING = 'toString';

    var TPL = ('' + _functionToString).split(TO_STRING);

    _core.inspectSource = function (it) {
      return _functionToString.call(it);
    };

    (module.exports = function (O, key, val, safe) {
      var isFunction = typeof val == 'function';

      if (isFunction) {
        _has(val, 'name') || _hide(val, 'name', key);
      }

      if (O[key] === val) {
        return;
      }

      if (isFunction) {
        _has(val, SRC) || _hide(val, SRC, O[key] ? '' + O[key] : TPL.join(String(key)));
      }

      if (O === _global) {
        O[key] = val;
      } else if (!safe) {
        delete O[key];

        _hide(O, key, val);
      } else if (O[key]) {
        O[key] = val;
      } else {
        _hide(O, key, val);
      } // add fake Function#toString for correct work wrapped methods / constructors with methods like LoDash isNative

    })(Function.prototype, TO_STRING, function toString() {
      return typeof this == 'function' && this[SRC] || _functionToString.call(this);
    });
  });

  var _aFunction = function (it) {
    if (typeof it != 'function') {
      throw TypeError(it + ' is not a function!');
    }

    return it;
  }; // optional / simple context binding


  var _ctx = function (fn, that, length) {
    _aFunction(fn);

    if (that === undefined) {
      return fn;
    }

    switch (length) {
      case 1:
        return function (a) {
          return fn.call(that, a);
        };

      case 2:
        return function (a, b) {
          return fn.call(that, a, b);
        };

      case 3:
        return function (a, b, c) {
          return fn.call(that, a, b, c);
        };
    }

    return function () {
      return fn.apply(that, arguments);
    };
  };

  var PROTOTYPE = 'prototype';

  var $export = function (type, name, source) {
    var IS_FORCED = type & $export.F;
    var IS_GLOBAL = type & $export.G;
    var IS_STATIC = type & $export.S;
    var IS_PROTO = type & $export.P;
    var IS_BIND = type & $export.B;
    var target = IS_GLOBAL ? _global : IS_STATIC ? _global[name] || (_global[name] = {}) : (_global[name] || {})[PROTOTYPE];
    var exports = IS_GLOBAL ? _core : _core[name] || (_core[name] = {});
    var expProto = exports[PROTOTYPE] || (exports[PROTOTYPE] = {});
    var key, own, out, exp;

    if (IS_GLOBAL) {
      source = name;
    }

    for (key in source) {
      // contains in native
      own = !IS_FORCED && target && target[key] !== undefined; // export native or passed

      out = (own ? target : source)[key]; // bind timers to global for call from export context

      exp = IS_BIND && own ? _ctx(out, _global) : IS_PROTO && typeof out == 'function' ? _ctx(Function.call, out) : out; // extend global

      if (target) {
        _redefine(target, key, out, type & $export.U);
      } // export


      if (exports[key] != out) {
        _hide(exports, key, exp);
      }

      if (IS_PROTO && expProto[key] != out) {
        expProto[key] = out;
      }
    }
  };

  _global.core = _core; // type bitmap

  $export.F = 1; // forced

  $export.G = 2; // global

  $export.S = 4; // static

  $export.P = 8; // proto

  $export.B = 16; // bind

  $export.W = 32; // wrap

  $export.U = 64; // safe

  $export.R = 128; // real proto method for `library`

  var _export = $export; // 7.1.4 ToInteger

  var ceil = Math.ceil;
  var floor = Math.floor;

  var _toInteger = function (it) {
    return isNaN(it = +it) ? 0 : (it > 0 ? floor : ceil)(it);
  }; // 7.2.1 RequireObjectCoercible(argument)


  var _defined = function (it) {
    if (it == undefined) {
      throw TypeError("Can't call method on  " + it);
    }

    return it;
  }; // true  -> String#at
  // false -> String#codePointAt


  var _stringAt = function (TO_STRING) {
    return function (that, pos) {
      var s = String(_defined(that));

      var i = _toInteger(pos);

      var l = s.length;
      var a, b;

      if (i < 0 || i >= l) {
        return TO_STRING ? '' : undefined;
      }

      a = s.charCodeAt(i);
      return a < 0xd800 || a > 0xdbff || i + 1 === l || (b = s.charCodeAt(i + 1)) < 0xdc00 || b > 0xdfff ? TO_STRING ? s.charAt(i) : a : TO_STRING ? s.slice(i, i + 2) : (a - 0xd800 << 10) + (b - 0xdc00) + 0x10000;
    };
  };

  var $at = _stringAt(false);

  _export(_export.P, 'String', {
    // 21.1.3.3 String.prototype.codePointAt(pos)
    codePointAt: function codePointAt(pos) {
      return $at(this, pos);
    }
  });

  var codePointAt = _core.String.codePointAt;
  var max = Math.max;
  var min = Math.min;

  var _toAbsoluteIndex = function (index, length) {
    index = _toInteger(index);
    return index < 0 ? max(index + length, 0) : min(index, length);
  };

  var fromCharCode = String.fromCharCode;
  var $fromCodePoint = String.fromCodePoint; // length should be 1, old FF problem

  _export(_export.S + _export.F * (!!$fromCodePoint && $fromCodePoint.length != 1), 'String', {
    // 21.1.2.2 String.fromCodePoint(...codePoints)
    fromCodePoint: function fromCodePoint(x) {
      var arguments$1 = arguments; // eslint-disable-line no-unused-vars

      var res = [];
      var aLen = arguments.length;
      var i = 0;
      var code;

      while (aLen > i) {
        code = +arguments$1[i++];

        if (_toAbsoluteIndex(code, 0x10ffff) !== code) {
          throw RangeError(code + ' is not a valid code point');
        }

        res.push(code < 0x10000 ? fromCharCode(code) : fromCharCode(((code -= 0x10000) >> 10) + 0xd800, code % 0x400 + 0xdc00));
      }

      return res.join('');
    }
  });

  var fromCodePoint = _core.String.fromCodePoint; // This is a generated file. Do not edit.

  var Space_Separator = /[\u1680\u2000-\u200A\u202F\u205F\u3000]/;
  var ID_Start = /[\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u0860-\u086A\u08A0-\u08B4\u08B6-\u08BD\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u09FC\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0AF9\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58-\u0C5A\u0C60\u0C61\u0C80\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D54-\u0D56\u0D5F-\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u1884\u1887-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1C80-\u1C88\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2E2F\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303C\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312E\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FEA\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6EF\uA717-\uA71F\uA722-\uA788\uA78B-\uA7AE\uA7B0-\uA7B7\uA7F7-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA8FD\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB65\uAB70-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]|\uD800[\uDC00-\uDC0B\uDC0D-\uDC26\uDC28-\uDC3A\uDC3C\uDC3D\uDC3F-\uDC4D\uDC50-\uDC5D\uDC80-\uDCFA\uDD40-\uDD74\uDE80-\uDE9C\uDEA0-\uDED0\uDF00-\uDF1F\uDF2D-\uDF4A\uDF50-\uDF75\uDF80-\uDF9D\uDFA0-\uDFC3\uDFC8-\uDFCF\uDFD1-\uDFD5]|\uD801[\uDC00-\uDC9D\uDCB0-\uDCD3\uDCD8-\uDCFB\uDD00-\uDD27\uDD30-\uDD63\uDE00-\uDF36\uDF40-\uDF55\uDF60-\uDF67]|\uD802[\uDC00-\uDC05\uDC08\uDC0A-\uDC35\uDC37\uDC38\uDC3C\uDC3F-\uDC55\uDC60-\uDC76\uDC80-\uDC9E\uDCE0-\uDCF2\uDCF4\uDCF5\uDD00-\uDD15\uDD20-\uDD39\uDD80-\uDDB7\uDDBE\uDDBF\uDE00\uDE10-\uDE13\uDE15-\uDE17\uDE19-\uDE33\uDE60-\uDE7C\uDE80-\uDE9C\uDEC0-\uDEC7\uDEC9-\uDEE4\uDF00-\uDF35\uDF40-\uDF55\uDF60-\uDF72\uDF80-\uDF91]|\uD803[\uDC00-\uDC48\uDC80-\uDCB2\uDCC0-\uDCF2]|\uD804[\uDC03-\uDC37\uDC83-\uDCAF\uDCD0-\uDCE8\uDD03-\uDD26\uDD50-\uDD72\uDD76\uDD83-\uDDB2\uDDC1-\uDDC4\uDDDA\uDDDC\uDE00-\uDE11\uDE13-\uDE2B\uDE80-\uDE86\uDE88\uDE8A-\uDE8D\uDE8F-\uDE9D\uDE9F-\uDEA8\uDEB0-\uDEDE\uDF05-\uDF0C\uDF0F\uDF10\uDF13-\uDF28\uDF2A-\uDF30\uDF32\uDF33\uDF35-\uDF39\uDF3D\uDF50\uDF5D-\uDF61]|\uD805[\uDC00-\uDC34\uDC47-\uDC4A\uDC80-\uDCAF\uDCC4\uDCC5\uDCC7\uDD80-\uDDAE\uDDD8-\uDDDB\uDE00-\uDE2F\uDE44\uDE80-\uDEAA\uDF00-\uDF19]|\uD806[\uDCA0-\uDCDF\uDCFF\uDE00\uDE0B-\uDE32\uDE3A\uDE50\uDE5C-\uDE83\uDE86-\uDE89\uDEC0-\uDEF8]|\uD807[\uDC00-\uDC08\uDC0A-\uDC2E\uDC40\uDC72-\uDC8F\uDD00-\uDD06\uDD08\uDD09\uDD0B-\uDD30\uDD46]|\uD808[\uDC00-\uDF99]|\uD809[\uDC00-\uDC6E\uDC80-\uDD43]|[\uD80C\uD81C-\uD820\uD840-\uD868\uD86A-\uD86C\uD86F-\uD872\uD874-\uD879][\uDC00-\uDFFF]|\uD80D[\uDC00-\uDC2E]|\uD811[\uDC00-\uDE46]|\uD81A[\uDC00-\uDE38\uDE40-\uDE5E\uDED0-\uDEED\uDF00-\uDF2F\uDF40-\uDF43\uDF63-\uDF77\uDF7D-\uDF8F]|\uD81B[\uDF00-\uDF44\uDF50\uDF93-\uDF9F\uDFE0\uDFE1]|\uD821[\uDC00-\uDFEC]|\uD822[\uDC00-\uDEF2]|\uD82C[\uDC00-\uDD1E\uDD70-\uDEFB]|\uD82F[\uDC00-\uDC6A\uDC70-\uDC7C\uDC80-\uDC88\uDC90-\uDC99]|\uD835[\uDC00-\uDC54\uDC56-\uDC9C\uDC9E\uDC9F\uDCA2\uDCA5\uDCA6\uDCA9-\uDCAC\uDCAE-\uDCB9\uDCBB\uDCBD-\uDCC3\uDCC5-\uDD05\uDD07-\uDD0A\uDD0D-\uDD14\uDD16-\uDD1C\uDD1E-\uDD39\uDD3B-\uDD3E\uDD40-\uDD44\uDD46\uDD4A-\uDD50\uDD52-\uDEA5\uDEA8-\uDEC0\uDEC2-\uDEDA\uDEDC-\uDEFA\uDEFC-\uDF14\uDF16-\uDF34\uDF36-\uDF4E\uDF50-\uDF6E\uDF70-\uDF88\uDF8A-\uDFA8\uDFAA-\uDFC2\uDFC4-\uDFCB]|\uD83A[\uDC00-\uDCC4\uDD00-\uDD43]|\uD83B[\uDE00-\uDE03\uDE05-\uDE1F\uDE21\uDE22\uDE24\uDE27\uDE29-\uDE32\uDE34-\uDE37\uDE39\uDE3B\uDE42\uDE47\uDE49\uDE4B\uDE4D-\uDE4F\uDE51\uDE52\uDE54\uDE57\uDE59\uDE5B\uDE5D\uDE5F\uDE61\uDE62\uDE64\uDE67-\uDE6A\uDE6C-\uDE72\uDE74-\uDE77\uDE79-\uDE7C\uDE7E\uDE80-\uDE89\uDE8B-\uDE9B\uDEA1-\uDEA3\uDEA5-\uDEA9\uDEAB-\uDEBB]|\uD869[\uDC00-\uDED6\uDF00-\uDFFF]|\uD86D[\uDC00-\uDF34\uDF40-\uDFFF]|\uD86E[\uDC00-\uDC1D\uDC20-\uDFFF]|\uD873[\uDC00-\uDEA1\uDEB0-\uDFFF]|\uD87A[\uDC00-\uDFE0]|\uD87E[\uDC00-\uDE1D]/;
  var ID_Continue = /[\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0300-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u0483-\u0487\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u05D0-\u05EA\u05F0-\u05F2\u0610-\u061A\u0620-\u0669\u066E-\u06D3\u06D5-\u06DC\u06DF-\u06E8\u06EA-\u06FC\u06FF\u0710-\u074A\u074D-\u07B1\u07C0-\u07F5\u07FA\u0800-\u082D\u0840-\u085B\u0860-\u086A\u08A0-\u08B4\u08B6-\u08BD\u08D4-\u08E1\u08E3-\u0963\u0966-\u096F\u0971-\u0983\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BC-\u09C4\u09C7\u09C8\u09CB-\u09CE\u09D7\u09DC\u09DD\u09DF-\u09E3\u09E6-\u09F1\u09FC\u0A01-\u0A03\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A59-\u0A5C\u0A5E\u0A66-\u0A75\u0A81-\u0A83\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABC-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AD0\u0AE0-\u0AE3\u0AE6-\u0AEF\u0AF9-\u0AFF\u0B01-\u0B03\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3C-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B5C\u0B5D\u0B5F-\u0B63\u0B66-\u0B6F\u0B71\u0B82\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD0\u0BD7\u0BE6-\u0BEF\u0C00-\u0C03\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C58-\u0C5A\u0C60-\u0C63\u0C66-\u0C6F\u0C80-\u0C83\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBC-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CDE\u0CE0-\u0CE3\u0CE6-\u0CEF\u0CF1\u0CF2\u0D00-\u0D03\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D44\u0D46-\u0D48\u0D4A-\u0D4E\u0D54-\u0D57\u0D5F-\u0D63\u0D66-\u0D6F\u0D7A-\u0D7F\u0D82\u0D83\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DE6-\u0DEF\u0DF2\u0DF3\u0E01-\u0E3A\u0E40-\u0E4E\u0E50-\u0E59\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB9\u0EBB-\u0EBD\u0EC0-\u0EC4\u0EC6\u0EC8-\u0ECD\u0ED0-\u0ED9\u0EDC-\u0EDF\u0F00\u0F18\u0F19\u0F20-\u0F29\u0F35\u0F37\u0F39\u0F3E-\u0F47\u0F49-\u0F6C\u0F71-\u0F84\u0F86-\u0F97\u0F99-\u0FBC\u0FC6\u1000-\u1049\u1050-\u109D\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u135D-\u135F\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1714\u1720-\u1734\u1740-\u1753\u1760-\u176C\u176E-\u1770\u1772\u1773\u1780-\u17D3\u17D7\u17DC\u17DD\u17E0-\u17E9\u180B-\u180D\u1810-\u1819\u1820-\u1877\u1880-\u18AA\u18B0-\u18F5\u1900-\u191E\u1920-\u192B\u1930-\u193B\u1946-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u19D0-\u19D9\u1A00-\u1A1B\u1A20-\u1A5E\u1A60-\u1A7C\u1A7F-\u1A89\u1A90-\u1A99\u1AA7\u1AB0-\u1ABD\u1B00-\u1B4B\u1B50-\u1B59\u1B6B-\u1B73\u1B80-\u1BF3\u1C00-\u1C37\u1C40-\u1C49\u1C4D-\u1C7D\u1C80-\u1C88\u1CD0-\u1CD2\u1CD4-\u1CF9\u1D00-\u1DF9\u1DFB-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u203F\u2040\u2054\u2071\u207F\u2090-\u209C\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D7F-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2DE0-\u2DFF\u2E2F\u3005-\u3007\u3021-\u302F\u3031-\u3035\u3038-\u303C\u3041-\u3096\u3099\u309A\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312E\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FEA\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA62B\uA640-\uA66F\uA674-\uA67D\uA67F-\uA6F1\uA717-\uA71F\uA722-\uA788\uA78B-\uA7AE\uA7B0-\uA7B7\uA7F7-\uA827\uA840-\uA873\uA880-\uA8C5\uA8D0-\uA8D9\uA8E0-\uA8F7\uA8FB\uA8FD\uA900-\uA92D\uA930-\uA953\uA960-\uA97C\uA980-\uA9C0\uA9CF-\uA9D9\uA9E0-\uA9FE\uAA00-\uAA36\uAA40-\uAA4D\uAA50-\uAA59\uAA60-\uAA76\uAA7A-\uAAC2\uAADB-\uAADD\uAAE0-\uAAEF\uAAF2-\uAAF6\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB65\uAB70-\uABEA\uABEC\uABED\uABF0-\uABF9\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE00-\uFE0F\uFE20-\uFE2F\uFE33\uFE34\uFE4D-\uFE4F\uFE70-\uFE74\uFE76-\uFEFC\uFF10-\uFF19\uFF21-\uFF3A\uFF3F\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]|\uD800[\uDC00-\uDC0B\uDC0D-\uDC26\uDC28-\uDC3A\uDC3C\uDC3D\uDC3F-\uDC4D\uDC50-\uDC5D\uDC80-\uDCFA\uDD40-\uDD74\uDDFD\uDE80-\uDE9C\uDEA0-\uDED0\uDEE0\uDF00-\uDF1F\uDF2D-\uDF4A\uDF50-\uDF7A\uDF80-\uDF9D\uDFA0-\uDFC3\uDFC8-\uDFCF\uDFD1-\uDFD5]|\uD801[\uDC00-\uDC9D\uDCA0-\uDCA9\uDCB0-\uDCD3\uDCD8-\uDCFB\uDD00-\uDD27\uDD30-\uDD63\uDE00-\uDF36\uDF40-\uDF55\uDF60-\uDF67]|\uD802[\uDC00-\uDC05\uDC08\uDC0A-\uDC35\uDC37\uDC38\uDC3C\uDC3F-\uDC55\uDC60-\uDC76\uDC80-\uDC9E\uDCE0-\uDCF2\uDCF4\uDCF5\uDD00-\uDD15\uDD20-\uDD39\uDD80-\uDDB7\uDDBE\uDDBF\uDE00-\uDE03\uDE05\uDE06\uDE0C-\uDE13\uDE15-\uDE17\uDE19-\uDE33\uDE38-\uDE3A\uDE3F\uDE60-\uDE7C\uDE80-\uDE9C\uDEC0-\uDEC7\uDEC9-\uDEE6\uDF00-\uDF35\uDF40-\uDF55\uDF60-\uDF72\uDF80-\uDF91]|\uD803[\uDC00-\uDC48\uDC80-\uDCB2\uDCC0-\uDCF2]|\uD804[\uDC00-\uDC46\uDC66-\uDC6F\uDC7F-\uDCBA\uDCD0-\uDCE8\uDCF0-\uDCF9\uDD00-\uDD34\uDD36-\uDD3F\uDD50-\uDD73\uDD76\uDD80-\uDDC4\uDDCA-\uDDCC\uDDD0-\uDDDA\uDDDC\uDE00-\uDE11\uDE13-\uDE37\uDE3E\uDE80-\uDE86\uDE88\uDE8A-\uDE8D\uDE8F-\uDE9D\uDE9F-\uDEA8\uDEB0-\uDEEA\uDEF0-\uDEF9\uDF00-\uDF03\uDF05-\uDF0C\uDF0F\uDF10\uDF13-\uDF28\uDF2A-\uDF30\uDF32\uDF33\uDF35-\uDF39\uDF3C-\uDF44\uDF47\uDF48\uDF4B-\uDF4D\uDF50\uDF57\uDF5D-\uDF63\uDF66-\uDF6C\uDF70-\uDF74]|\uD805[\uDC00-\uDC4A\uDC50-\uDC59\uDC80-\uDCC5\uDCC7\uDCD0-\uDCD9\uDD80-\uDDB5\uDDB8-\uDDC0\uDDD8-\uDDDD\uDE00-\uDE40\uDE44\uDE50-\uDE59\uDE80-\uDEB7\uDEC0-\uDEC9\uDF00-\uDF19\uDF1D-\uDF2B\uDF30-\uDF39]|\uD806[\uDCA0-\uDCE9\uDCFF\uDE00-\uDE3E\uDE47\uDE50-\uDE83\uDE86-\uDE99\uDEC0-\uDEF8]|\uD807[\uDC00-\uDC08\uDC0A-\uDC36\uDC38-\uDC40\uDC50-\uDC59\uDC72-\uDC8F\uDC92-\uDCA7\uDCA9-\uDCB6\uDD00-\uDD06\uDD08\uDD09\uDD0B-\uDD36\uDD3A\uDD3C\uDD3D\uDD3F-\uDD47\uDD50-\uDD59]|\uD808[\uDC00-\uDF99]|\uD809[\uDC00-\uDC6E\uDC80-\uDD43]|[\uD80C\uD81C-\uD820\uD840-\uD868\uD86A-\uD86C\uD86F-\uD872\uD874-\uD879][\uDC00-\uDFFF]|\uD80D[\uDC00-\uDC2E]|\uD811[\uDC00-\uDE46]|\uD81A[\uDC00-\uDE38\uDE40-\uDE5E\uDE60-\uDE69\uDED0-\uDEED\uDEF0-\uDEF4\uDF00-\uDF36\uDF40-\uDF43\uDF50-\uDF59\uDF63-\uDF77\uDF7D-\uDF8F]|\uD81B[\uDF00-\uDF44\uDF50-\uDF7E\uDF8F-\uDF9F\uDFE0\uDFE1]|\uD821[\uDC00-\uDFEC]|\uD822[\uDC00-\uDEF2]|\uD82C[\uDC00-\uDD1E\uDD70-\uDEFB]|\uD82F[\uDC00-\uDC6A\uDC70-\uDC7C\uDC80-\uDC88\uDC90-\uDC99\uDC9D\uDC9E]|\uD834[\uDD65-\uDD69\uDD6D-\uDD72\uDD7B-\uDD82\uDD85-\uDD8B\uDDAA-\uDDAD\uDE42-\uDE44]|\uD835[\uDC00-\uDC54\uDC56-\uDC9C\uDC9E\uDC9F\uDCA2\uDCA5\uDCA6\uDCA9-\uDCAC\uDCAE-\uDCB9\uDCBB\uDCBD-\uDCC3\uDCC5-\uDD05\uDD07-\uDD0A\uDD0D-\uDD14\uDD16-\uDD1C\uDD1E-\uDD39\uDD3B-\uDD3E\uDD40-\uDD44\uDD46\uDD4A-\uDD50\uDD52-\uDEA5\uDEA8-\uDEC0\uDEC2-\uDEDA\uDEDC-\uDEFA\uDEFC-\uDF14\uDF16-\uDF34\uDF36-\uDF4E\uDF50-\uDF6E\uDF70-\uDF88\uDF8A-\uDFA8\uDFAA-\uDFC2\uDFC4-\uDFCB\uDFCE-\uDFFF]|\uD836[\uDE00-\uDE36\uDE3B-\uDE6C\uDE75\uDE84\uDE9B-\uDE9F\uDEA1-\uDEAF]|\uD838[\uDC00-\uDC06\uDC08-\uDC18\uDC1B-\uDC21\uDC23\uDC24\uDC26-\uDC2A]|\uD83A[\uDC00-\uDCC4\uDCD0-\uDCD6\uDD00-\uDD4A\uDD50-\uDD59]|\uD83B[\uDE00-\uDE03\uDE05-\uDE1F\uDE21\uDE22\uDE24\uDE27\uDE29-\uDE32\uDE34-\uDE37\uDE39\uDE3B\uDE42\uDE47\uDE49\uDE4B\uDE4D-\uDE4F\uDE51\uDE52\uDE54\uDE57\uDE59\uDE5B\uDE5D\uDE5F\uDE61\uDE62\uDE64\uDE67-\uDE6A\uDE6C-\uDE72\uDE74-\uDE77\uDE79-\uDE7C\uDE7E\uDE80-\uDE89\uDE8B-\uDE9B\uDEA1-\uDEA3\uDEA5-\uDEA9\uDEAB-\uDEBB]|\uD869[\uDC00-\uDED6\uDF00-\uDFFF]|\uD86D[\uDC00-\uDF34\uDF40-\uDFFF]|\uD86E[\uDC00-\uDC1D\uDC20-\uDFFF]|\uD873[\uDC00-\uDEA1\uDEB0-\uDFFF]|\uD87A[\uDC00-\uDFE0]|\uD87E[\uDC00-\uDE1D]|\uDB40[\uDD00-\uDDEF]/;
  var unicode = {
    Space_Separator: Space_Separator,
    ID_Start: ID_Start,
    ID_Continue: ID_Continue
  };
  var util = {
    isSpaceSeparator: function isSpaceSeparator(c) {
      return typeof c === 'string' && unicode.Space_Separator.test(c);
    },
    isIdStartChar: function isIdStartChar(c) {
      return typeof c === 'string' && (c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c === '$' || c === '_' || unicode.ID_Start.test(c));
    },
    isIdContinueChar: function isIdContinueChar(c) {
      return typeof c === 'string' && (c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || c === '$' || c === '_' || c === '\u200C' || c === '\u200D' || unicode.ID_Continue.test(c));
    },
    isDigit: function isDigit(c) {
      return typeof c === 'string' && /[0-9]/.test(c);
    },
    isHexDigit: function isHexDigit(c) {
      return typeof c === 'string' && /[0-9A-Fa-f]/.test(c);
    }
  };
  var source;
  var parseState;
  var stack;
  var pos;
  var line;
  var column;
  var token;
  var key;
  var root;

  var parse = function parse(text, reviver) {
    source = String(text);
    parseState = 'start';
    stack = [];
    pos = 0;
    line = 1;
    column = 0;
    token = undefined;
    key = undefined;
    root = undefined;

    do {
      token = lex(); // This code is unreachable.
      // if (!parseStates[parseState]) {
      //     throw invalidParseState()
      // }

      parseStates[parseState]();
    } while (token.type !== 'eof');

    if (typeof reviver === 'function') {
      return internalize({
        '': root
      }, '', reviver);
    }

    return root;
  };

  function internalize(holder, name, reviver) {
    var value = holder[name];

    if (value != null && typeof value === 'object') {
      for (var key in value) {
        var replacement = internalize(value, key, reviver);

        if (replacement === undefined) {
          delete value[key];
        } else {
          value[key] = replacement;
        }
      }
    }

    return reviver.call(holder, name, value);
  }

  var lexState;
  var buffer;
  var doubleQuote;
  var sign;
  var c;

  function lex() {
    lexState = 'default';
    buffer = '';
    doubleQuote = false;
    sign = 1;

    for (;;) {
      c = peek(); // This code is unreachable.
      // if (!lexStates[lexState]) {
      //     throw invalidLexState(lexState)
      // }

      var token = lexStates[lexState]();

      if (token) {
        return token;
      }
    }
  }

  function peek() {
    if (source[pos]) {
      return String.fromCodePoint(source.codePointAt(pos));
    }
  }

  function read() {
    var c = peek();

    if (c === '\n') {
      line++;
      column = 0;
    } else if (c) {
      column += c.length;
    } else {
      column++;
    }

    if (c) {
      pos += c.length;
    }

    return c;
  }

  var lexStates = {
    default: function default$1() {
      switch (c) {
        case '\t':
        case '\v':
        case '\f':
        case ' ':
        case '\u00A0':
        case '\uFEFF':
        case '\n':
        case '\r':
        case '\u2028':
        case '\u2029':
          read();
          return;

        case '/':
          read();
          lexState = 'comment';
          return;

        case undefined:
          read();
          return newToken('eof');
      }

      if (util.isSpaceSeparator(c)) {
        read();
        return;
      } // This code is unreachable.
      // if (!lexStates[parseState]) {
      //     throw invalidLexState(parseState)
      // }


      return lexStates[parseState]();
    },
    comment: function comment() {
      switch (c) {
        case '*':
          read();
          lexState = 'multiLineComment';
          return;

        case '/':
          read();
          lexState = 'singleLineComment';
          return;
      }

      throw invalidChar(read());
    },
    multiLineComment: function multiLineComment() {
      switch (c) {
        case '*':
          read();
          lexState = 'multiLineCommentAsterisk';
          return;

        case undefined:
          throw invalidChar(read());
      }

      read();
    },
    multiLineCommentAsterisk: function multiLineCommentAsterisk() {
      switch (c) {
        case '*':
          read();
          return;

        case '/':
          read();
          lexState = 'default';
          return;

        case undefined:
          throw invalidChar(read());
      }

      read();
      lexState = 'multiLineComment';
    },
    singleLineComment: function singleLineComment() {
      switch (c) {
        case '\n':
        case '\r':
        case '\u2028':
        case '\u2029':
          read();
          lexState = 'default';
          return;

        case undefined:
          read();
          return newToken('eof');
      }

      read();
    },
    value: function value() {
      switch (c) {
        case '{':
        case '[':
          return newToken('punctuator', read());

        case 'n':
          read();
          literal('ull');
          return newToken('null', null);

        case 't':
          read();
          literal('rue');
          return newToken('boolean', true);

        case 'f':
          read();
          literal('alse');
          return newToken('boolean', false);

        case '-':
        case '+':
          if (read() === '-') {
            sign = -1;
          }

          lexState = 'sign';
          return;

        case '.':
          buffer = read();
          lexState = 'decimalPointLeading';
          return;

        case '0':
          buffer = read();
          lexState = 'zero';
          return;

        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          buffer = read();
          lexState = 'decimalInteger';
          return;

        case 'I':
          read();
          literal('nfinity');
          return newToken('numeric', Infinity);

        case 'N':
          read();
          literal('aN');
          return newToken('numeric', NaN);

        case '"':
        case "'":
          doubleQuote = read() === '"';
          buffer = '';
          lexState = 'string';
          return;
      }

      throw invalidChar(read());
    },
    identifierNameStartEscape: function identifierNameStartEscape() {
      if (c !== 'u') {
        throw invalidChar(read());
      }

      read();
      var u = unicodeEscape();

      switch (u) {
        case '$':
        case '_':
          break;

        default:
          if (!util.isIdStartChar(u)) {
            throw invalidIdentifier();
          }

          break;
      }

      buffer += u;
      lexState = 'identifierName';
    },
    identifierName: function identifierName() {
      switch (c) {
        case '$':
        case '_':
        case '\u200C':
        case '\u200D':
          buffer += read();
          return;

        case '\\':
          read();
          lexState = 'identifierNameEscape';
          return;
      }

      if (util.isIdContinueChar(c)) {
        buffer += read();
        return;
      }

      return newToken('identifier', buffer);
    },
    identifierNameEscape: function identifierNameEscape() {
      if (c !== 'u') {
        throw invalidChar(read());
      }

      read();
      var u = unicodeEscape();

      switch (u) {
        case '$':
        case '_':
        case '\u200C':
        case '\u200D':
          break;

        default:
          if (!util.isIdContinueChar(u)) {
            throw invalidIdentifier();
          }

          break;
      }

      buffer += u;
      lexState = 'identifierName';
    },
    sign: function sign$1() {
      switch (c) {
        case '.':
          buffer = read();
          lexState = 'decimalPointLeading';
          return;

        case '0':
          buffer = read();
          lexState = 'zero';
          return;

        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          buffer = read();
          lexState = 'decimalInteger';
          return;

        case 'I':
          read();
          literal('nfinity');
          return newToken('numeric', sign * Infinity);

        case 'N':
          read();
          literal('aN');
          return newToken('numeric', NaN);
      }

      throw invalidChar(read());
    },
    zero: function zero() {
      switch (c) {
        case '.':
          buffer += read();
          lexState = 'decimalPoint';
          return;

        case 'e':
        case 'E':
          buffer += read();
          lexState = 'decimalExponent';
          return;

        case 'x':
        case 'X':
          buffer += read();
          lexState = 'hexadecimal';
          return;
      }

      return newToken('numeric', sign * 0);
    },
    decimalInteger: function decimalInteger() {
      switch (c) {
        case '.':
          buffer += read();
          lexState = 'decimalPoint';
          return;

        case 'e':
        case 'E':
          buffer += read();
          lexState = 'decimalExponent';
          return;
      }

      if (util.isDigit(c)) {
        buffer += read();
        return;
      }

      return newToken('numeric', sign * Number(buffer));
    },
    decimalPointLeading: function decimalPointLeading() {
      if (util.isDigit(c)) {
        buffer += read();
        lexState = 'decimalFraction';
        return;
      }

      throw invalidChar(read());
    },
    decimalPoint: function decimalPoint() {
      switch (c) {
        case 'e':
        case 'E':
          buffer += read();
          lexState = 'decimalExponent';
          return;
      }

      if (util.isDigit(c)) {
        buffer += read();
        lexState = 'decimalFraction';
        return;
      }

      return newToken('numeric', sign * Number(buffer));
    },
    decimalFraction: function decimalFraction() {
      switch (c) {
        case 'e':
        case 'E':
          buffer += read();
          lexState = 'decimalExponent';
          return;
      }

      if (util.isDigit(c)) {
        buffer += read();
        return;
      }

      return newToken('numeric', sign * Number(buffer));
    },
    decimalExponent: function decimalExponent() {
      switch (c) {
        case '+':
        case '-':
          buffer += read();
          lexState = 'decimalExponentSign';
          return;
      }

      if (util.isDigit(c)) {
        buffer += read();
        lexState = 'decimalExponentInteger';
        return;
      }

      throw invalidChar(read());
    },
    decimalExponentSign: function decimalExponentSign() {
      if (util.isDigit(c)) {
        buffer += read();
        lexState = 'decimalExponentInteger';
        return;
      }

      throw invalidChar(read());
    },
    decimalExponentInteger: function decimalExponentInteger() {
      if (util.isDigit(c)) {
        buffer += read();
        return;
      }

      return newToken('numeric', sign * Number(buffer));
    },
    hexadecimal: function hexadecimal() {
      if (util.isHexDigit(c)) {
        buffer += read();
        lexState = 'hexadecimalInteger';
        return;
      }

      throw invalidChar(read());
    },
    hexadecimalInteger: function hexadecimalInteger() {
      if (util.isHexDigit(c)) {
        buffer += read();
        return;
      }

      return newToken('numeric', sign * Number(buffer));
    },
    string: function string() {
      switch (c) {
        case '\\':
          read();
          buffer += escape();
          return;

        case '"':
          if (doubleQuote) {
            read();
            return newToken('string', buffer);
          }

          buffer += read();
          return;

        case "'":
          if (!doubleQuote) {
            read();
            return newToken('string', buffer);
          }

          buffer += read();
          return;

        case '\n':
        case '\r':
          throw invalidChar(read());

        case '\u2028':
        case '\u2029':
          separatorChar(c);
          break;

        case undefined:
          throw invalidChar(read());
      }

      buffer += read();
    },
    start: function start() {
      switch (c) {
        case '{':
        case '[':
          return newToken('punctuator', read());
        // This code is unreachable since the default lexState handles eof.
        // case undefined:
        //     return newToken('eof')
      }

      lexState = 'value';
    },
    beforePropertyName: function beforePropertyName() {
      switch (c) {
        case '$':
        case '_':
          buffer = read();
          lexState = 'identifierName';
          return;

        case '\\':
          read();
          lexState = 'identifierNameStartEscape';
          return;

        case '}':
          return newToken('punctuator', read());

        case '"':
        case "'":
          doubleQuote = read() === '"';
          lexState = 'string';
          return;
      }

      if (util.isIdStartChar(c)) {
        buffer += read();
        lexState = 'identifierName';
        return;
      }

      throw invalidChar(read());
    },
    afterPropertyName: function afterPropertyName() {
      if (c === ':') {
        return newToken('punctuator', read());
      }

      throw invalidChar(read());
    },
    beforePropertyValue: function beforePropertyValue() {
      lexState = 'value';
    },
    afterPropertyValue: function afterPropertyValue() {
      switch (c) {
        case ',':
        case '}':
          return newToken('punctuator', read());
      }

      throw invalidChar(read());
    },
    beforeArrayValue: function beforeArrayValue() {
      if (c === ']') {
        return newToken('punctuator', read());
      }

      lexState = 'value';
    },
    afterArrayValue: function afterArrayValue() {
      switch (c) {
        case ',':
        case ']':
          return newToken('punctuator', read());
      }

      throw invalidChar(read());
    },
    end: function end() {
      // This code is unreachable since it's handled by the default lexState.
      // if (c === undefined) {
      //     read()
      //     return newToken('eof')
      // }
      throw invalidChar(read());
    }
  };

  function newToken(type, value) {
    return {
      type: type,
      value: value,
      line: line,
      column: column
    };
  }

  function literal(s) {
    for (var i = 0, list = s; i < list.length; i += 1) {
      var c = list[i];
      var p = peek();

      if (p !== c) {
        throw invalidChar(read());
      }

      read();
    }
  }

  function escape() {
    var c = peek();

    switch (c) {
      case 'b':
        read();
        return '\b';

      case 'f':
        read();
        return '\f';

      case 'n':
        read();
        return '\n';

      case 'r':
        read();
        return '\r';

      case 't':
        read();
        return '\t';

      case 'v':
        read();
        return '\v';

      case '0':
        read();

        if (util.isDigit(peek())) {
          throw invalidChar(read());
        }

        return '\0';

      case 'x':
        read();
        return hexEscape();

      case 'u':
        read();
        return unicodeEscape();

      case '\n':
      case '\u2028':
      case '\u2029':
        read();
        return '';

      case '\r':
        read();

        if (peek() === '\n') {
          read();
        }

        return '';

      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9':
        throw invalidChar(read());

      case undefined:
        throw invalidChar(read());
    }

    return read();
  }

  function hexEscape() {
    var buffer = '';
    var c = peek();

    if (!util.isHexDigit(c)) {
      throw invalidChar(read());
    }

    buffer += read();
    c = peek();

    if (!util.isHexDigit(c)) {
      throw invalidChar(read());
    }

    buffer += read();
    return String.fromCodePoint(parseInt(buffer, 16));
  }

  function unicodeEscape() {
    var buffer = '';
    var count = 4;

    while (count-- > 0) {
      var c = peek();

      if (!util.isHexDigit(c)) {
        throw invalidChar(read());
      }

      buffer += read();
    }

    return String.fromCodePoint(parseInt(buffer, 16));
  }

  var parseStates = {
    start: function start() {
      if (token.type === 'eof') {
        throw invalidEOF();
      }

      push();
    },
    beforePropertyName: function beforePropertyName() {
      switch (token.type) {
        case 'identifier':
        case 'string':
          key = token.value;
          parseState = 'afterPropertyName';
          return;

        case 'punctuator':
          // This code is unreachable since it's handled by the lexState.
          // if (token.value !== '}') {
          //     throw invalidToken()
          // }
          pop();
          return;

        case 'eof':
          throw invalidEOF();
      } // This code is unreachable since it's handled by the lexState.
      // throw invalidToken()

    },
    afterPropertyName: function afterPropertyName() {
      // This code is unreachable since it's handled by the lexState.
      // if (token.type !== 'punctuator' || token.value !== ':') {
      //     throw invalidToken()
      // }
      if (token.type === 'eof') {
        throw invalidEOF();
      }

      parseState = 'beforePropertyValue';
    },
    beforePropertyValue: function beforePropertyValue() {
      if (token.type === 'eof') {
        throw invalidEOF();
      }

      push();
    },
    beforeArrayValue: function beforeArrayValue() {
      if (token.type === 'eof') {
        throw invalidEOF();
      }

      if (token.type === 'punctuator' && token.value === ']') {
        pop();
        return;
      }

      push();
    },
    afterPropertyValue: function afterPropertyValue() {
      // This code is unreachable since it's handled by the lexState.
      // if (token.type !== 'punctuator') {
      //     throw invalidToken()
      // }
      if (token.type === 'eof') {
        throw invalidEOF();
      }

      switch (token.value) {
        case ',':
          parseState = 'beforePropertyName';
          return;

        case '}':
          pop();
      } // This code is unreachable since it's handled by the lexState.
      // throw invalidToken()

    },
    afterArrayValue: function afterArrayValue() {
      // This code is unreachable since it's handled by the lexState.
      // if (token.type !== 'punctuator') {
      //     throw invalidToken()
      // }
      if (token.type === 'eof') {
        throw invalidEOF();
      }

      switch (token.value) {
        case ',':
          parseState = 'beforeArrayValue';
          return;

        case ']':
          pop();
      } // This code is unreachable since it's handled by the lexState.
      // throw invalidToken()

    },
    end: function end() {// This code is unreachable since it's handled by the lexState.
      // if (token.type !== 'eof') {
      //     throw invalidToken()
      // }
    }
  };

  function push() {
    var value;

    switch (token.type) {
      case 'punctuator':
        switch (token.value) {
          case '{':
            value = {};
            break;

          case '[':
            value = [];
            break;
        }

        break;

      case 'null':
      case 'boolean':
      case 'numeric':
      case 'string':
        value = token.value;
        break;
      // This code is unreachable.
      // default:
      //     throw invalidToken()
    }

    if (root === undefined) {
      root = value;
    } else {
      var parent = stack[stack.length - 1];

      if (Array.isArray(parent)) {
        parent.push(value);
      } else {
        parent[key] = value;
      }
    }

    if (value !== null && typeof value === 'object') {
      stack.push(value);

      if (Array.isArray(value)) {
        parseState = 'beforeArrayValue';
      } else {
        parseState = 'beforePropertyName';
      }
    } else {
      var current = stack[stack.length - 1];

      if (current == null) {
        parseState = 'end';
      } else if (Array.isArray(current)) {
        parseState = 'afterArrayValue';
      } else {
        parseState = 'afterPropertyValue';
      }
    }
  }

  function pop() {
    stack.pop();
    var current = stack[stack.length - 1];

    if (current == null) {
      parseState = 'end';
    } else if (Array.isArray(current)) {
      parseState = 'afterArrayValue';
    } else {
      parseState = 'afterPropertyValue';
    }
  } // This code is unreachable.
  // function invalidParseState () {
  //     return new Error(`JSON5: invalid parse state '${parseState}'`)
  // }
  // This code is unreachable.
  // function invalidLexState (state) {
  //     return new Error(`JSON5: invalid lex state '${state}'`)
  // }


  function invalidChar(c) {
    if (c === undefined) {
      return syntaxError("JSON5: invalid end of input at " + line + ":" + column);
    }

    return syntaxError("JSON5: invalid character '" + formatChar(c) + "' at " + line + ":" + column);
  }

  function invalidEOF() {
    return syntaxError("JSON5: invalid end of input at " + line + ":" + column);
  } // This code is unreachable.
  // function invalidToken () {
  //     if (token.type === 'eof') {
  //         return syntaxError(`JSON5: invalid end of input at ${line}:${column}`)
  //     }
  //     const c = String.fromCodePoint(token.value.codePointAt(0))
  //     return syntaxError(`JSON5: invalid character '${formatChar(c)}' at ${line}:${column}`)
  // }


  function invalidIdentifier() {
    column -= 5;
    return syntaxError("JSON5: invalid identifier character at " + line + ":" + column);
  }

  function separatorChar(c) {
    console.warn("JSON5: '" + formatChar(c) + "' in strings is not valid ECMAScript; consider escaping");
  }

  function formatChar(c) {
    var replacements = {
      "'": "\\'",
      '"': '\\"',
      '\\': '\\\\',
      '\b': '\\b',
      '\f': '\\f',
      '\n': '\\n',
      '\r': '\\r',
      '\t': '\\t',
      '\v': '\\v',
      '\0': '\\0',
      '\u2028': '\\u2028',
      '\u2029': '\\u2029'
    };

    if (replacements[c]) {
      return replacements[c];
    }

    if (c < ' ') {
      var hexString = c.charCodeAt(0).toString(16);
      return '\\x' + ('00' + hexString).substring(hexString.length);
    }

    return c;
  }

  function syntaxError(message) {
    var err = new SyntaxError(message);
    err.lineNumber = line;
    err.columnNumber = column;
    return err;
  }

  var stringify = function stringify(value, replacer, space) {
    var stack = [];
    var indent = '';
    var propertyList;
    var replacerFunc;
    var gap = '';
    var quote;

    if (replacer != null && typeof replacer === 'object' && !Array.isArray(replacer)) {
      space = replacer.space;
      quote = replacer.quote;
      replacer = replacer.replacer;
    }

    if (typeof replacer === 'function') {
      replacerFunc = replacer;
    } else if (Array.isArray(replacer)) {
      propertyList = [];

      for (var i = 0, list = replacer; i < list.length; i += 1) {
        var v = list[i];
        var item = void 0;

        if (typeof v === 'string') {
          item = v;
        } else if (typeof v === 'number' || v instanceof String || v instanceof Number) {
          item = String(v);
        }

        if (item !== undefined && propertyList.indexOf(item) < 0) {
          propertyList.push(item);
        }
      }
    }

    if (space instanceof Number) {
      space = Number(space);
    } else if (space instanceof String) {
      space = String(space);
    }

    if (typeof space === 'number') {
      if (space > 0) {
        space = Math.min(10, Math.floor(space));
        gap = '          '.substr(0, space);
      }
    } else if (typeof space === 'string') {
      gap = space.substr(0, 10);
    }

    return serializeProperty('', {
      '': value
    });

    function serializeProperty(key, holder) {
      var value = holder[key];

      if (value != null) {
        if (typeof value.toJSON5 === 'function') {
          value = value.toJSON5(key);
        } else if (typeof value.toJSON === 'function') {
          value = value.toJSON(key);
        }
      }

      if (replacerFunc) {
        value = replacerFunc.call(holder, key, value);
      }

      if (value instanceof Number) {
        value = Number(value);
      } else if (value instanceof String) {
        value = String(value);
      } else if (value instanceof Boolean) {
        value = value.valueOf();
      }

      switch (value) {
        case null:
          return 'null';

        case true:
          return 'true';

        case false:
          return 'false';
      }

      if (typeof value === 'string') {
        return quoteString(value, false);
      }

      if (typeof value === 'number') {
        return String(value);
      }

      if (typeof value === 'object') {
        return Array.isArray(value) ? serializeArray(value) : serializeObject(value);
      }

      return undefined;
    }

    function quoteString(value) {
      var quotes = {
        "'": 0.1,
        '"': 0.2
      };
      var replacements = {
        "'": "\\'",
        '"': '\\"',
        '\\': '\\\\',
        '\b': '\\b',
        '\f': '\\f',
        '\n': '\\n',
        '\r': '\\r',
        '\t': '\\t',
        '\v': '\\v',
        '\0': '\\0',
        '\u2028': '\\u2028',
        '\u2029': '\\u2029'
      };
      var product = '';

      for (var i = 0; i < value.length; i++) {
        var c = value[i];

        switch (c) {
          case "'":
          case '"':
            quotes[c]++;
            product += c;
            continue;

          case '\0':
            if (util.isDigit(value[i + 1])) {
              product += '\\x00';
              continue;
            }

        }

        if (replacements[c]) {
          product += replacements[c];
          continue;
        }

        if (c < ' ') {
          var hexString = c.charCodeAt(0).toString(16);
          product += '\\x' + ('00' + hexString).substring(hexString.length);
          continue;
        }

        product += c;
      }

      var quoteChar = quote || Object.keys(quotes).reduce(function (a, b) {
        return quotes[a] < quotes[b] ? a : b;
      });
      product = product.replace(new RegExp(quoteChar, 'g'), replacements[quoteChar]);
      return quoteChar + product + quoteChar;
    }

    function serializeObject(value) {
      if (stack.indexOf(value) >= 0) {
        throw TypeError('Converting circular structure to JSON5');
      }

      stack.push(value);
      var stepback = indent;
      indent = indent + gap;
      var keys = propertyList || Object.keys(value);
      var partial = [];

      for (var i = 0, list = keys; i < list.length; i += 1) {
        var key = list[i];
        var propertyString = serializeProperty(key, value);

        if (propertyString !== undefined) {
          var member = serializeKey(key) + ':';

          if (gap !== '') {
            member += ' ';
          }

          member += propertyString;
          partial.push(member);
        }
      }

      var final;

      if (partial.length === 0) {
        final = '{}';
      } else {
        var properties;

        if (gap === '') {
          properties = partial.join(',');
          final = '{' + properties + '}';
        } else {
          var separator = ',\n' + indent;
          properties = partial.join(separator);
          final = '{\n' + indent + properties + ',\n' + stepback + '}';
        }
      }

      stack.pop();
      indent = stepback;
      return final;
    }

    function serializeKey(key) {
      if (key.length === 0) {
        return quoteString(key, true);
      }

      var firstChar = String.fromCodePoint(key.codePointAt(0));

      if (!util.isIdStartChar(firstChar)) {
        return quoteString(key, true);
      }

      for (var i = firstChar.length; i < key.length; i++) {
        if (!util.isIdContinueChar(String.fromCodePoint(key.codePointAt(i)))) {
          return quoteString(key, true);
        }
      }

      return key;
    }

    function serializeArray(value) {
      if (stack.indexOf(value) >= 0) {
        throw TypeError('Converting circular structure to JSON5');
      }

      stack.push(value);
      var stepback = indent;
      indent = indent + gap;
      var partial = [];

      for (var i = 0; i < value.length; i++) {
        var propertyString = serializeProperty(String(i), value);
        partial.push(propertyString !== undefined ? propertyString : 'null');
      }

      var final;

      if (partial.length === 0) {
        final = '[]';
      } else {
        if (gap === '') {
          var properties = partial.join(',');
          final = '[' + properties + ']';
        } else {
          var separator = ',\n' + indent;
          var properties$1 = partial.join(separator);
          final = '[\n' + indent + properties$1 + ',\n' + stepback + ']';
        }
      }

      stack.pop();
      indent = stepback;
      return final;
    }
  };

  var JSON5 = {
    parse: parse,
    stringify: stringify
  };
  var lib = JSON5;
  var es5 = lib;
  return es5;
});

/***/ })

/******/ });
/************************************************************************/
/******/ // The module cache
/******/ var __webpack_module_cache__ = {};
/******/ 
/******/ // The require function
/******/ function __webpack_require__(moduleId) {
/******/ 	// Check if module is in cache
/******/ 	var cachedModule = __webpack_module_cache__[moduleId];
/******/ 	if (cachedModule !== undefined) {
/******/ 		return cachedModule.exports;
/******/ 	}
/******/ 	// Create a new module (and put it into the cache)
/******/ 	var module = __webpack_module_cache__[moduleId] = {
/******/ 		// no module.id needed
/******/ 		// no module.loaded needed
/******/ 		exports: {}
/******/ 	};
/******/ 
/******/ 	// Execute the module function
/******/ 	__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 
/******/ 	// Return the exports of the module
/******/ 	return module.exports;
/******/ }
/******/ 
/************************************************************************/
/******/ /* webpack/runtime/compat get default export */
/******/ (() => {
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = (module) => {
/******/ 		var getter = module && module.__esModule ?
/******/ 			() => (module['default']) :
/******/ 			() => (module);
/******/ 		__webpack_require__.d(getter, { a: getter });
/******/ 		return getter;
/******/ 	};
/******/ })();
/******/ 
/******/ /* webpack/runtime/define property getters */
/******/ (() => {
/******/ 	// define getter functions for harmony exports
/******/ 	__webpack_require__.d = (exports, definition) => {
/******/ 		for(var key in definition) {
/******/ 			if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 				Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 			}
/******/ 		}
/******/ 	};
/******/ })();
/******/ 
/******/ /* webpack/runtime/hasOwnProperty shorthand */
/******/ (() => {
/******/ 	__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ })();
/******/ 
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  "EH": () => (/* binding */ createBridge),
  "MT": () => (/* binding */ createStore),
  "l3": () => (/* reexport */ prepareProfilingDataExport),
  "TV": () => (/* reexport */ prepareProfilingDataFrontendFromExport)
});

;// CONCATENATED MODULE: ../react-devtools-shared/src/events.js
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }

function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }

/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */
class EventEmitter {
  constructor() {
    _defineProperty(this, "listenersMap", new Map());
  }

  addListener(event, listener) {
    const listeners = this.listenersMap.get(event);

    if (listeners === undefined) {
      this.listenersMap.set(event, [listener]);
    } else {
      const index = listeners.indexOf(listener);

      if (index < 0) {
        listeners.push(listener);
      }
    }
  }

  emit(event, ...args) {
    const listeners = this.listenersMap.get(event);

    if (listeners !== undefined) {
      if (listeners.length === 1) {
        // No need to clone or try/catch
        const listener = listeners[0];
        listener.apply(null, args);
      } else {
        let didThrow = false;
        let caughtError = null;
        const clonedListeners = Array.from(listeners);

        for (let i = 0; i < clonedListeners.length; i++) {
          const listener = clonedListeners[i];

          try {
            listener.apply(null, args);
          } catch (error) {
            if (caughtError === null) {
              didThrow = true;
              caughtError = error;
            }
          }
        }

        if (didThrow) {
          throw caughtError;
        }
      }
    }
  }

  removeAllListeners() {
    this.listenersMap.clear();
  }

  removeListener(event, listener) {
    const listeners = this.listenersMap.get(event);

    if (listeners !== undefined) {
      const index = listeners.indexOf(listener);

      if (index >= 0) {
        listeners.splice(index, 1);
      }
    }
  }

}
;// CONCATENATED MODULE: ../react-devtools-shared/src/bridge.js
function bridge_defineProperty(obj, key, value) { key = bridge_toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function bridge_toPropertyKey(t) { var i = bridge_toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }

function bridge_toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }

/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */
 // This message specifies the version of the DevTools protocol currently supported by the backend,
// as well as the earliest NPM version (e.g. "4.13.0") that protocol is supported by on the frontend.
// This enables an older frontend to display an upgrade message to users for a newer, unsupported backend.

// Bump protocol version whenever a backwards breaking change is made
// in the messages sent between BackendBridge and FrontendBridge.
// This mapping is embedded in both frontend and backend builds.
//
// The backend protocol will always be the latest entry in the BRIDGE_PROTOCOL array.
//
// When an older frontend connects to a newer backend,
// the backend can send the minNpmVersion and the frontend can display an NPM upgrade prompt.
//
// When a newer frontend connects with an older protocol version,
// the frontend can use the embedded minNpmVersion/maxNpmVersion values to display a downgrade prompt.
const BRIDGE_PROTOCOL = [// This version technically never existed,
// but a backwards breaking change was added in 4.11,
// so the safest guess to downgrade the frontend would be to version 4.10.
{
  version: 0,
  minNpmVersion: '"<4.11.0"',
  maxNpmVersion: '"<4.11.0"'
}, // Versions 4.11.x – 4.12.x contained the backwards breaking change,
// but we didn't add the "fix" of checking the protocol version until 4.13,
// so we don't recommend downgrading to 4.11 or 4.12.
{
  version: 1,
  minNpmVersion: '4.13.0',
  maxNpmVersion: '4.21.0'
}, // Version 2 adds a StrictMode-enabled and supports-StrictMode bits to add-root operation.
{
  version: 2,
  minNpmVersion: '4.22.0',
  maxNpmVersion: null
}];
const currentBridgeProtocol = BRIDGE_PROTOCOL[BRIDGE_PROTOCOL.length - 1];

class Bridge extends EventEmitter {
  constructor(wall) {
    super();

    bridge_defineProperty(this, "_isShutdown", false);

    bridge_defineProperty(this, "_messageQueue", []);

    bridge_defineProperty(this, "_scheduledFlush", false);

    bridge_defineProperty(this, "_wallUnlisten", null);

    bridge_defineProperty(this, "_flush", () => {
      // This method is used after the bridge is marked as destroyed in shutdown sequence,
      // so we do not bail out if the bridge marked as destroyed.
      // It is a private method that the bridge ensures is only called at the right times.
      try {
        if (this._messageQueue.length) {
          for (let i = 0; i < this._messageQueue.length; i += 2) {
            this._wall.send(this._messageQueue[i], ...this._messageQueue[i + 1]);
          }

          this._messageQueue.length = 0;
        }
      } finally {
        // We set this at the end in case new messages are added synchronously above.
        // They're already handled so they shouldn't queue more flushes.
        this._scheduledFlush = false;
      }
    });

    bridge_defineProperty(this, "overrideValueAtPath", ({
      id,
      path,
      rendererID,
      type,
      value
    }) => {
      switch (type) {
        case 'context':
          this.send('overrideContext', {
            id,
            path,
            rendererID,
            wasForwarded: true,
            value
          });
          break;

        case 'hooks':
          this.send('overrideHookState', {
            id,
            path,
            rendererID,
            wasForwarded: true,
            value
          });
          break;

        case 'props':
          this.send('overrideProps', {
            id,
            path,
            rendererID,
            wasForwarded: true,
            value
          });
          break;

        case 'state':
          this.send('overrideState', {
            id,
            path,
            rendererID,
            wasForwarded: true,
            value
          });
          break;
      }
    });

    this._wall = wall;
    this._wallUnlisten = wall.listen(message => {
      if (message && message.event) {
        this.emit(message.event, message.payload);
      }
    }) || null; // Temporarily support older standalone front-ends sending commands to newer embedded backends.
    // We do this because React Native embeds the React DevTools backend,
    // but cannot control which version of the frontend users use.

    this.addListener('overrideValueAtPath', this.overrideValueAtPath);
  } // Listening directly to the wall isn't advised.
  // It can be used to listen for legacy (v3) messages (since they use a different format).


  get wall() {
    return this._wall;
  }

  send(event, ...payload) {
    if (this._isShutdown) {
      console.warn(`Cannot send message "${event}" through a Bridge that has been shutdown.`);
      return;
    } // When we receive a message:
    // - we add it to our queue of messages to be sent
    // - if there hasn't been a message recently, we set a timer for 0 ms in
    //   the future, allowing all messages created in the same tick to be sent
    //   together
    // - if there *has* been a message flushed in the last BATCH_DURATION ms
    //   (or we're waiting for our setTimeout-0 to fire), then _timeoutID will
    //   be set, and we'll simply add to the queue and wait for that


    this._messageQueue.push(event, payload);

    if (!this._scheduledFlush) {
      this._scheduledFlush = true; // $FlowFixMe

      if (typeof devtoolsJestTestScheduler === 'function') {
        // This exists just for our own jest tests.
        // They're written in such a way that we can neither mock queueMicrotask
        // because then we break React DOM and we can't not mock it because then
        // we can't synchronously flush it. So they need to be rewritten.
        // $FlowFixMe
        devtoolsJestTestScheduler(this._flush); // eslint-disable-line no-undef
      } else {
        queueMicrotask(this._flush);
      }
    }
  }

  shutdown() {
    if (this._isShutdown) {
      console.warn('Bridge was already shutdown.');
      return;
    } // Queue the shutdown outgoing message for subscribers.


    this.emit('shutdown');
    this.send('shutdown'); // Mark this bridge as destroyed, i.e. disable its public API.

    this._isShutdown = true; // Disable the API inherited from EventEmitter that can add more listeners and send more messages.
    // $FlowFixMe[cannot-write] This property is not writable.

    this.addListener = function () {}; // $FlowFixMe[cannot-write] This property is not writable.


    this.emit = function () {}; // NOTE: There's also EventEmitter API like `on` and `prependListener` that we didn't add to our Flow type of EventEmitter.
    // Unsubscribe this bridge incoming message listeners to be sure, and so they don't have to do that.


    this.removeAllListeners(); // Stop accepting and emitting incoming messages from the wall.

    const wallUnlisten = this._wallUnlisten;

    if (wallUnlisten) {
      wallUnlisten();
    } // Synchronously flush all queued outgoing messages.
    // At this step the subscribers' code may run in this call stack.


    do {
      this._flush();
    } while (this._messageQueue.length);
  } // Temporarily support older standalone backends by forwarding "overrideValueAtPath" commands
  // to the older message types they may be listening to.


}

/* harmony default export */ const bridge = (Bridge);
// EXTERNAL MODULE: ../../node_modules/clipboard-js/clipboard.js
var clipboard = __webpack_require__(811);
// EXTERNAL MODULE: ../../node_modules/util/util.js
var util = __webpack_require__(82);
;// CONCATENATED MODULE: ../react-devtools-shared/src/constants.js
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */
const CHROME_WEBSTORE_EXTENSION_ID = 'fmkadmapgofadopljbjfkapdkoienihi';
const INTERNAL_EXTENSION_ID = 'dnjnjgbfilfphmojnmhliehogmojhclc';
const LOCAL_EXTENSION_ID = 'ikiahnapldjmdmpkmfhjdjilojjhgcbf'; // Flip this flag to true to enable verbose console debug logging.

const __DEBUG__ = false; // Flip this flag to true to enable performance.mark() and performance.measure() timings.

const __PERFORMANCE_PROFILE__ = false;
const constants_TREE_OPERATION_ADD = 1;
const constants_TREE_OPERATION_REMOVE = 2;
const constants_TREE_OPERATION_REORDER_CHILDREN = 3;
const constants_TREE_OPERATION_UPDATE_TREE_BASE_DURATION = 4;
const constants_TREE_OPERATION_UPDATE_ERRORS_OR_WARNINGS = 5;
const constants_TREE_OPERATION_REMOVE_ROOT = 6;
const constants_TREE_OPERATION_SET_SUBTREE_MODE = 7;
const PROFILING_FLAG_BASIC_SUPPORT = 0b01;
const PROFILING_FLAG_TIMELINE_SUPPORT = 0b10;
const LOCAL_STORAGE_DEFAULT_TAB_KEY = 'React::DevTools::defaultTab';
const LOCAL_STORAGE_COMPONENT_FILTER_PREFERENCES_KEY = 'React::DevTools::componentFilters';
const SESSION_STORAGE_LAST_SELECTION_KEY = 'React::DevTools::lastSelection';
const constants_LOCAL_STORAGE_OPEN_IN_EDITOR_URL = 'React::DevTools::openInEditorUrl';
const LOCAL_STORAGE_OPEN_IN_EDITOR_URL_PRESET = 'React::DevTools::openInEditorUrlPreset';
const LOCAL_STORAGE_PARSE_HOOK_NAMES_KEY = 'React::DevTools::parseHookNames';
const constants_SESSION_STORAGE_RECORD_CHANGE_DESCRIPTIONS_KEY = 'React::DevTools::recordChangeDescriptions';
const constants_SESSION_STORAGE_RECORD_TIMELINE_KEY = 'React::DevTools::recordTimeline';
const constants_SESSION_STORAGE_RELOAD_AND_PROFILE_KEY = 'React::DevTools::reloadAndProfile';
const LOCAL_STORAGE_BROWSER_THEME = 'React::DevTools::theme';
const LOCAL_STORAGE_TRACE_UPDATES_ENABLED_KEY = 'React::DevTools::traceUpdatesEnabled';
const LOCAL_STORAGE_SUPPORTS_PROFILING_KEY = 'React::DevTools::supportsProfiling';
const PROFILER_EXPORT_VERSION = 5;
const FIREFOX_CONSOLE_DIMMING_COLOR = 'color: rgba(124, 124, 124, 0.75)';
const ANSI_STYLE_DIMMING_TEMPLATE = '\x1b[2;38;2;124;124;124m%s\x1b[0m';
const ANSI_STYLE_DIMMING_TEMPLATE_WITH_COMPONENT_STACK = '\x1b[2;38;2;124;124;124m%s %o\x1b[0m';
;// CONCATENATED MODULE: ../react-devtools-shared/src/frontend/types.js
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */

/**
 * WARNING:
 * This file contains types that are designed for React DevTools UI and how it interacts with the backend.
 * They might be used in different versions of DevTools backends.
 * Be mindful of backwards compatibility when making changes.
 */
// WARNING
// The values below are referenced by ComponentFilters (which are saved via localStorage).
// Do not change them or it will break previously saved user customizations.
// If new element types are added, use new numbers rather than re-ordering existing ones.
//
// Changing these types is also a backwards breaking change for the standalone shell,
// since the frontend and backend must share the same values-
// and the backend is embedded in certain environments (like React Native).
const ElementTypeClass = 1;
const ElementTypeContext = 2;
const ElementTypeFunction = 5;
const ElementTypeForwardRef = 6;
const ElementTypeHostComponent = 7;
const ElementTypeMemo = 8;
const ElementTypeOtherOrUnknown = 9;
const ElementTypeProfiler = 10;
const types_ElementTypeRoot = 11;
const ElementTypeSuspense = 12;
const ElementTypeSuspenseList = 13;
const ElementTypeTracingMarker = 14;
const ElementTypeVirtual = 15;
const ElementTypeViewTransition = 16;
const ElementTypeActivity = 17; // Different types of elements displayed in the Elements tree.
// These types may be used to visually distinguish types,
// or to enable/disable certain functionality.

// WARNING
// The values below are referenced by ComponentFilters (which are saved via localStorage).
// Do not change them or it will break previously saved user customizations.
// If new filter types are added, use new numbers rather than re-ordering existing ones.
const ComponentFilterElementType = 1;
const ComponentFilterDisplayName = 2;
const ComponentFilterLocation = 3;
const ComponentFilterHOC = 4;
const ComponentFilterEnvironmentName = 5; // Hide all elements of types in this Set.
// We hide host components only by default.
// Hide all elements with displayNames or paths matching one or more of the RegExps in this Set.
// Path filters are only used when elements include debug source location.
// Map of hook source ("<filename>:<line-number>:<column-number>") to name.
// Hook source is used instead of the hook itself because the latter is not stable between element inspections.
// We use a Map rather than an Array because of nested hooks and traversal ordering.

const StrictMode = 1; // Each element on the frontend corresponds to an ElementID (e.g. a Fiber) on the backend.
// Some of its information (e.g. id, type, displayName) come from the backend.
// Other bits (e.g. weight and depth) are computed on the frontend for windowing and display purposes.
// Elements are updated on a push basis– meaning the backend pushes updates to the frontend when needed.
// TODO: Add profiling type
// EXTERNAL MODULE: ../../node_modules/lru-cache/index.js
var lru_cache = __webpack_require__(730);
var lru_cache_default = /*#__PURE__*/__webpack_require__.n(lru_cache);
;// CONCATENATED MODULE: ../shared/ReactFeatureFlags.js
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */
// -----------------------------------------------------------------------------
// Land or remove (zero effort)
//
// Flags that can likely be deleted or landed without consequences
// -----------------------------------------------------------------------------
// None
// -----------------------------------------------------------------------------
// Killswitch
//
// Flags that exist solely to turn off a change in case it causes a regression
// when it rolls out to prod. We should remove these as soon as possible.
// -----------------------------------------------------------------------------
const enableHydrationLaneScheduling = true; // -----------------------------------------------------------------------------
// Land or remove (moderate effort)
//
// Flags that can be probably deleted or landed, but might require extra effort
// like migrating internal callers or performance testing.
// -----------------------------------------------------------------------------
// TODO: Finish rolling out in www

const favorSafetyOverHydrationPerf = true; // Need to remove didTimeout argument from Scheduler before landing

const disableSchedulerTimeoutInWorkLoop = false; // TODO: Land at Meta before removing.

const disableDefaultPropsExceptForClasses = true; // -----------------------------------------------------------------------------
// Slated for removal in the future (significant effort)
//
// These are experiments that didn't work out, and never shipped, but we can't
// delete from the codebase until we migrate internal callers.
// -----------------------------------------------------------------------------
// Add a callback property to suspense to notify which promises are currently
// in the update queue. This allows reporting and tracing of what is causing
// the user to see a loading state.
//
// Also allows hydration callbacks to fire when a dehydrated boundary gets
// hydrated or deleted.
//
// This will eventually be replaced by the Transition Tracing proposal.

const enableSuspenseCallback = false; // Experimental Scope support.

const enableScopeAPI = false; // Experimental Create Event Handle API.

const enableCreateEventHandleAPI = false; // Support legacy Primer support on internal FB www

const enableLegacyFBSupport = false; // -----------------------------------------------------------------------------
// Ongoing experiments
//
// These are features that we're either actively exploring or are reasonably
// likely to include in an upcoming release.
// -----------------------------------------------------------------------------
// Yield to the browser event loop and not just the scheduler event loop before passive effects.
// Fix gated tests that fail with this flag enabled before turning it back on.

const enableYieldingBeforePassive = false; // Experiment to intentionally yield less to block high framerate animations.

const enableThrottledScheduling = false;
const enableLegacyCache = (/* unused pure expression or super */ null && (true));
const enableAsyncIterableChildren = (/* unused pure expression or super */ null && (true));
const enableTaint = (/* unused pure expression or super */ null && (true));
const enablePostpone = (/* unused pure expression or super */ null && (true));
const enableHalt = (/* unused pure expression or super */ null && (true));
const enableViewTransition = (/* unused pure expression or super */ null && (true));
const enableGestureTransition = (/* unused pure expression or super */ null && (true));
const enableScrollEndPolyfill = (/* unused pure expression or super */ null && (true));
const enableSuspenseyImages = false;
const enableSrcObject = (/* unused pure expression or super */ null && (true));
/**
 * Switches the Fabric API from doing layout in commit work instead of complete work.
 */

const enableFabricCompleteRootInCommitPhase = false;
/**
 * Switches Fiber creation to a simple object instead of a constructor.
 */

const enableObjectFiber = false;
const enableTransitionTracing = false; // FB-only usage. The new API has different semantics.

const enableLegacyHidden = false; // Enables unstable_avoidThisFallback feature in Fiber

const enableSuspenseAvoidThisFallback = false;
const enableCPUSuspense = (/* unused pure expression or super */ null && (true)); // Test this at Meta before enabling.

const enableNoCloningMemoCache = false;
const enableUseEffectEventHook = (/* unused pure expression or super */ null && (true)); // Test in www before enabling in open source.
// Enables DOM-server to stream its instruction set as data-attributes
// (handled with an MutationObserver) instead of inline-scripts

const enableFizzExternalRuntime = (/* unused pure expression or super */ null && (true));
const alwaysThrottleRetries = true;
const passChildrenWhenCloningPersistedNodes = false;
/**
 * Enables a new Fiber flag used in persisted mode to reduce the number
 * of cloned host components.
 */

const enablePersistedModeClonedFlag = false;
const enableShallowPropDiffing = false;
const enableSiblingPrerendering = true;
/**
 * Enables an expiration time for retry lanes to avoid starvation.
 */

const enableRetryLaneExpiration = false;
const retryLaneExpirationMs = 5000;
const syncLaneExpirationMs = 250;
const transitionLaneExpirationMs = 5000;
/**
 * Enables a new error detection for infinite render loops from updates caused
 * by setState or similar outside of the component owning the state.
 */

const enableInfiniteRenderLoopDetection = false;
const enableFastAddPropertiesInDiffing = true;
const enableLazyPublicInstanceInFabric = false;
const enableFragmentRefs = (/* unused pure expression or super */ null && (true)); // -----------------------------------------------------------------------------
// Ready for next major.
//
// Alias __NEXT_MAJOR__ to __EXPERIMENTAL__ for easier skimming.
// -----------------------------------------------------------------------------
// TODO: Anything that's set to `true` in this section should either be cleaned
// up (if it's on everywhere, including Meta and RN builds) or moved to a
// different section of this file.
// const __NEXT_MAJOR__ = __EXPERIMENTAL__;
// Renames the internal symbol for elements since they have changed signature/constructor

const renameElementSymbol = true;
/**
 * Enables a fix to run insertion effect cleanup on hidden subtrees.
 */

const enableHiddenSubtreeInsertionEffectCleanup = false;
/**
 * Removes legacy style context defined using static `contextTypes` and consumed with static `childContextTypes`.
 */

const disableLegacyContext = true;
/**
 * Removes legacy style context just from function components.
 */

const disableLegacyContextForFunctionComponents = true; // Enable the moveBefore() alternative to insertBefore(). This preserves states of moves.

const enableMoveBefore = (/* unused pure expression or super */ null && (true)); // Disabled caching behavior of `react/cache` in client runtimes.

const disableClientCache = true; // Warn on any usage of ReactTestRenderer

const enableReactTestRendererWarning = true; // Disables legacy mode
// This allows us to land breaking changes to remove legacy mode APIs in experimental builds
// before removing them in stable in the next Major

const disableLegacyMode = true; // Make <Context> equivalent to <Context.Provider> instead of <Context.Consumer>

const ReactFeatureFlags_enableRenderableContext = true; // -----------------------------------------------------------------------------
// Chopping Block
//
// Planned feature deprecations and breaking changes. Sorted roughly in order of
// when we plan to enable them.
// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// React DOM Chopping Block
//
// Similar to main Chopping Block but only flags related to React DOM. These are
// grouped because we will likely batch all of them into a single major release.
// -----------------------------------------------------------------------------
// Disable support for comment nodes as React DOM containers. Already disabled
// in open source, but www codebase still relies on it. Need to remove.

const disableCommentsAsDOMContainers = true;
const enableTrustedTypesIntegration = false; // Prevent the value and checked attributes from syncing with their related
// DOM properties

const disableInputAttributeSyncing = false; // Disables children for <textarea> elements

const disableTextareaChildren = false; // -----------------------------------------------------------------------------
// Debugging and DevTools
// -----------------------------------------------------------------------------
// Gather advanced timing metrics for Profiler subtrees.

const enableProfilerTimer = (/* unused pure expression or super */ null && (false)); // Adds performance.measure() marks using Chrome extensions to allow formatted
// Component rendering tracks to show up in the Performance tab.
// This flag will be used for both Server Component and Client Component tracks.
// All calls should also be gated on enableProfilerTimer.

const enableComponentPerformanceTrack = true; // Adds user timing marks for e.g. state updates, suspense, and work loop stuff,
// for an experimental timeline tool.

const enableSchedulingProfiler = !enableComponentPerformanceTrack && false; // Record durations for commit and passive effects phases.

const enableProfilerCommitHooks = (/* unused pure expression or super */ null && (false)); // Phase param passed to onRender callback differentiates between an "update" and a "cascading-update".

const enableProfilerNestedUpdatePhase = (/* unused pure expression or super */ null && (false));
const enableAsyncDebugInfo = (/* unused pure expression or super */ null && (true)); // Track which Fiber(s) schedule render work.

const enableUpdaterTracking = (/* unused pure expression or super */ null && (false)); // Internal only.

const enableDO_NOT_USE_disableStrictPassiveEffect = false;
const ownerStackLimit = 1e4;
;// CONCATENATED MODULE: ../shared/ReactSymbols.js
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */
 // ATTENTION
// When adding new symbols to this file,
// Please consider also adding to 'react-devtools-shared/src/backend/ReactSymbols'
// The Symbol used to tag the ReactElement-like types.

const ReactSymbols_REACT_LEGACY_ELEMENT_TYPE = Symbol.for('react.element');
const ReactSymbols_REACT_ELEMENT_TYPE = renameElementSymbol ? Symbol.for('react.transitional.element') : ReactSymbols_REACT_LEGACY_ELEMENT_TYPE;
const ReactSymbols_REACT_PORTAL_TYPE = Symbol.for('react.portal');
const ReactSymbols_REACT_FRAGMENT_TYPE = Symbol.for('react.fragment');
const ReactSymbols_REACT_STRICT_MODE_TYPE = Symbol.for('react.strict_mode');
const ReactSymbols_REACT_PROFILER_TYPE = Symbol.for('react.profiler');
const ReactSymbols_REACT_PROVIDER_TYPE = Symbol.for('react.provider'); // TODO: Delete with enableRenderableContext

const ReactSymbols_REACT_CONSUMER_TYPE = Symbol.for('react.consumer');
const ReactSymbols_REACT_CONTEXT_TYPE = Symbol.for('react.context');
const ReactSymbols_REACT_FORWARD_REF_TYPE = Symbol.for('react.forward_ref');
const ReactSymbols_REACT_SUSPENSE_TYPE = Symbol.for('react.suspense');
const ReactSymbols_REACT_SUSPENSE_LIST_TYPE = Symbol.for('react.suspense_list');
const ReactSymbols_REACT_MEMO_TYPE = Symbol.for('react.memo');
const ReactSymbols_REACT_LAZY_TYPE = Symbol.for('react.lazy');
const REACT_SCOPE_TYPE = Symbol.for('react.scope');
const REACT_ACTIVITY_TYPE = Symbol.for('react.activity');
const REACT_LEGACY_HIDDEN_TYPE = Symbol.for('react.legacy_hidden');
const ReactSymbols_REACT_TRACING_MARKER_TYPE = Symbol.for('react.tracing_marker');
const REACT_MEMO_CACHE_SENTINEL = Symbol.for('react.memo_cache_sentinel');
const REACT_POSTPONE_TYPE = Symbol.for('react.postpone');
const ReactSymbols_REACT_VIEW_TRANSITION_TYPE = Symbol.for('react.view_transition');
const MAYBE_ITERATOR_SYMBOL = Symbol.iterator;
const FAUX_ITERATOR_SYMBOL = '@@iterator';
function getIteratorFn(maybeIterable) {
  if (maybeIterable === null || typeof maybeIterable !== 'object') {
    return null;
  }

  const maybeIterator = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable[FAUX_ITERATOR_SYMBOL];

  if (typeof maybeIterator === 'function') {
    return maybeIterator;
  }

  return null;
}
const ASYNC_ITERATOR = Symbol.asyncIterator;
;// CONCATENATED MODULE: ../react-devtools-shared/src/storage.js
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */
function storage_localStorageGetItem(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    return null;
  }
}
function localStorageRemoveItem(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {}
}
function localStorageSetItem(key, value) {
  try {
    return localStorage.setItem(key, value);
  } catch (error) {}
}
function storage_sessionStorageGetItem(key) {
  try {
    return sessionStorage.getItem(key);
  } catch (error) {
    return null;
  }
}
function storage_sessionStorageRemoveItem(key) {
  try {
    sessionStorage.removeItem(key);
  } catch (error) {}
}
function storage_sessionStorageSetItem(key, value) {
  try {
    return sessionStorage.setItem(key, value);
  } catch (error) {}
}
;// CONCATENATED MODULE: ../react-devtools-shared/src/hydration.js
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */

const hydration_meta = {
  inspectable: Symbol('inspectable'),
  inspected: Symbol('inspected'),
  name: Symbol('name'),
  preview_long: Symbol('preview_long'),
  preview_short: Symbol('preview_short'),
  readonly: Symbol('readonly'),
  size: Symbol('size'),
  type: Symbol('type'),
  unserializable: Symbol('unserializable')
}; // Typed arrays and other complex iteratable objects (e.g. Map, Set, ImmutableJS) need special handling.
// These objects can't be serialized without losing type information,
// so a "Unserializable" type wrapper is used (with meta-data keys) to send nested values-
// while preserving the original type and name.

// This threshold determines the depth at which the bridge "dehydrates" nested data.
// Dehydration means that we don't serialize the data for e.g. postMessage or stringify,
// unless the frontend explicitly requests it (e.g. a user clicks to expand a props object).
//
// Reducing this threshold will improve the speed of initial component inspection,
// but may decrease the responsiveness of expanding objects/arrays to inspect further.
const LEVEL_THRESHOLD = 2;
/**
 * Generate the dehydrated metadata for complex object instances
 */

function createDehydrated(type, inspectable, data, cleaned, path) {
  cleaned.push(path);
  const dehydrated = {
    inspectable,
    type,
    preview_long: formatDataForPreview(data, true),
    preview_short: formatDataForPreview(data, false),
    name: typeof data.constructor !== 'function' || typeof data.constructor.name !== 'string' || data.constructor.name === 'Object' ? '' : data.constructor.name
  };

  if (type === 'array' || type === 'typed_array') {
    dehydrated.size = data.length;
  } else if (type === 'object') {
    dehydrated.size = Object.keys(data).length;
  }

  if (type === 'iterator' || type === 'typed_array') {
    dehydrated.readonly = true;
  }

  return dehydrated;
}
/**
 * Strip out complex data (instances, functions, and data nested > LEVEL_THRESHOLD levels deep).
 * The paths of the stripped out objects are appended to the `cleaned` list.
 * On the other side of the barrier, the cleaned list is used to "re-hydrate" the cleaned representation into
 * an object with symbols as attributes, so that a sanitized object can be distinguished from a normal object.
 *
 * Input: {"some": {"attr": fn()}, "other": AnInstance}
 * Output: {
 *   "some": {
 *     "attr": {"name": the fn.name, type: "function"}
 *   },
 *   "other": {
 *     "name": "AnInstance",
 *     "type": "object",
 *   },
 * }
 * and cleaned = [["some", "attr"], ["other"]]
 */


function hydration_dehydrate(data, cleaned, unserializable, path, isPathAllowed, level = 0) {
  const type = getDataType(data);
  let isPathAllowedCheck;

  switch (type) {
    case 'html_element':
      cleaned.push(path);
      return {
        inspectable: false,
        preview_short: formatDataForPreview(data, false),
        preview_long: formatDataForPreview(data, true),
        name: data.tagName,
        type
      };

    case 'function':
      cleaned.push(path);
      return {
        inspectable: false,
        preview_short: formatDataForPreview(data, false),
        preview_long: formatDataForPreview(data, true),
        name: typeof data.name === 'function' || !data.name ? 'function' : data.name,
        type
      };

    case 'string':
      isPathAllowedCheck = isPathAllowed(path);

      if (isPathAllowedCheck) {
        return data;
      } else {
        return data.length <= 500 ? data : data.slice(0, 500) + '...';
      }

    case 'bigint':
      cleaned.push(path);
      return {
        inspectable: false,
        preview_short: formatDataForPreview(data, false),
        preview_long: formatDataForPreview(data, true),
        name: data.toString(),
        type
      };

    case 'symbol':
      cleaned.push(path);
      return {
        inspectable: false,
        preview_short: formatDataForPreview(data, false),
        preview_long: formatDataForPreview(data, true),
        name: data.toString(),
        type
      };
    // React Elements aren't very inspector-friendly,
    // and often contain private fields or circular references.

    case 'react_element':
      cleaned.push(path);
      return {
        inspectable: false,
        preview_short: formatDataForPreview(data, false),
        preview_long: formatDataForPreview(data, true),
        name: getDisplayNameForReactElement(data) || 'Unknown',
        type
      };
    // ArrayBuffers error if you try to inspect them.

    case 'array_buffer':
    case 'data_view':
      cleaned.push(path);
      return {
        inspectable: false,
        preview_short: formatDataForPreview(data, false),
        preview_long: formatDataForPreview(data, true),
        name: type === 'data_view' ? 'DataView' : 'ArrayBuffer',
        size: data.byteLength,
        type
      };

    case 'array':
      isPathAllowedCheck = isPathAllowed(path);

      if (level >= LEVEL_THRESHOLD && !isPathAllowedCheck) {
        return createDehydrated(type, true, data, cleaned, path);
      }

      const arr = [];

      for (let i = 0; i < data.length; i++) {
        arr[i] = dehydrateKey(data, i, cleaned, unserializable, path.concat([i]), isPathAllowed, isPathAllowedCheck ? 1 : level + 1);
      }

      return arr;

    case 'html_all_collection':
    case 'typed_array':
    case 'iterator':
      isPathAllowedCheck = isPathAllowed(path);

      if (level >= LEVEL_THRESHOLD && !isPathAllowedCheck) {
        return createDehydrated(type, true, data, cleaned, path);
      } else {
        const unserializableValue = {
          unserializable: true,
          type: type,
          readonly: true,
          size: type === 'typed_array' ? data.length : undefined,
          preview_short: formatDataForPreview(data, false),
          preview_long: formatDataForPreview(data, true),
          name: typeof data.constructor !== 'function' || typeof data.constructor.name !== 'string' || data.constructor.name === 'Object' ? '' : data.constructor.name
        }; // TRICKY
        // Don't use [...spread] syntax for this purpose.
        // This project uses @babel/plugin-transform-spread in "loose" mode which only works with Array values.
        // Other types (e.g. typed arrays, Sets) will not spread correctly.

        Array.from(data).forEach((item, i) => unserializableValue[i] = hydration_dehydrate(item, cleaned, unserializable, path.concat([i]), isPathAllowed, isPathAllowedCheck ? 1 : level + 1));
        unserializable.push(path);
        return unserializableValue;
      }

    case 'opaque_iterator':
      cleaned.push(path);
      return {
        inspectable: false,
        preview_short: formatDataForPreview(data, false),
        preview_long: formatDataForPreview(data, true),
        name: data[Symbol.toStringTag],
        type
      };

    case 'date':
      cleaned.push(path);
      return {
        inspectable: false,
        preview_short: formatDataForPreview(data, false),
        preview_long: formatDataForPreview(data, true),
        name: data.toString(),
        type
      };

    case 'regexp':
      cleaned.push(path);
      return {
        inspectable: false,
        preview_short: formatDataForPreview(data, false),
        preview_long: formatDataForPreview(data, true),
        name: data.toString(),
        type
      };

    case 'object':
      isPathAllowedCheck = isPathAllowed(path);

      if (level >= LEVEL_THRESHOLD && !isPathAllowedCheck) {
        return createDehydrated(type, true, data, cleaned, path);
      } else {
        const object = {};
        getAllEnumerableKeys(data).forEach(key => {
          const name = key.toString();
          object[name] = dehydrateKey(data, key, cleaned, unserializable, path.concat([name]), isPathAllowed, isPathAllowedCheck ? 1 : level + 1);
        });
        return object;
      }

    case 'class_instance':
      isPathAllowedCheck = isPathAllowed(path);

      if (level >= LEVEL_THRESHOLD && !isPathAllowedCheck) {
        return createDehydrated(type, true, data, cleaned, path);
      }

      const value = {
        unserializable: true,
        type,
        readonly: true,
        preview_short: formatDataForPreview(data, false),
        preview_long: formatDataForPreview(data, true),
        name: typeof data.constructor !== 'function' || typeof data.constructor.name !== 'string' ? '' : data.constructor.name
      };
      getAllEnumerableKeys(data).forEach(key => {
        const keyAsString = key.toString();
        value[keyAsString] = hydration_dehydrate(data[key], cleaned, unserializable, path.concat([keyAsString]), isPathAllowed, isPathAllowedCheck ? 1 : level + 1);
      });
      unserializable.push(path);
      return value;

    case 'infinity':
    case 'nan':
    case 'undefined':
      // Some values are lossy when sent through a WebSocket.
      // We dehydrate+rehydrate them to preserve their type.
      cleaned.push(path);
      return {
        type
      };

    default:
      return data;
  }
}

function dehydrateKey(parent, key, cleaned, unserializable, path, isPathAllowed, level = 0) {
  try {
    return hydration_dehydrate(parent[key], cleaned, unserializable, path, isPathAllowed, level);
  } catch (error) {
    let preview = '';

    if (typeof error === 'object' && error !== null && typeof error.stack === 'string') {
      preview = error.stack;
    } else if (typeof error === 'string') {
      preview = error;
    }

    cleaned.push(path);
    return {
      inspectable: false,
      preview_short: '[Exception]',
      preview_long: preview ? '[Exception: ' + preview + ']' : '[Exception]',
      name: preview,
      type: 'unknown'
    };
  }
}

function fillInPath(object, data, path, value) {
  const target = getInObject(object, path);

  if (target != null) {
    if (!target[hydration_meta.unserializable]) {
      delete target[hydration_meta.inspectable];
      delete target[hydration_meta.inspected];
      delete target[hydration_meta.name];
      delete target[hydration_meta.preview_long];
      delete target[hydration_meta.preview_short];
      delete target[hydration_meta.readonly];
      delete target[hydration_meta.size];
      delete target[hydration_meta.type];
    }
  }

  if (value !== null && data.unserializable.length > 0) {
    const unserializablePath = data.unserializable[0];
    let isMatch = unserializablePath.length === path.length;

    for (let i = 0; i < path.length; i++) {
      if (path[i] !== unserializablePath[i]) {
        isMatch = false;
        break;
      }
    }

    if (isMatch) {
      upgradeUnserializable(value, value);
    }
  }

  setInObject(object, path, value);
}
function hydrate(object, cleaned, unserializable) {
  cleaned.forEach(path => {
    const length = path.length;
    const last = path[length - 1];
    const parent = getInObject(object, path.slice(0, length - 1));

    if (!parent || !parent.hasOwnProperty(last)) {
      return;
    }

    const value = parent[last];

    if (!value) {
      return;
    } else if (value.type === 'infinity') {
      parent[last] = Infinity;
    } else if (value.type === 'nan') {
      parent[last] = NaN;
    } else if (value.type === 'undefined') {
      parent[last] = undefined;
    } else {
      // Replace the string keys with Symbols so they're non-enumerable.
      const replaced = {};
      replaced[hydration_meta.inspectable] = !!value.inspectable;
      replaced[hydration_meta.inspected] = false;
      replaced[hydration_meta.name] = value.name;
      replaced[hydration_meta.preview_long] = value.preview_long;
      replaced[hydration_meta.preview_short] = value.preview_short;
      replaced[hydration_meta.size] = value.size;
      replaced[hydration_meta.readonly] = !!value.readonly;
      replaced[hydration_meta.type] = value.type;
      parent[last] = replaced;
    }
  });
  unserializable.forEach(path => {
    const length = path.length;
    const last = path[length - 1];
    const parent = getInObject(object, path.slice(0, length - 1));

    if (!parent || !parent.hasOwnProperty(last)) {
      return;
    }

    const node = parent[last];
    const replacement = { ...node
    };
    upgradeUnserializable(replacement, node);
    parent[last] = replacement;
  });
  return object;
}

function upgradeUnserializable(destination, source) {
  Object.defineProperties(destination, {
    // $FlowFixMe[invalid-computed-prop]
    [hydration_meta.inspected]: {
      configurable: true,
      enumerable: false,
      value: !!source.inspected
    },
    // $FlowFixMe[invalid-computed-prop]
    [hydration_meta.name]: {
      configurable: true,
      enumerable: false,
      value: source.name
    },
    // $FlowFixMe[invalid-computed-prop]
    [hydration_meta.preview_long]: {
      configurable: true,
      enumerable: false,
      value: source.preview_long
    },
    // $FlowFixMe[invalid-computed-prop]
    [hydration_meta.preview_short]: {
      configurable: true,
      enumerable: false,
      value: source.preview_short
    },
    // $FlowFixMe[invalid-computed-prop]
    [hydration_meta.size]: {
      configurable: true,
      enumerable: false,
      value: source.size
    },
    // $FlowFixMe[invalid-computed-prop]
    [hydration_meta.readonly]: {
      configurable: true,
      enumerable: false,
      value: !!source.readonly
    },
    // $FlowFixMe[invalid-computed-prop]
    [hydration_meta.type]: {
      configurable: true,
      enumerable: false,
      value: source.type
    },
    // $FlowFixMe[invalid-computed-prop]
    [hydration_meta.unserializable]: {
      configurable: true,
      enumerable: false,
      value: !!source.unserializable
    }
  });
  delete destination.inspected;
  delete destination.name;
  delete destination.preview_long;
  delete destination.preview_short;
  delete destination.size;
  delete destination.readonly;
  delete destination.type;
  delete destination.unserializable;
}
;// CONCATENATED MODULE: ../react-devtools-shared/src/isArray.js
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */
const isArray_isArray = Array.isArray;
/* harmony default export */ const src_isArray = ((/* unused pure expression or super */ null && (isArray_isArray)));
;// CONCATENATED MODULE: ../shared/isArray.js
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */
const isArrayImpl = Array.isArray;

function shared_isArray_isArray(a) {
  return isArrayImpl(a);
}

/* harmony default export */ const shared_isArray = ((/* unused pure expression or super */ null && (shared_isArray_isArray)));
;// CONCATENATED MODULE: ../react-devtools-shared/src/backend/utils/index.js
/**
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */




 // TODO: update this to the first React version that has a corresponding DevTools backend

const FIRST_DEVTOOLS_BACKEND_LOCKSTEP_VER = '999.9.9';
function hasAssignedBackend(version) {
  if (version == null || version === '') {
    return false;
  }

  return gte(version, FIRST_DEVTOOLS_BACKEND_LOCKSTEP_VER);
}
function cleanForBridge(data, isPathAllowed, path = []) {
  if (data !== null) {
    const cleanedPaths = [];
    const unserializablePaths = [];
    const cleanedData = dehydrate(data, cleanedPaths, unserializablePaths, path, isPathAllowed);
    return {
      data: cleanedData,
      cleaned: cleanedPaths,
      unserializable: unserializablePaths
    };
  } else {
    return null;
  }
}
function copyWithDelete(obj, path, index = 0) {
  const key = path[index];
  const updated = isArray(obj) ? obj.slice() : { ...obj
  };

  if (index + 1 === path.length) {
    if (isArray(updated)) {
      updated.splice(key, 1);
    } else {
      delete updated[key];
    }
  } else {
    // $FlowFixMe[incompatible-use] number or string is fine here
    updated[key] = copyWithDelete(obj[key], path, index + 1);
  }

  return updated;
} // This function expects paths to be the same except for the final value.
// e.g. ['path', 'to', 'foo'] and ['path', 'to', 'bar']

function copyWithRename(obj, oldPath, newPath, index = 0) {
  const oldKey = oldPath[index];
  const updated = isArray(obj) ? obj.slice() : { ...obj
  };

  if (index + 1 === oldPath.length) {
    const newKey = newPath[index]; // $FlowFixMe[incompatible-use] number or string is fine here

    updated[newKey] = updated[oldKey];

    if (isArray(updated)) {
      updated.splice(oldKey, 1);
    } else {
      delete updated[oldKey];
    }
  } else {
    // $FlowFixMe[incompatible-use] number or string is fine here
    updated[oldKey] = copyWithRename(obj[oldKey], oldPath, newPath, index + 1);
  }

  return updated;
}
function copyWithSet(obj, path, value, index = 0) {
  if (index >= path.length) {
    return value;
  }

  const key = path[index];
  const updated = isArray(obj) ? obj.slice() : { ...obj
  }; // $FlowFixMe[incompatible-use] number or string is fine here

  updated[key] = copyWithSet(obj[key], path, value, index + 1);
  return updated;
}
function getEffectDurations(root) {
  // Profiling durations are only available for certain builds.
  // If available, they'll be stored on the HostRoot.
  let effectDuration = null;
  let passiveEffectDuration = null;
  const hostRoot = root.current;

  if (hostRoot != null) {
    const stateNode = hostRoot.stateNode;

    if (stateNode != null) {
      effectDuration = stateNode.effectDuration != null ? stateNode.effectDuration : null;
      passiveEffectDuration = stateNode.passiveEffectDuration != null ? stateNode.passiveEffectDuration : null;
    }
  }

  return {
    effectDuration,
    passiveEffectDuration
  };
}
function serializeToString(data) {
  if (data === undefined) {
    return 'undefined';
  }

  if (typeof data === 'function') {
    return data.toString();
  }

  const cache = new Set(); // Use a custom replacer function to protect against circular references.

  return JSON.stringify(data, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (cache.has(value)) {
        return;
      }

      cache.add(value);
    }

    if (typeof value === 'bigint') {
      return value.toString() + 'n';
    }

    return value;
  }, 2);
}

function safeToString(val) {
  try {
    return String(val);
  } catch (err) {
    if (typeof val === 'object') {
      // An object with no prototype and no `[Symbol.toPrimitive]()`, `toString()`, and `valueOf()` methods would throw.
      // See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String#string_coercion
      return '[object Object]';
    }

    throw err;
  }
} // based on https://github.com/tmpfs/format-util/blob/0e62d430efb0a1c51448709abd3e2406c14d8401/format.js#L1
// based on https://developer.mozilla.org/en-US/docs/Web/API/console#Using_string_substitutions
// Implements s, d, i and f placeholders


function formatConsoleArgumentsToSingleString(maybeMessage, ...inputArgs) {
  const args = inputArgs.slice();
  let formatted = safeToString(maybeMessage); // If the first argument is a string, check for substitutions.

  if (typeof maybeMessage === 'string') {
    if (args.length) {
      const REGEXP = /(%?)(%([jds]))/g; // $FlowFixMe[incompatible-call]

      formatted = formatted.replace(REGEXP, (match, escaped, ptn, flag) => {
        let arg = args.shift();

        switch (flag) {
          case 's':
            // $FlowFixMe[unsafe-addition]
            arg += '';
            break;

          case 'd':
          case 'i':
            arg = parseInt(arg, 10).toString();
            break;

          case 'f':
            arg = parseFloat(arg).toString();
            break;
        }

        if (!escaped) {
          return arg;
        }

        args.unshift(arg);
        return match;
      });
    }
  } // Arguments that remain after formatting.


  if (args.length) {
    for (let i = 0; i < args.length; i++) {
      formatted += ' ' + safeToString(args[i]);
    }
  } // Update escaped %% values.


  formatted = formatted.replace(/%{2,2}/g, '%');
  return String(formatted);
}
function utils_isSynchronousXHRSupported() {
  return !!(window.document && window.document.featurePolicy && window.document.featurePolicy.allowsFeature('sync-xhr'));
}
function gt(a = '', b = '') {
  return compareVersions(a, b) === 1;
}
function gte(a = '', b = '') {
  return compareVersions(a, b) > -1;
}
const isReactNativeEnvironment = () => {
  // We've been relying on this for such a long time
  // We should probably define the client for DevTools on the backend side and share it with the frontend
  return window.document == null;
};

function extractLocation(url) {
  if (url.indexOf(':') === -1) {
    return null;
  } // remove any parentheses from start and end


  const withoutParentheses = url.replace(/^\(+/, '').replace(/\)+$/, '');
  const locationParts = /(at )?(.+?)(?::(\d+))?(?::(\d+))?$/.exec(withoutParentheses);

  if (locationParts == null) {
    return null;
  }

  const [,, sourceURL, line, column] = locationParts;
  return {
    sourceURL,
    line,
    column
  };
}

const CHROME_STACK_REGEXP = /^\s*at .*(\S+:\d+|\(native\))/m;

function parseSourceFromChromeStack(stack) {
  const frames = stack.split('\n'); // eslint-disable-next-line no-for-of-loops/no-for-of-loops

  for (const frame of frames) {
    const sanitizedFrame = frame.trim();
    const locationInParenthesesMatch = sanitizedFrame.match(/ (\(.+\)$)/);
    const possibleLocation = locationInParenthesesMatch ? locationInParenthesesMatch[1] : sanitizedFrame;
    const location = extractLocation(possibleLocation); // Continue the search until at least sourceURL is found

    if (location == null) {
      continue;
    }

    const {
      sourceURL,
      line = '1',
      column = '1'
    } = location;
    return {
      sourceURL,
      line: parseInt(line, 10),
      column: parseInt(column, 10)
    };
  }

  return null;
}

function parseSourceFromFirefoxStack(stack) {
  const frames = stack.split('\n'); // eslint-disable-next-line no-for-of-loops/no-for-of-loops

  for (const frame of frames) {
    const sanitizedFrame = frame.trim();
    const frameWithoutFunctionName = sanitizedFrame.replace(/((.*".+"[^@]*)?[^@]*)(?:@)/, '');
    const location = extractLocation(frameWithoutFunctionName); // Continue the search until at least sourceURL is found

    if (location == null) {
      continue;
    }

    const {
      sourceURL,
      line = '1',
      column = '1'
    } = location;
    return {
      sourceURL,
      line: parseInt(line, 10),
      column: parseInt(column, 10)
    };
  }

  return null;
}

function parseSourceFromComponentStack(componentStack) {
  if (componentStack.match(CHROME_STACK_REGEXP)) {
    return parseSourceFromChromeStack(componentStack);
  }

  return parseSourceFromFirefoxStack(componentStack);
} // 0.123456789 => 0.123
// Expects high-resolution timestamp in milliseconds, like from performance.now()
// Mainly used for optimizing the size of serialized profiling payload

function formatDurationToMicrosecondsGranularity(duration) {
  return Math.round(duration * 1000) / 1000;
}
;// CONCATENATED MODULE: ../react-devtools-shared/src/utils.js
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */









 // $FlowFixMe[method-unbinding]

const utils_hasOwnProperty = Object.prototype.hasOwnProperty;
const cachedDisplayNames = new WeakMap(); // On large trees, encoding takes significant time.
// Try to reuse the already encoded strings.

const encodedStringCache = new (lru_cache_default())({
  max: 1000
});
function alphaSortKeys(a, b) {
  if (a.toString() > b.toString()) {
    return 1;
  } else if (b.toString() > a.toString()) {
    return -1;
  } else {
    return 0;
  }
}
function utils_getAllEnumerableKeys(obj) {
  const keys = new Set();
  let current = obj;

  while (current != null) {
    const currentKeys = [...Object.keys(current), ...Object.getOwnPropertySymbols(current)];
    const descriptors = Object.getOwnPropertyDescriptors(current);
    currentKeys.forEach(key => {
      // $FlowFixMe[incompatible-type]: key can be a Symbol https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/getOwnPropertyDescriptor
      if (descriptors[key].enumerable) {
        keys.add(key);
      }
    });
    current = Object.getPrototypeOf(current);
  }

  return keys;
} // Mirror https://github.com/facebook/react/blob/7c21bf72ace77094fd1910cc350a548287ef8350/packages/shared/getComponentName.js#L27-L37

function getWrappedDisplayName(outerType, innerType, wrapperName, fallbackName) {
  const displayName = outerType?.displayName;
  return displayName || `${wrapperName}(${getDisplayName(innerType, fallbackName)})`;
}
function getDisplayName(type, fallbackName = 'Anonymous') {
  const nameFromCache = cachedDisplayNames.get(type);

  if (nameFromCache != null) {
    return nameFromCache;
  }

  let displayName = fallbackName; // The displayName property is not guaranteed to be a string.
  // It's only safe to use for our purposes if it's a string.
  // github.com/facebook/react-devtools/issues/803

  if (typeof type.displayName === 'string') {
    displayName = type.displayName;
  } else if (typeof type.name === 'string' && type.name !== '') {
    displayName = type.name;
  }

  cachedDisplayNames.set(type, displayName);
  return displayName;
}
let uidCounter = 0;
function getUID() {
  return ++uidCounter;
}
function utfDecodeStringWithRanges(array, left, right) {
  let string = '';

  for (let i = left; i <= right; i++) {
    string += String.fromCodePoint(array[i]);
  }

  return string;
}

function surrogatePairToCodePoint(charCode1, charCode2) {
  return ((charCode1 & 0x3ff) << 10) + (charCode2 & 0x3ff) + 0x10000;
} // Credit for this encoding approach goes to Tim Down:
// https://stackoverflow.com/questions/4877326/how-can-i-tell-if-a-string-contains-multibyte-characters-in-javascript


function utfEncodeString(string) {
  const cached = encodedStringCache.get(string);

  if (cached !== undefined) {
    return cached;
  }

  const encoded = [];
  let i = 0;
  let charCode;

  while (i < string.length) {
    charCode = string.charCodeAt(i); // Handle multibyte unicode characters (like emoji).

    if ((charCode & 0xf800) === 0xd800) {
      encoded.push(surrogatePairToCodePoint(charCode, string.charCodeAt(++i)));
    } else {
      encoded.push(charCode);
    }

    ++i;
  }

  encodedStringCache.set(string, encoded);
  return encoded;
}
function printOperationsArray(operations) {
  // The first two values are always rendererID and rootID
  const rendererID = operations[0];
  const rootID = operations[1];
  const logs = [`operations for renderer:${rendererID} and root:${rootID}`];
  let i = 2; // Reassemble the string table.

  const stringTable = [null // ID = 0 corresponds to the null string.
  ];
  const stringTableSize = operations[i++];
  const stringTableEnd = i + stringTableSize;

  while (i < stringTableEnd) {
    const nextLength = operations[i++];
    const nextString = utfDecodeStringWithRanges(operations, i, i + nextLength - 1);
    stringTable.push(nextString);
    i += nextLength;
  }

  while (i < operations.length) {
    const operation = operations[i];

    switch (operation) {
      case TREE_OPERATION_ADD:
        {
          const id = operations[i + 1];
          const type = operations[i + 2];
          i += 3;

          if (type === ElementTypeRoot) {
            logs.push(`Add new root node ${id}`);
            i++; // isStrictModeCompliant

            i++; // supportsProfiling

            i++; // supportsStrictMode

            i++; // hasOwnerMetadata
          } else {
            const parentID = operations[i];
            i++;
            i++; // ownerID

            const displayNameStringID = operations[i];
            const displayName = stringTable[displayNameStringID];
            i++;
            i++; // key

            logs.push(`Add node ${id} (${displayName || 'null'}) as child of ${parentID}`);
          }

          break;
        }

      case TREE_OPERATION_REMOVE:
        {
          const removeLength = operations[i + 1];
          i += 2;

          for (let removeIndex = 0; removeIndex < removeLength; removeIndex++) {
            const id = operations[i];
            i += 1;
            logs.push(`Remove node ${id}`);
          }

          break;
        }

      case TREE_OPERATION_REMOVE_ROOT:
        {
          i += 1;
          logs.push(`Remove root ${rootID}`);
          break;
        }

      case TREE_OPERATION_SET_SUBTREE_MODE:
        {
          const id = operations[i + 1];
          const mode = operations[i + 1];
          i += 3;
          logs.push(`Mode ${mode} set for subtree with root ${id}`);
          break;
        }

      case TREE_OPERATION_REORDER_CHILDREN:
        {
          const id = operations[i + 1];
          const numChildren = operations[i + 2];
          i += 3;
          const children = operations.slice(i, i + numChildren);
          i += numChildren;
          logs.push(`Re-order node ${id} children ${children.join(',')}`);
          break;
        }

      case TREE_OPERATION_UPDATE_TREE_BASE_DURATION:
        // Base duration updates are only sent while profiling is in progress.
        // We can ignore them at this point.
        // The profiler UI uses them lazily in order to generate the tree.
        i += 3;
        break;

      case TREE_OPERATION_UPDATE_ERRORS_OR_WARNINGS:
        const id = operations[i + 1];
        const numErrors = operations[i + 2];
        const numWarnings = operations[i + 3];
        i += 4;
        logs.push(`Node ${id} has ${numErrors} errors and ${numWarnings} warnings`);
        break;

      default:
        throw Error(`Unsupported Bridge operation "${operation}"`);
    }
  }

  console.log(logs.join('\n  '));
}
function getDefaultComponentFilters() {
  return [{
    type: ComponentFilterElementType,
    value: ElementTypeHostComponent,
    isEnabled: true
  }];
}
function getSavedComponentFilters() {
  try {
    const raw = storage_localStorageGetItem(LOCAL_STORAGE_COMPONENT_FILTER_PREFERENCES_KEY);

    if (raw != null) {
      const parsedFilters = JSON.parse(raw);
      return filterOutLocationComponentFilters(parsedFilters);
    }
  } catch (error) {}

  return getDefaultComponentFilters();
}
function setSavedComponentFilters(componentFilters) {
  localStorageSetItem(LOCAL_STORAGE_COMPONENT_FILTER_PREFERENCES_KEY, JSON.stringify(filterOutLocationComponentFilters(componentFilters)));
} // Following __debugSource removal from Fiber, the new approach for finding the source location
// of a component, represented by the Fiber, is based on lazily generating and parsing component stack frames
// To find the original location, React DevTools will perform symbolication, source maps are required for that.
// In order to start filtering Fibers, we need to find location for all of them, which can't be done lazily.
// Eager symbolication can become quite expensive for large applications.

function filterOutLocationComponentFilters(componentFilters) {
  // This is just an additional check to preserve the previous state
  // Filters can be stored on the backend side or in user land (in a window object)
  if (!Array.isArray(componentFilters)) {
    return componentFilters;
  }

  return componentFilters.filter(f => f.type !== ComponentFilterLocation);
}
function getDefaultOpenInEditorURL() {
  return  false ? 0 : '';
}
function getOpenInEditorURL() {
  try {
    const raw = localStorageGetItem(LOCAL_STORAGE_OPEN_IN_EDITOR_URL);

    if (raw != null) {
      return JSON.parse(raw);
    }
  } catch (error) {}

  return getDefaultOpenInEditorURL();
}
function parseElementDisplayNameFromBackend(displayName, type) {
  if (displayName === null) {
    return {
      formattedDisplayName: null,
      hocDisplayNames: null,
      compiledWithForget: false
    };
  }

  if (displayName.startsWith('Forget(')) {
    const displayNameWithoutForgetWrapper = displayName.slice(7, displayName.length - 1);
    const {
      formattedDisplayName,
      hocDisplayNames
    } = parseElementDisplayNameFromBackend(displayNameWithoutForgetWrapper, type);
    return {
      formattedDisplayName,
      hocDisplayNames,
      compiledWithForget: true
    };
  }

  let hocDisplayNames = null;

  switch (type) {
    case ElementTypeClass:
    case ElementTypeForwardRef:
    case ElementTypeFunction:
    case ElementTypeMemo:
    case ElementTypeVirtual:
      if (displayName.indexOf('(') >= 0) {
        const matches = displayName.match(/[^()]+/g);

        if (matches != null) {
          // $FlowFixMe[incompatible-type]
          displayName = matches.pop();
          hocDisplayNames = matches;
        }
      }

      break;

    default:
      break;
  }

  return {
    // $FlowFixMe[incompatible-return]
    formattedDisplayName: displayName,
    hocDisplayNames,
    compiledWithForget: false
  };
} // Pulled from react-compat
// https://github.com/developit/preact-compat/blob/7c5de00e7c85e2ffd011bf3af02899b63f699d3a/src/index.js#L349

function shallowDiffers(prev, next) {
  for (const attribute in prev) {
    if (!(attribute in next)) {
      return true;
    }
  }

  for (const attribute in next) {
    if (prev[attribute] !== next[attribute]) {
      return true;
    }
  }

  return false;
}
function utils_getInObject(object, path) {
  return path.reduce((reduced, attr) => {
    if (reduced) {
      if (utils_hasOwnProperty.call(reduced, attr)) {
        return reduced[attr];
      }

      if (typeof reduced[Symbol.iterator] === 'function') {
        // Convert iterable to array and return array[index]
        //
        // TRICKY
        // Don't use [...spread] syntax for this purpose.
        // This project uses @babel/plugin-transform-spread in "loose" mode which only works with Array values.
        // Other types (e.g. typed arrays, Sets) will not spread correctly.
        return Array.from(reduced)[attr];
      }
    }

    return null;
  }, object);
}
function deletePathInObject(object, path) {
  const length = path.length;
  const last = path[length - 1];

  if (object != null) {
    const parent = utils_getInObject(object, path.slice(0, length - 1));

    if (parent) {
      if (isArray(parent)) {
        parent.splice(last, 1);
      } else {
        delete parent[last];
      }
    }
  }
}
function renamePathInObject(object, oldPath, newPath) {
  const length = oldPath.length;

  if (object != null) {
    const parent = utils_getInObject(object, oldPath.slice(0, length - 1));

    if (parent) {
      const lastOld = oldPath[length - 1];
      const lastNew = newPath[length - 1];
      parent[lastNew] = parent[lastOld];

      if (isArray(parent)) {
        parent.splice(lastOld, 1);
      } else {
        delete parent[lastOld];
      }
    }
  }
}
function utils_setInObject(object, path, value) {
  const length = path.length;
  const last = path[length - 1];

  if (object != null) {
    const parent = utils_getInObject(object, path.slice(0, length - 1));

    if (parent) {
      parent[last] = value;
    }
  }
}

/**
 * Get a enhanced/artificial type string based on the object instance
 */
function utils_getDataType(data) {
  if (data === null) {
    return 'null';
  } else if (data === undefined) {
    return 'undefined';
  }

  if (typeof HTMLElement !== 'undefined' && data instanceof HTMLElement) {
    return 'html_element';
  }

  const type = typeof data;

  switch (type) {
    case 'bigint':
      return 'bigint';

    case 'boolean':
      return 'boolean';

    case 'function':
      return 'function';

    case 'number':
      if (Number.isNaN(data)) {
        return 'nan';
      } else if (!Number.isFinite(data)) {
        return 'infinity';
      } else {
        return 'number';
      }

    case 'object':
      if (data.$$typeof === REACT_ELEMENT_TYPE || data.$$typeof === REACT_LEGACY_ELEMENT_TYPE) {
        return 'react_element';
      }

      if (isArray(data)) {
        return 'array';
      } else if (ArrayBuffer.isView(data)) {
        return utils_hasOwnProperty.call(data.constructor, 'BYTES_PER_ELEMENT') ? 'typed_array' : 'data_view';
      } else if (data.constructor && data.constructor.name === 'ArrayBuffer') {
        // HACK This ArrayBuffer check is gross; is there a better way?
        // We could try to create a new DataView with the value.
        // If it doesn't error, we know it's an ArrayBuffer,
        // but this seems kind of awkward and expensive.
        return 'array_buffer';
      } else if (typeof data[Symbol.iterator] === 'function') {
        const iterator = data[Symbol.iterator]();

        if (!iterator) {// Proxies might break assumptoins about iterators.
          // See github.com/facebook/react/issues/21654
        } else {
          return iterator === data ? 'opaque_iterator' : 'iterator';
        }
      } else if (data.constructor && data.constructor.name === 'RegExp') {
        return 'regexp';
      } else {
        // $FlowFixMe[method-unbinding]
        const toStringValue = Object.prototype.toString.call(data);

        if (toStringValue === '[object Date]') {
          return 'date';
        } else if (toStringValue === '[object HTMLAllCollection]') {
          return 'html_all_collection';
        }
      }

      if (!isPlainObject(data)) {
        return 'class_instance';
      }

      return 'object';

    case 'string':
      return 'string';

    case 'symbol':
      return 'symbol';

    case 'undefined':
      if ( // $FlowFixMe[method-unbinding]
      Object.prototype.toString.call(data) === '[object HTMLAllCollection]') {
        return 'html_all_collection';
      }

      return 'undefined';

    default:
      return 'unknown';
  }
} // Fork of packages/react-is/src/ReactIs.js:30, but with legacy element type
// Which has been changed in https://github.com/facebook/react/pull/28813

function typeOfWithLegacyElementSymbol(object) {
  if (typeof object === 'object' && object !== null) {
    const $$typeof = object.$$typeof;

    switch ($$typeof) {
      case REACT_ELEMENT_TYPE:
      case REACT_LEGACY_ELEMENT_TYPE:
        const type = object.type;

        switch (type) {
          case REACT_FRAGMENT_TYPE:
          case REACT_PROFILER_TYPE:
          case REACT_STRICT_MODE_TYPE:
          case REACT_SUSPENSE_TYPE:
          case REACT_SUSPENSE_LIST_TYPE:
          case REACT_VIEW_TRANSITION_TYPE:
            return type;

          default:
            const $$typeofType = type && type.$$typeof;

            switch ($$typeofType) {
              case REACT_CONTEXT_TYPE:
              case REACT_FORWARD_REF_TYPE:
              case REACT_LAZY_TYPE:
              case REACT_MEMO_TYPE:
                return $$typeofType;

              case REACT_CONSUMER_TYPE:
                if (enableRenderableContext) {
                  return $$typeofType;
                }

              // Fall through

              case REACT_PROVIDER_TYPE:
                if (!enableRenderableContext) {
                  return $$typeofType;
                }

              // Fall through

              default:
                return $$typeof;
            }

        }

      case REACT_PORTAL_TYPE:
        return $$typeof;
    }
  }

  return undefined;
}

function utils_getDisplayNameForReactElement(element) {
  const elementType = typeOfWithLegacyElementSymbol(element);

  switch (elementType) {
    case REACT_CONSUMER_TYPE:
      return 'ContextConsumer';

    case REACT_PROVIDER_TYPE:
      return 'ContextProvider';

    case REACT_CONTEXT_TYPE:
      return 'Context';

    case REACT_FORWARD_REF_TYPE:
      return 'ForwardRef';

    case REACT_FRAGMENT_TYPE:
      return 'Fragment';

    case REACT_LAZY_TYPE:
      return 'Lazy';

    case REACT_MEMO_TYPE:
      return 'Memo';

    case REACT_PORTAL_TYPE:
      return 'Portal';

    case REACT_PROFILER_TYPE:
      return 'Profiler';

    case REACT_STRICT_MODE_TYPE:
      return 'StrictMode';

    case REACT_SUSPENSE_TYPE:
      return 'Suspense';

    case REACT_SUSPENSE_LIST_TYPE:
      return 'SuspenseList';

    case REACT_VIEW_TRANSITION_TYPE:
      return 'ViewTransition';

    case REACT_TRACING_MARKER_TYPE:
      return 'TracingMarker';

    default:
      const {
        type
      } = element;

      if (typeof type === 'string') {
        return type;
      } else if (typeof type === 'function') {
        return getDisplayName(type, 'Anonymous');
      } else if (type != null) {
        return 'NotImplementedInDevtools';
      } else {
        return 'Element';
      }

  }
}
const MAX_PREVIEW_STRING_LENGTH = 50;

function truncateForDisplay(string, length = MAX_PREVIEW_STRING_LENGTH) {
  if (string.length > length) {
    return string.slice(0, length) + '…';
  } else {
    return string;
  }
} // Attempts to mimic Chrome's inline preview for values.
// For example, the following value...
//   {
//      foo: 123,
//      bar: "abc",
//      baz: [true, false],
//      qux: { ab: 1, cd: 2 }
//   };
//
// Would show a preview of...
//   {foo: 123, bar: "abc", baz: Array(2), qux: {…}}
//
// And the following value...
//   [
//     123,
//     "abc",
//     [true, false],
//     { foo: 123, bar: "abc" }
//   ];
//
// Would show a preview of...
//   [123, "abc", Array(2), {…}]


function utils_formatDataForPreview(data, showFormattedValue) {
  if (data != null && utils_hasOwnProperty.call(data, meta.type)) {
    return showFormattedValue ? data[meta.preview_long] : data[meta.preview_short];
  }

  const type = utils_getDataType(data);

  switch (type) {
    case 'html_element':
      return `<${truncateForDisplay(data.tagName.toLowerCase())} />`;

    case 'function':
      if (typeof data.name === 'function' || data.name === '') {
        return '() => {}';
      }

      return `${truncateForDisplay(data.name)}() {}`;

    case 'string':
      return `"${data}"`;

    case 'bigint':
      return truncateForDisplay(data.toString() + 'n');

    case 'regexp':
      return truncateForDisplay(data.toString());

    case 'symbol':
      return truncateForDisplay(data.toString());

    case 'react_element':
      return `<${truncateForDisplay(utils_getDisplayNameForReactElement(data) || 'Unknown')} />`;

    case 'array_buffer':
      return `ArrayBuffer(${data.byteLength})`;

    case 'data_view':
      return `DataView(${data.buffer.byteLength})`;

    case 'array':
      if (showFormattedValue) {
        let formatted = '';

        for (let i = 0; i < data.length; i++) {
          if (i > 0) {
            formatted += ', ';
          }

          formatted += utils_formatDataForPreview(data[i], false);

          if (formatted.length > MAX_PREVIEW_STRING_LENGTH) {
            // Prevent doing a lot of unnecessary iteration...
            break;
          }
        }

        return `[${truncateForDisplay(formatted)}]`;
      } else {
        const length = utils_hasOwnProperty.call(data, meta.size) ? data[meta.size] : data.length;
        return `Array(${length})`;
      }

    case 'typed_array':
      const shortName = `${data.constructor.name}(${data.length})`;

      if (showFormattedValue) {
        let formatted = '';

        for (let i = 0; i < data.length; i++) {
          if (i > 0) {
            formatted += ', ';
          }

          formatted += data[i];

          if (formatted.length > MAX_PREVIEW_STRING_LENGTH) {
            // Prevent doing a lot of unnecessary iteration...
            break;
          }
        }

        return `${shortName} [${truncateForDisplay(formatted)}]`;
      } else {
        return shortName;
      }

    case 'iterator':
      const name = data.constructor.name;

      if (showFormattedValue) {
        // TRICKY
        // Don't use [...spread] syntax for this purpose.
        // This project uses @babel/plugin-transform-spread in "loose" mode which only works with Array values.
        // Other types (e.g. typed arrays, Sets) will not spread correctly.
        const array = Array.from(data);
        let formatted = '';

        for (let i = 0; i < array.length; i++) {
          const entryOrEntries = array[i];

          if (i > 0) {
            formatted += ', ';
          } // TRICKY
          // Browsers display Maps and Sets differently.
          // To mimic their behavior, detect if we've been given an entries tuple.
          //   Map(2) {"abc" => 123, "def" => 123}
          //   Set(2) {"abc", 123}


          if (isArray(entryOrEntries)) {
            const key = utils_formatDataForPreview(entryOrEntries[0], true);
            const value = utils_formatDataForPreview(entryOrEntries[1], false);
            formatted += `${key} => ${value}`;
          } else {
            formatted += utils_formatDataForPreview(entryOrEntries, false);
          }

          if (formatted.length > MAX_PREVIEW_STRING_LENGTH) {
            // Prevent doing a lot of unnecessary iteration...
            break;
          }
        }

        return `${name}(${data.size}) {${truncateForDisplay(formatted)}}`;
      } else {
        return `${name}(${data.size})`;
      }

    case 'opaque_iterator':
      {
        return data[Symbol.toStringTag];
      }

    case 'date':
      return data.toString();

    case 'class_instance':
      try {
        let resolvedConstructorName = data.constructor.name;

        if (typeof resolvedConstructorName === 'string') {
          return resolvedConstructorName;
        }

        resolvedConstructorName = Object.getPrototypeOf(data).constructor.name;

        if (typeof resolvedConstructorName === 'string') {
          return resolvedConstructorName;
        }

        try {
          return truncateForDisplay(String(data));
        } catch (error) {
          return 'unserializable';
        }
      } catch (error) {
        return 'unserializable';
      }

    case 'object':
      if (showFormattedValue) {
        const keys = Array.from(utils_getAllEnumerableKeys(data)).sort(alphaSortKeys);
        let formatted = '';

        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];

          if (i > 0) {
            formatted += ', ';
          }

          formatted += `${key.toString()}: ${utils_formatDataForPreview(data[key], false)}`;

          if (formatted.length > MAX_PREVIEW_STRING_LENGTH) {
            // Prevent doing a lot of unnecessary iteration...
            break;
          }
        }

        return `{${truncateForDisplay(formatted)}}`;
      } else {
        return '{…}';
      }

    case 'boolean':
    case 'number':
    case 'infinity':
    case 'nan':
    case 'null':
    case 'undefined':
      return data;

    default:
      try {
        return truncateForDisplay(String(data));
      } catch (error) {
        return 'unserializable';
      }

  }
} // Basically checking that the object only has Object in its prototype chain

const isPlainObject = object => {
  const objectPrototype = Object.getPrototypeOf(object);
  if (!objectPrototype) return true;
  const objectParentPrototype = Object.getPrototypeOf(objectPrototype);
  return !objectParentPrototype;
};
function backendToFrontendSerializedElementMapper(element) {
  const {
    formattedDisplayName,
    hocDisplayNames,
    compiledWithForget
  } = parseElementDisplayNameFromBackend(element.displayName, element.type);
  return { ...element,
    displayName: formattedDisplayName,
    hocDisplayNames,
    compiledWithForget
  };
}
/**
 * Should be used when treating url as a Chrome Resource URL.
 */

function normalizeUrlIfValid(url) {
  try {
    // TODO: Chrome will use the basepath to create a Resource URL.
    return new URL(url).toString();
  } catch {
    // Giving up if it's not a valid URL without basepath
    return url;
  }
}
function getIsReloadAndProfileSupported() {
  // Notify the frontend if the backend supports the Storage API (e.g. localStorage).
  // If not, features like reload-and-profile will not work correctly and must be disabled.
  let isBackendStorageAPISupported = false;

  try {
    localStorage.getItem('test');
    isBackendStorageAPISupported = true;
  } catch (error) {}

  return isBackendStorageAPISupported && isSynchronousXHRSupported();
} // Expected to be used only by browser extension and react-devtools-inline

function getIfReloadedAndProfiling() {
  return sessionStorageGetItem(SESSION_STORAGE_RELOAD_AND_PROFILE_KEY) === 'true';
}
function getProfilingSettings() {
  return {
    recordChangeDescriptions: sessionStorageGetItem(SESSION_STORAGE_RECORD_CHANGE_DESCRIPTIONS_KEY) === 'true',
    recordTimeline: sessionStorageGetItem(SESSION_STORAGE_RECORD_TIMELINE_KEY) === 'true'
  };
}
function onReloadAndProfile(recordChangeDescriptions, recordTimeline) {
  sessionStorageSetItem(SESSION_STORAGE_RELOAD_AND_PROFILE_KEY, 'true');
  sessionStorageSetItem(SESSION_STORAGE_RECORD_CHANGE_DESCRIPTIONS_KEY, recordChangeDescriptions ? 'true' : 'false');
  sessionStorageSetItem(SESSION_STORAGE_RECORD_TIMELINE_KEY, recordTimeline ? 'true' : 'false');
}
function onReloadAndProfileFlagsReset() {
  sessionStorageRemoveItem(SESSION_STORAGE_RELOAD_AND_PROFILE_KEY);
  sessionStorageRemoveItem(SESSION_STORAGE_RECORD_CHANGE_DESCRIPTIONS_KEY);
  sessionStorageRemoveItem(SESSION_STORAGE_RECORD_TIMELINE_KEY);
}
// EXTERNAL MODULE: ../react-devtools-shared/node_modules/json5/dist/index.js
var dist = __webpack_require__(74);
;// CONCATENATED MODULE: ../react-devtools-shared/src/devtools/utils.js
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */

function printElement(element, includeWeight = false) {
  let prefix = ' ';

  if (element.children.length > 0) {
    prefix = element.isCollapsed ? '▸' : '▾';
  }

  let key = '';

  if (element.key !== null) {
    key = ` key="${element.key}"`;
  }

  let hocDisplayNames = null;

  if (element.hocDisplayNames !== null) {
    hocDisplayNames = [...element.hocDisplayNames];
  }

  const hocs = hocDisplayNames === null ? '' : ` [${hocDisplayNames.join('][')}]`;
  let suffix = '';

  if (includeWeight) {
    suffix = ` (${element.isCollapsed ? 1 : element.weight})`;
  }

  return `${'  '.repeat(element.depth + 1)}${prefix} <${element.displayName || 'null'}${key}>${hocs}${suffix}`;
}
function printOwnersList(elements, includeWeight = false) {
  return elements.map(element => printElement(element, includeWeight)).join('\n');
}
function printStore(store, includeWeight = false, state = null) {
  const snapshotLines = [];
  let rootWeight = 0;

  function printSelectedMarker(index) {
    if (state === null) {
      return '';
    }

    return state.inspectedElementIndex === index ? `→` : ' ';
  }

  function printErrorsAndWarnings(element) {
    const {
      errorCount,
      warningCount
    } = store.getErrorAndWarningCountForElementID(element.id);

    if (errorCount === 0 && warningCount === 0) {
      return '';
    }

    return ` ${errorCount > 0 ? '✕' : ''}${warningCount > 0 ? '⚠' : ''}`;
  }

  const ownerFlatTree = state !== null ? state.ownerFlatTree : null;

  if (ownerFlatTree !== null) {
    snapshotLines.push('[owners]' + (includeWeight ? ` (${ownerFlatTree.length})` : ''));
    ownerFlatTree.forEach((element, index) => {
      const printedSelectedMarker = printSelectedMarker(index);
      const printedElement = printElement(element, false);
      const printedErrorsAndWarnings = printErrorsAndWarnings(element);
      snapshotLines.push(`${printedSelectedMarker}${printedElement}${printedErrorsAndWarnings}`);
    });
  } else {
    const errorsAndWarnings = store._errorsAndWarnings;

    if (errorsAndWarnings.size > 0) {
      let errorCount = 0;
      let warningCount = 0;
      errorsAndWarnings.forEach(entry => {
        errorCount += entry.errorCount;
        warningCount += entry.warningCount;
      });
      snapshotLines.push(`✕ ${errorCount}, ⚠ ${warningCount}`);
    }

    store.roots.forEach(rootID => {
      const {
        weight
      } = store.getElementByID(rootID);
      const maybeWeightLabel = includeWeight ? ` (${weight})` : ''; // Store does not (yet) expose a way to get errors/warnings per root.

      snapshotLines.push(`[root]${maybeWeightLabel}`);

      for (let i = rootWeight; i < rootWeight + weight; i++) {
        const element = store.getElementAtIndex(i);

        if (element == null) {
          throw Error(`Could not find element at index "${i}"`);
        }

        const printedSelectedMarker = printSelectedMarker(i);
        const printedElement = printElement(element, includeWeight);
        const printedErrorsAndWarnings = printErrorsAndWarnings(element);
        snapshotLines.push(`${printedSelectedMarker}${printedElement}${printedErrorsAndWarnings}`);
      }

      rootWeight += weight;
    }); // Make sure the pretty-printed test align with the Store's reported number of total rows.

    if (rootWeight !== store.numElements) {
      throw Error(`Inconsistent Store state. Individual root weights ("${rootWeight}") do not match total weight ("${store.numElements}")`);
    } // If roots have been unmounted, verify that they've been removed from maps.
    // This helps ensure the Store doesn't leak memory.


    store.assertExpectedRootMapSizes();
  }

  return snapshotLines.join('\n');
} // We use JSON.parse to parse string values
// e.g. 'foo' is not valid JSON but it is a valid string
// so this method replaces e.g. 'foo' with "foo"

function sanitizeForParse(value) {
  if (typeof value === 'string') {
    if (value.length >= 2 && value.charAt(0) === "'" && value.charAt(value.length - 1) === "'") {
      return '"' + value.slice(1, value.length - 1) + '"';
    }
  }

  return value;
}
function smartParse(value) {
  switch (value) {
    case 'Infinity':
      return Infinity;

    case 'NaN':
      return NaN;

    case 'undefined':
      return undefined;

    default:
      return JSON5.parse(sanitizeForParse(value));
  }
}
function smartStringify(value) {
  if (typeof value === 'number') {
    if (Number.isNaN(value)) {
      return 'NaN';
    } else if (!Number.isFinite(value)) {
      return 'Infinity';
    }
  } else if (value === undefined) {
    return 'undefined';
  }

  return JSON.stringify(value);
} // [url, row, column]

const STACK_DELIMETER = /\n\s+at /;
const STACK_SOURCE_LOCATION = /([^\s]+) \((.+):(.+):(.+)\)/;
function stackToComponentSources(stack) {
  const out = [];
  stack.split(STACK_DELIMETER).slice(1).forEach(entry => {
    const match = STACK_SOURCE_LOCATION.exec(entry);

    if (match) {
      const [, component, url, row, column] = match;
      out.push([component, [url, parseInt(row, 10), parseInt(column, 10)]]);
    } else {
      out.push([entry, null]);
    }
  });
  return out;
}
;// CONCATENATED MODULE: ../react-devtools-shared/src/devtools/views/Profiler/utils.js
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */


const commitGradient = (/* unused pure expression or super */ null && (['var(--color-commit-gradient-0)', 'var(--color-commit-gradient-1)', 'var(--color-commit-gradient-2)', 'var(--color-commit-gradient-3)', 'var(--color-commit-gradient-4)', 'var(--color-commit-gradient-5)', 'var(--color-commit-gradient-6)', 'var(--color-commit-gradient-7)', 'var(--color-commit-gradient-8)', 'var(--color-commit-gradient-9)'])); // Combines info from the Store (frontend) and renderer interfaces (backend) into the format required by the Profiler UI.
// This format can then be quickly exported (and re-imported).

function prepareProfilingDataFrontendFromBackendAndStore(dataBackends, operationsByRootID, snapshotsByRootID) {
  const dataForRoots = new Map();
  const timelineDataArray = [];
  dataBackends.forEach(dataBackend => {
    const {
      timelineData
    } = dataBackend;

    if (timelineData != null) {
      const {
        batchUIDToMeasuresKeyValueArray,
        internalModuleSourceToRanges,
        laneToLabelKeyValueArray,
        laneToReactMeasureKeyValueArray,
        ...rest
      } = timelineData;
      timelineDataArray.push({ ...rest,
        // Most of the data is safe to parse as-is,
        // but we need to convert the nested Arrays back to Maps.
        batchUIDToMeasuresMap: new Map(batchUIDToMeasuresKeyValueArray),
        internalModuleSourceToRanges: new Map(internalModuleSourceToRanges),
        laneToLabelMap: new Map(laneToLabelKeyValueArray),
        laneToReactMeasureMap: new Map(laneToReactMeasureKeyValueArray)
      });
    }

    dataBackend.dataForRoots.forEach(({
      commitData,
      displayName,
      initialTreeBaseDurations,
      rootID
    }) => {
      const operations = operationsByRootID.get(rootID);

      if (operations == null) {
        throw Error(`Could not find profiling operations for root "${rootID}"`);
      }

      const snapshots = snapshotsByRootID.get(rootID);

      if (snapshots == null) {
        throw Error(`Could not find profiling snapshots for root "${rootID}"`);
      } // Do not filter empty commits from the profiler data!
      // Hiding "empty" commits might cause confusion too.
      // A commit *did happen* even if none of the components the Profiler is showing were involved.


      const convertedCommitData = commitData.map((commitDataBackend, commitIndex) => ({
        changeDescriptions: commitDataBackend.changeDescriptions != null ? new Map(commitDataBackend.changeDescriptions) : null,
        duration: commitDataBackend.duration,
        effectDuration: commitDataBackend.effectDuration,
        fiberActualDurations: new Map(commitDataBackend.fiberActualDurations),
        fiberSelfDurations: new Map(commitDataBackend.fiberSelfDurations),
        passiveEffectDuration: commitDataBackend.passiveEffectDuration,
        priorityLevel: commitDataBackend.priorityLevel,
        timestamp: commitDataBackend.timestamp,
        updaters: commitDataBackend.updaters !== null ? commitDataBackend.updaters.map(backendToFrontendSerializedElementMapper) : null
      }));
      dataForRoots.set(rootID, {
        commitData: convertedCommitData,
        displayName,
        initialTreeBaseDurations: new Map(initialTreeBaseDurations),
        operations,
        rootID,
        snapshots
      });
    });
  });
  return {
    dataForRoots,
    imported: false,
    timelineData: timelineDataArray
  };
} // Converts a Profiling data export into the format required by the Store.

function prepareProfilingDataFrontendFromExport(profilingDataExport) {
  const {
    version
  } = profilingDataExport;

  if (version !== PROFILER_EXPORT_VERSION) {
    throw Error(`Unsupported profile export version "${version}". Supported version is "${PROFILER_EXPORT_VERSION}".`);
  }

  const timelineData = profilingDataExport.timelineData ? profilingDataExport.timelineData.map(({
    batchUIDToMeasuresKeyValueArray,
    componentMeasures,
    duration,
    flamechart,
    internalModuleSourceToRanges,
    laneToLabelKeyValueArray,
    laneToReactMeasureKeyValueArray,
    nativeEvents,
    networkMeasures,
    otherUserTimingMarks,
    reactVersion,
    schedulingEvents,
    snapshots,
    snapshotHeight,
    startTime,
    suspenseEvents,
    thrownErrors
  }) => ({
    // Most of the data is safe to parse as-is,
    // but we need to convert the nested Arrays back to Maps.
    batchUIDToMeasuresMap: new Map(batchUIDToMeasuresKeyValueArray),
    componentMeasures,
    duration,
    flamechart,
    internalModuleSourceToRanges: new Map(internalModuleSourceToRanges),
    laneToLabelMap: new Map(laneToLabelKeyValueArray),
    laneToReactMeasureMap: new Map(laneToReactMeasureKeyValueArray),
    nativeEvents,
    networkMeasures,
    otherUserTimingMarks,
    reactVersion,
    schedulingEvents,
    snapshots,
    snapshotHeight,
    startTime,
    suspenseEvents,
    thrownErrors
  })) : [];
  const dataForRoots = new Map();
  profilingDataExport.dataForRoots.forEach(({
    commitData,
    displayName,
    initialTreeBaseDurations,
    operations,
    rootID,
    snapshots
  }) => {
    dataForRoots.set(rootID, {
      commitData: commitData.map(({
        changeDescriptions,
        duration,
        effectDuration,
        fiberActualDurations,
        fiberSelfDurations,
        passiveEffectDuration,
        priorityLevel,
        timestamp,
        updaters
      }) => ({
        changeDescriptions: changeDescriptions != null ? new Map(changeDescriptions) : null,
        duration,
        effectDuration,
        fiberActualDurations: new Map(fiberActualDurations),
        fiberSelfDurations: new Map(fiberSelfDurations),
        passiveEffectDuration,
        priorityLevel,
        timestamp,
        updaters
      })),
      displayName,
      initialTreeBaseDurations: new Map(initialTreeBaseDurations),
      operations,
      rootID,
      snapshots: new Map(snapshots)
    });
  });
  return {
    dataForRoots,
    imported: true,
    timelineData
  };
} // Converts a Store Profiling data into a format that can be safely (JSON) serialized for export.

function prepareProfilingDataExport(profilingDataFrontend) {
  const timelineData = profilingDataFrontend.timelineData.map(({
    batchUIDToMeasuresMap,
    componentMeasures,
    duration,
    flamechart,
    internalModuleSourceToRanges,
    laneToLabelMap,
    laneToReactMeasureMap,
    nativeEvents,
    networkMeasures,
    otherUserTimingMarks,
    reactVersion,
    schedulingEvents,
    snapshots,
    snapshotHeight,
    startTime,
    suspenseEvents,
    thrownErrors
  }) => ({
    // Most of the data is safe to serialize as-is,
    // but we need to convert the Maps to nested Arrays.
    batchUIDToMeasuresKeyValueArray: Array.from(batchUIDToMeasuresMap.entries()),
    componentMeasures: componentMeasures,
    duration,
    flamechart,
    internalModuleSourceToRanges: Array.from(internalModuleSourceToRanges.entries()),
    laneToLabelKeyValueArray: Array.from(laneToLabelMap.entries()),
    laneToReactMeasureKeyValueArray: Array.from(laneToReactMeasureMap.entries()),
    nativeEvents,
    networkMeasures,
    otherUserTimingMarks,
    reactVersion,
    schedulingEvents,
    snapshots,
    snapshotHeight,
    startTime,
    suspenseEvents,
    thrownErrors
  }));
  const dataForRoots = [];
  profilingDataFrontend.dataForRoots.forEach(({
    commitData,
    displayName,
    initialTreeBaseDurations,
    operations,
    rootID,
    snapshots
  }) => {
    dataForRoots.push({
      commitData: commitData.map(({
        changeDescriptions,
        duration,
        effectDuration,
        fiberActualDurations,
        fiberSelfDurations,
        passiveEffectDuration,
        priorityLevel,
        timestamp,
        updaters
      }) => ({
        changeDescriptions: changeDescriptions != null ? Array.from(changeDescriptions.entries()) : null,
        duration,
        effectDuration,
        fiberActualDurations: Array.from(fiberActualDurations.entries()),
        fiberSelfDurations: Array.from(fiberSelfDurations.entries()),
        passiveEffectDuration,
        priorityLevel,
        timestamp,
        updaters
      })),
      displayName,
      initialTreeBaseDurations: Array.from(initialTreeBaseDurations.entries()),
      operations,
      rootID,
      snapshots: Array.from(snapshots.entries())
    });
  });
  return {
    version: PROFILER_EXPORT_VERSION,
    dataForRoots,
    timelineData
  };
}
const getGradientColor = value => {
  const maxIndex = commitGradient.length - 1;
  let index;

  if (Number.isNaN(value)) {
    index = 0;
  } else if (!Number.isFinite(value)) {
    index = maxIndex;
  } else {
    index = Math.max(0, Math.min(maxIndex, value)) * maxIndex;
  }

  return commitGradient[Math.round(index)];
};
const formatDuration = duration => Math.round(duration * 10) / 10 || '<0.1';
const formatPercentage = percentage => Math.round(percentage * 100);
const formatTime = timestamp => Math.round(Math.round(timestamp) / 100) / 10;
const scale = (minValue, maxValue, minRange, maxRange) => (value, fallbackValue) => maxValue - minValue === 0 ? fallbackValue : (value - minValue) / (maxValue - minValue) * (maxRange - minRange);
;// CONCATENATED MODULE: ../react-devtools-shared/src/devtools/views/Profiler/CommitTreeBuilder.js
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */





const debug = (methodName, ...args) => {
  if (__DEBUG__) {
    console.log(`%cCommitTreeBuilder %c${methodName}`, 'color: pink; font-weight: bold;', 'font-weight: bold;', ...args);
  }
};

const rootToCommitTreeMap = new Map();
function getCommitTree({
  commitIndex,
  profilerStore,
  rootID
}) {
  if (!rootToCommitTreeMap.has(rootID)) {
    rootToCommitTreeMap.set(rootID, []);
  }

  const commitTrees = rootToCommitTreeMap.get(rootID);

  if (commitIndex < commitTrees.length) {
    return commitTrees[commitIndex];
  }

  const {
    profilingData
  } = profilerStore;

  if (profilingData === null) {
    throw Error(`No profiling data available`);
  }

  const dataForRoot = profilingData.dataForRoots.get(rootID);

  if (dataForRoot == null) {
    throw Error(`Could not find profiling data for root "${rootID}"`);
  }

  const {
    operations
  } = dataForRoot;

  if (operations.length <= commitIndex) {
    throw Error(`getCommitTree(): Invalid commit "${commitIndex}" for root "${rootID}". There are only "${operations.length}" commits.`);
  }

  let commitTree = null;

  for (let index = commitTrees.length; index <= commitIndex; index++) {
    // Commits are generated sequentially and cached.
    // If this is the very first commit, start with the cached snapshot and apply the first mutation.
    // Otherwise load (or generate) the previous commit and append a mutation to it.
    if (index === 0) {
      const nodes = new Map(); // Construct the initial tree.

      recursivelyInitializeTree(rootID, 0, nodes, dataForRoot); // Mutate the tree

      if (operations != null && index < operations.length) {
        commitTree = updateTree({
          nodes,
          rootID
        }, operations[index]);

        if (__DEBUG__) {
          __printTree(commitTree);
        }

        commitTrees.push(commitTree);
      }
    } else {
      const previousCommitTree = commitTrees[index - 1];
      commitTree = updateTree(previousCommitTree, operations[index]);

      if (__DEBUG__) {
        __printTree(commitTree);
      }

      commitTrees.push(commitTree);
    }
  }

  return commitTree;
}

function recursivelyInitializeTree(id, parentID, nodes, dataForRoot) {
  const node = dataForRoot.snapshots.get(id);

  if (node != null) {
    nodes.set(id, {
      id,
      children: node.children,
      displayName: node.displayName,
      hocDisplayNames: node.hocDisplayNames,
      key: node.key,
      parentID,
      treeBaseDuration: dataForRoot.initialTreeBaseDurations.get(id),
      type: node.type,
      compiledWithForget: node.compiledWithForget
    });
    node.children.forEach(childID => recursivelyInitializeTree(childID, id, nodes, dataForRoot));
  }
}

function updateTree(commitTree, operations) {
  // Clone the original tree so edits don't affect it.
  const nodes = new Map(commitTree.nodes); // Clone nodes before mutating them so edits don't affect them.

  const getClonedNode = id => {
    // $FlowFixMe[prop-missing] - recommended fix is to use object spread operator
    const clonedNode = Object.assign({}, nodes.get(id));
    nodes.set(id, clonedNode);
    return clonedNode;
  };

  let i = 2;
  let id = null; // Reassemble the string table.

  const stringTable = [null // ID = 0 corresponds to the null string.
  ];
  const stringTableSize = operations[i++];
  const stringTableEnd = i + stringTableSize;

  while (i < stringTableEnd) {
    const nextLength = operations[i++];
    const nextString = utfDecodeStringWithRanges(operations, i, i + nextLength - 1);
    stringTable.push(nextString);
    i += nextLength;
  }

  while (i < operations.length) {
    const operation = operations[i];

    switch (operation) {
      case constants_TREE_OPERATION_ADD:
        {
          id = operations[i + 1];
          const type = operations[i + 2];
          i += 3;

          if (nodes.has(id)) {
            throw new Error(`Commit tree already contains fiber "${id}". This is a bug in React DevTools.`);
          }

          if (type === types_ElementTypeRoot) {
            i++; // isStrictModeCompliant

            i++; // Profiling flag

            i++; // supportsStrictMode flag

            i++; // hasOwnerMetadata flag

            if (__DEBUG__) {
              debug('Add', `new root fiber ${id}`);
            }

            const node = {
              children: [],
              displayName: null,
              hocDisplayNames: null,
              id,
              key: null,
              parentID: 0,
              treeBaseDuration: 0,
              // This will be updated by a subsequent operation
              type,
              compiledWithForget: false
            };
            nodes.set(id, node);
          } else {
            const parentID = operations[i];
            i++;
            i++; // ownerID

            const displayNameStringID = operations[i];
            const displayName = stringTable[displayNameStringID];
            i++;
            const keyStringID = operations[i];
            const key = stringTable[keyStringID];
            i++;

            if (__DEBUG__) {
              debug('Add', `fiber ${id} (${displayName || 'null'}) as child of ${parentID}`);
            }

            const parentNode = getClonedNode(parentID);
            parentNode.children = parentNode.children.concat(id);
            const {
              formattedDisplayName,
              hocDisplayNames,
              compiledWithForget
            } = parseElementDisplayNameFromBackend(displayName, type);
            const node = {
              children: [],
              displayName: formattedDisplayName,
              hocDisplayNames: hocDisplayNames,
              id,
              key,
              parentID,
              treeBaseDuration: 0,
              // This will be updated by a subsequent operation
              type,
              compiledWithForget
            };
            nodes.set(id, node);
          }

          break;
        }

      case constants_TREE_OPERATION_REMOVE:
        {
          const removeLength = operations[i + 1];
          i += 2;

          for (let removeIndex = 0; removeIndex < removeLength; removeIndex++) {
            id = operations[i];
            i++;

            if (!nodes.has(id)) {
              throw new Error(`Commit tree does not contain fiber "${id}". This is a bug in React DevTools.`);
            }

            const node = getClonedNode(id);
            const parentID = node.parentID;
            nodes.delete(id);

            if (!nodes.has(parentID)) {// No-op
            } else {
              const parentNode = getClonedNode(parentID);

              if (__DEBUG__) {
                debug('Remove', `fiber ${id} from parent ${parentID}`);
              }

              parentNode.children = parentNode.children.filter(childID => childID !== id);
            }
          }

          break;
        }

      case constants_TREE_OPERATION_REMOVE_ROOT:
        {
          throw Error('Operation REMOVE_ROOT is not supported while profiling.');
        }

      case constants_TREE_OPERATION_REORDER_CHILDREN:
        {
          id = operations[i + 1];
          const numChildren = operations[i + 2];
          const children = operations.slice(i + 3, i + 3 + numChildren);
          i = i + 3 + numChildren;

          if (__DEBUG__) {
            debug('Re-order', `fiber ${id} children ${children.join(',')}`);
          }

          const node = getClonedNode(id);
          node.children = Array.from(children);
          break;
        }

      case constants_TREE_OPERATION_SET_SUBTREE_MODE:
        {
          id = operations[i + 1];
          const mode = operations[i + 1];
          i += 3;

          if (__DEBUG__) {
            debug('Subtree mode', `Subtree with root ${id} set to mode ${mode}`);
          }

          break;
        }

      case constants_TREE_OPERATION_UPDATE_TREE_BASE_DURATION:
        {
          id = operations[i + 1];
          const node = getClonedNode(id);
          node.treeBaseDuration = operations[i + 2] / 1000; // Convert microseconds back to milliseconds;

          if (__DEBUG__) {
            debug('Update', `fiber ${id} treeBaseDuration to ${node.treeBaseDuration}`);
          }

          i += 3;
          break;
        }

      case constants_TREE_OPERATION_UPDATE_ERRORS_OR_WARNINGS:
        {
          id = operations[i + 1];
          const numErrors = operations[i + 2];
          const numWarnings = operations[i + 3];
          i += 4;

          if (__DEBUG__) {
            debug('Warnings and Errors update', `fiber ${id} has ${numErrors} errors and ${numWarnings} warnings`);
          }

          break;
        }

      default:
        throw Error(`Unsupported Bridge operation "${operation}"`);
    }
  }

  return {
    nodes,
    rootID: commitTree.rootID
  };
}

function invalidateCommitTrees() {
  rootToCommitTreeMap.clear();
} // DEBUG

const __printTree = commitTree => {
  if (__DEBUG__) {
    const {
      nodes,
      rootID
    } = commitTree;
    console.group('__printTree()');
    const queue = [rootID, 0];

    while (queue.length > 0) {
      const id = queue.shift();
      const depth = queue.shift(); // $FlowFixMe[incompatible-call]

      const node = nodes.get(id);

      if (node == null) {
        // $FlowFixMe[incompatible-type]
        throw Error(`Could not find node with id "${id}" in commit tree`);
      }

      console.log( // $FlowFixMe[incompatible-call]
      `${'•'.repeat(depth)}${node.id}:${node.displayName || ''} ${node.key ? `key:"${node.key}"` : ''} (${node.treeBaseDuration})`);
      node.children.forEach(childID => {
        // $FlowFixMe[unsafe-addition]
        queue.push(childID, depth + 1);
      });
    }

    console.groupEnd();
  }
};
;// CONCATENATED MODULE: ../react-devtools-shared/src/devtools/views/Profiler/FlamegraphChartBuilder.js
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */


const cachedChartData = new Map();
function getChartData({
  commitIndex,
  commitTree,
  profilerStore,
  rootID
}) {
  const commitDatum = profilerStore.getCommitData(rootID, commitIndex);
  const {
    fiberActualDurations,
    fiberSelfDurations
  } = commitDatum;
  const {
    nodes
  } = commitTree;
  const chartDataKey = `${rootID}-${commitIndex}`;

  if (cachedChartData.has(chartDataKey)) {
    return cachedChartData.get(chartDataKey);
  }

  const idToDepthMap = new Map();
  const renderPathNodes = new Set();
  const rows = [];
  let maxDepth = 0;
  let maxSelfDuration = 0; // Generate flame graph structure using tree base durations.

  const walkTree = (id, rightOffset, currentDepth) => {
    idToDepthMap.set(id, currentDepth);
    const node = nodes.get(id);

    if (node == null) {
      throw Error(`Could not find node with id "${id}" in commit tree`);
    }

    const {
      children,
      displayName,
      hocDisplayNames,
      key,
      treeBaseDuration,
      compiledWithForget
    } = node;
    const actualDuration = fiberActualDurations.get(id) || 0;
    const selfDuration = fiberSelfDurations.get(id) || 0;
    const didRender = fiberActualDurations.has(id);
    const name = displayName || 'Anonymous';
    const maybeKey = key !== null ? ` key="${key}"` : '';
    let maybeBadge = '';
    const maybeForgetBadge = compiledWithForget ? '✨ ' : '';

    if (hocDisplayNames !== null && hocDisplayNames.length > 0) {
      maybeBadge = ` (${hocDisplayNames[0]})`;
    }

    let label = `${maybeForgetBadge}${name}${maybeBadge}${maybeKey}`;

    if (didRender) {
      label += ` (${formatDuration(selfDuration)}ms of ${formatDuration(actualDuration)}ms)`;
    }

    maxDepth = Math.max(maxDepth, currentDepth);
    maxSelfDuration = Math.max(maxSelfDuration, selfDuration);
    const chartNode = {
      actualDuration,
      didRender,
      id,
      label,
      name,
      offset: rightOffset - treeBaseDuration,
      selfDuration,
      treeBaseDuration
    };

    if (currentDepth > rows.length) {
      rows.push([chartNode]);
    } else {
      rows[currentDepth - 1].push(chartNode);
    }

    for (let i = children.length - 1; i >= 0; i--) {
      const childID = children[i];
      const childChartNode = walkTree(childID, rightOffset, currentDepth + 1);
      rightOffset -= childChartNode.treeBaseDuration;
    }

    return chartNode;
  };

  let baseDuration = 0; // Special case to handle unmounted roots.

  if (nodes.size > 0) {
    // Skip over the root; we don't want to show it in the flamegraph.
    const root = nodes.get(rootID);

    if (root == null) {
      throw Error(`Could not find root node with id "${rootID}" in commit tree`);
    } // Don't assume a single root.
    // Component filters or Fragments might lead to multiple "roots" in a flame graph.


    for (let i = root.children.length - 1; i >= 0; i--) {
      const id = root.children[i];
      const node = nodes.get(id);

      if (node == null) {
        throw Error(`Could not find node with id "${id}" in commit tree`);
      }

      baseDuration += node.treeBaseDuration;
      walkTree(id, baseDuration, 1);
    }

    fiberActualDurations.forEach((duration, id) => {
      let node = nodes.get(id);

      if (node != null) {
        let currentID = node.parentID;

        while (currentID !== 0) {
          if (renderPathNodes.has(currentID)) {
            // We've already walked this path; we can skip it.
            break;
          } else {
            renderPathNodes.add(currentID);
          }

          node = nodes.get(currentID);
          currentID = node != null ? node.parentID : 0;
        }
      }
    });
  }

  const chartData = {
    baseDuration,
    depth: maxDepth,
    idToDepthMap,
    maxSelfDuration,
    renderPathNodes,
    rows
  };
  cachedChartData.set(chartDataKey, chartData);
  return chartData;
}
function invalidateChartData() {
  cachedChartData.clear();
}
;// CONCATENATED MODULE: ../react-devtools-shared/src/devtools/views/Profiler/RankedChartBuilder.js
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */



const RankedChartBuilder_cachedChartData = new Map();
function RankedChartBuilder_getChartData({
  commitIndex,
  commitTree,
  profilerStore,
  rootID
}) {
  const commitDatum = profilerStore.getCommitData(rootID, commitIndex);
  const {
    fiberActualDurations,
    fiberSelfDurations
  } = commitDatum;
  const {
    nodes
  } = commitTree;
  const chartDataKey = `${rootID}-${commitIndex}`;

  if (RankedChartBuilder_cachedChartData.has(chartDataKey)) {
    return RankedChartBuilder_cachedChartData.get(chartDataKey);
  }

  let maxSelfDuration = 0;
  const chartNodes = [];
  fiberActualDurations.forEach((actualDuration, id) => {
    const node = nodes.get(id);

    if (node == null) {
      throw Error(`Could not find node with id "${id}" in commit tree`);
    }

    const {
      displayName,
      key,
      parentID,
      type,
      compiledWithForget
    } = node; // Don't show the root node in this chart.

    if (parentID === 0) {
      return;
    }

    const selfDuration = fiberSelfDurations.get(id) || 0;
    maxSelfDuration = Math.max(maxSelfDuration, selfDuration);
    const name = displayName || 'Anonymous';
    const maybeKey = key !== null ? ` key="${key}"` : '';
    const maybeForgetBadge = compiledWithForget ? '✨ ' : '';
    let maybeBadge = '';

    if (type === ElementTypeForwardRef) {
      maybeBadge = ' (ForwardRef)';
    } else if (type === ElementTypeMemo) {
      maybeBadge = ' (Memo)';
    }

    const label = `${maybeForgetBadge}${name}${maybeBadge}${maybeKey} (${formatDuration(selfDuration)}ms)`;
    chartNodes.push({
      id,
      label,
      name,
      value: selfDuration
    });
  });
  const chartData = {
    maxValue: maxSelfDuration,
    nodes: chartNodes.sort((a, b) => b.value - a.value)
  };
  RankedChartBuilder_cachedChartData.set(chartDataKey, chartData);
  return chartData;
}
function RankedChartBuilder_invalidateChartData() {
  RankedChartBuilder_cachedChartData.clear();
}
;// CONCATENATED MODULE: ../react-devtools-shared/src/devtools/ProfilingCache.js
function ProfilingCache_defineProperty(obj, key, value) { key = ProfilingCache_toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function ProfilingCache_toPropertyKey(t) { var i = ProfilingCache_toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }

function ProfilingCache_toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }

/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */




class ProfilingCache {
  constructor(profilerStore) {
    ProfilingCache_defineProperty(this, "_fiberCommits", new Map());

    ProfilingCache_defineProperty(this, "getCommitTree", ({
      commitIndex,
      rootID
    }) => getCommitTree({
      commitIndex,
      profilerStore: this._profilerStore,
      rootID
    }));

    ProfilingCache_defineProperty(this, "getFiberCommits", ({
      fiberID,
      rootID
    }) => {
      const cachedFiberCommits = this._fiberCommits.get(fiberID);

      if (cachedFiberCommits != null) {
        return cachedFiberCommits;
      }

      const fiberCommits = [];

      const dataForRoot = this._profilerStore.getDataForRoot(rootID);

      dataForRoot.commitData.forEach((commitDatum, commitIndex) => {
        if (commitDatum.fiberActualDurations.has(fiberID)) {
          fiberCommits.push(commitIndex);
        }
      });

      this._fiberCommits.set(fiberID, fiberCommits);

      return fiberCommits;
    });

    ProfilingCache_defineProperty(this, "getFlamegraphChartData", ({
      commitIndex,
      commitTree,
      rootID
    }) => getChartData({
      commitIndex,
      commitTree,
      profilerStore: this._profilerStore,
      rootID
    }));

    ProfilingCache_defineProperty(this, "getRankedChartData", ({
      commitIndex,
      commitTree,
      rootID
    }) => RankedChartBuilder_getChartData({
      commitIndex,
      commitTree,
      profilerStore: this._profilerStore,
      rootID
    }));

    this._profilerStore = profilerStore;
  }

  invalidate() {
    this._fiberCommits.clear();

    invalidateCommitTrees();
    invalidateChartData();
    RankedChartBuilder_invalidateChartData();
  }

}
;// CONCATENATED MODULE: ../react-devtools-shared/src/config/DevToolsFeatureFlags.default.js
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */

/************************************************************************
 * This file is forked between different DevTools implementations.
 * It should never be imported directly!
 * It should always be imported from "react-devtools-feature-flags".
 ************************************************************************/
const enableLogger = false;
const enableStyleXFeatures = false;
const isInternalFacebookBuild = false;
;// CONCATENATED MODULE: ../react-devtools-shared/src/Logger.js
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */

let logFunctions = [];
const logEvent = enableLogger === true ? function logEvent(event) {
  logFunctions.forEach(log => {
    log(event);
  });
} : function logEvent() {};
const registerEventLogger = enableLogger === true ? function registerEventLogger(logFunction) {
  if (enableLogger) {
    logFunctions.push(logFunction);
    return function unregisterEventLogger() {
      logFunctions = logFunctions.filter(log => log !== logFunction);
    };
  }

  return () => {};
} : function registerEventLogger(logFunction) {
  return () => {};
};
;// CONCATENATED MODULE: ../react-devtools-shared/src/devtools/ProfilerStore.js
function ProfilerStore_defineProperty(obj, key, value) { key = ProfilerStore_toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function ProfilerStore_toPropertyKey(t) { var i = ProfilerStore_toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }

function ProfilerStore_toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }

/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */





class ProfilerStore extends EventEmitter {
  // Suspense cache for lazily calculating derived profiling data.
  // Temporary store of profiling data from the backend renderer(s).
  // This data will be converted to the ProfilingDataFrontend format after being collected from all renderers.
  // Data from the most recently completed profiling session,
  // or data that has been imported from a previously exported session.
  // This object contains all necessary data to drive the Profiler UI interface,
  // even though some of it is lazily parsed/derived via the ProfilingCache.
  // Snapshot of all attached renderer IDs.
  // Once profiling is finished, this snapshot will be used to query renderers for profiling data.
  //
  // This map is initialized when profiling starts and updated when a new root is added while profiling;
  // Upon completion, it is converted into the exportable ProfilingDataFrontend format.
  // Snapshot of the state of the main Store (including all roots) when profiling started.
  // Once profiling is finished, this snapshot can be used along with "operations" messages emitted during profiling,
  // to reconstruct the state of each root for each commit.
  // It's okay to use a single root to store this information because node IDs are unique across all roots.
  //
  // This map is initialized when profiling starts and updated when a new root is added while profiling;
  // Upon completion, it is converted into the exportable ProfilingDataFrontend format.
  // Map of root (id) to a list of tree mutation that occur during profiling.
  // Once profiling is finished, these mutations can be used, along with the initial tree snapshots,
  // to reconstruct the state of each root for each commit.
  //
  // This map is only updated while profiling is in progress;
  // Upon completion, it is converted into the exportable ProfilingDataFrontend format.
  // The backend is currently profiling.
  // When profiling is in progress, operations are stored so that we can later reconstruct past commit trees.
  // Mainly used for optimistic UI.
  // This could be false, but at the same time _isBackendProfiling could be true
  // for cases when Backend is busy serializing a chunky payload.
  // Tracks whether a specific renderer logged any profiling data during the most recent session.
  // After profiling, data is requested from each attached renderer using this queue.
  // So long as this queue is not empty, the store is retrieving and processing profiling data from the backend.
  constructor(bridge, store, defaultIsProfiling) {
    super();

    ProfilerStore_defineProperty(this, "_dataBackends", []);

    ProfilerStore_defineProperty(this, "_dataFrontend", null);

    ProfilerStore_defineProperty(this, "_initialRendererIDs", new Set());

    ProfilerStore_defineProperty(this, "_initialSnapshotsByRootID", new Map());

    ProfilerStore_defineProperty(this, "_inProgressOperationsByRootID", new Map());

    ProfilerStore_defineProperty(this, "_isBackendProfiling", false);

    ProfilerStore_defineProperty(this, "_isProfilingBasedOnUserInput", false);

    ProfilerStore_defineProperty(this, "_rendererIDsThatReportedProfilingData", new Set());

    ProfilerStore_defineProperty(this, "_rendererQueue", new Set());

    ProfilerStore_defineProperty(this, "_takeProfilingSnapshotRecursive", (elementID, profilingSnapshots) => {
      const element = this._store.getElementByID(elementID);

      if (element !== null) {
        const snapshotNode = {
          id: elementID,
          children: element.children.slice(0),
          displayName: element.displayName,
          hocDisplayNames: element.hocDisplayNames,
          key: element.key,
          type: element.type,
          compiledWithForget: element.compiledWithForget
        };
        profilingSnapshots.set(elementID, snapshotNode);
        element.children.forEach(childID => this._takeProfilingSnapshotRecursive(childID, profilingSnapshots));
      }
    });

    ProfilerStore_defineProperty(this, "onBridgeOperations", operations => {
      // The first two values are always rendererID and rootID
      const rendererID = operations[0];
      const rootID = operations[1];

      if (this._isBackendProfiling) {
        let profilingOperations = this._inProgressOperationsByRootID.get(rootID);

        if (profilingOperations == null) {
          profilingOperations = [operations];

          this._inProgressOperationsByRootID.set(rootID, profilingOperations);
        } else {
          profilingOperations.push(operations);
        }

        if (!this._initialRendererIDs.has(rendererID)) {
          this._initialRendererIDs.add(rendererID);
        }

        if (!this._initialSnapshotsByRootID.has(rootID)) {
          this._initialSnapshotsByRootID.set(rootID, new Map());
        }

        this._rendererIDsThatReportedProfilingData.add(rendererID);
      }
    });

    ProfilerStore_defineProperty(this, "onBridgeProfilingData", dataBackend => {
      if (this._isBackendProfiling) {
        // This should never happen, but if it does, then ignore previous profiling data.
        return;
      }

      const {
        rendererID
      } = dataBackend;

      if (!this._rendererQueue.has(rendererID)) {
        throw Error(`Unexpected profiling data update from renderer "${rendererID}"`);
      }

      this._dataBackends.push(dataBackend);

      this._rendererQueue.delete(rendererID);

      if (this._rendererQueue.size === 0) {
        this._dataFrontend = prepareProfilingDataFrontendFromBackendAndStore(this._dataBackends, this._inProgressOperationsByRootID, this._initialSnapshotsByRootID);

        this._dataBackends.splice(0);

        this.emit('isProcessingData');
      }
    });

    ProfilerStore_defineProperty(this, "onBridgeShutdown", () => {
      this._bridge.removeListener('operations', this.onBridgeOperations);

      this._bridge.removeListener('profilingData', this.onBridgeProfilingData);

      this._bridge.removeListener('profilingStatus', this.onProfilingStatus);

      this._bridge.removeListener('shutdown', this.onBridgeShutdown);
    });

    ProfilerStore_defineProperty(this, "onProfilingStatus", isProfiling => {
      if (this._isBackendProfiling === isProfiling) {
        return;
      }

      if (isProfiling) {
        this._dataBackends.splice(0);

        this._dataFrontend = null;

        this._initialRendererIDs.clear();

        this._initialSnapshotsByRootID.clear();

        this._inProgressOperationsByRootID.clear();

        this._rendererIDsThatReportedProfilingData.clear();

        this._rendererQueue.clear(); // Record all renderer IDs initially too (in case of unmount)
        // eslint-disable-next-line no-for-of-loops/no-for-of-loops


        for (const rendererID of this._store.rootIDToRendererID.values()) {
          if (!this._initialRendererIDs.has(rendererID)) {
            this._initialRendererIDs.add(rendererID);
          }
        } // Record snapshot of tree at the time profiling is started.
        // This info is required to handle cases of e.g. nodes being removed during profiling.


        this._store.roots.forEach(rootID => {
          const profilingSnapshots = new Map();

          this._initialSnapshotsByRootID.set(rootID, profilingSnapshots);

          this._takeProfilingSnapshotRecursive(rootID, profilingSnapshots);
        });
      }

      this._isBackendProfiling = isProfiling; // _isProfilingBasedOnUserInput should already be updated from startProfiling, stopProfiling, or constructor.

      if (this._isProfilingBasedOnUserInput !== isProfiling) {
        logEvent({
          event_name: 'error',
          error_message: `Unexpected profiling status. Expected ${this._isProfilingBasedOnUserInput.toString()}, but received ${isProfiling.toString()}.`,
          error_stack: new Error().stack,
          error_component_stack: null
        }); // If happened, fallback to displaying the value from Backend

        this._isProfilingBasedOnUserInput = isProfiling;
      } // Invalidate suspense cache if profiling data is being (re-)recorded.
      // Note that we clear again, in case any views read from the cache while profiling.
      // (That would have resolved a now-stale value without any profiling data.)


      this._cache.invalidate(); // If we've just finished a profiling session, we need to fetch data stored in each renderer interface
      // and re-assemble it on the front-end into a format (ProfilingDataFrontend) that can power the Profiler UI.
      // During this time, DevTools UI should probably not be interactive.


      if (!isProfiling) {
        this._dataBackends.splice(0);

        this._rendererQueue.clear(); // Only request data from renderers that actually logged it.
        // This avoids unnecessary bridge requests and also avoids edge case mixed renderer bugs.
        // (e.g. when v15 and v16 are both present)


        this._rendererIDsThatReportedProfilingData.forEach(rendererID => {
          if (!this._rendererQueue.has(rendererID)) {
            this._rendererQueue.add(rendererID);

            this._bridge.send('getProfilingData', {
              rendererID
            });
          }
        });

        this.emit('isProcessingData');
      }
    });

    this._bridge = bridge;
    this._isBackendProfiling = defaultIsProfiling;
    this._isProfilingBasedOnUserInput = defaultIsProfiling;
    this._store = store;
    bridge.addListener('operations', this.onBridgeOperations);
    bridge.addListener('profilingData', this.onBridgeProfilingData);
    bridge.addListener('profilingStatus', this.onProfilingStatus);
    bridge.addListener('shutdown', this.onBridgeShutdown); // It's possible that profiling has already started (e.g. "reload and start profiling")
    // so the frontend needs to ask the backend for its status after mounting.

    bridge.send('getProfilingStatus');
    this._cache = new ProfilingCache(this);
  }

  getCommitData(rootID, commitIndex) {
    if (this._dataFrontend !== null) {
      const dataForRoot = this._dataFrontend.dataForRoots.get(rootID);

      if (dataForRoot != null) {
        const commitDatum = dataForRoot.commitData[commitIndex];

        if (commitDatum != null) {
          return commitDatum;
        }
      }
    }

    throw Error(`Could not find commit data for root "${rootID}" and commit "${commitIndex}"`);
  }

  getDataForRoot(rootID) {
    if (this._dataFrontend !== null) {
      const dataForRoot = this._dataFrontend.dataForRoots.get(rootID);

      if (dataForRoot != null) {
        return dataForRoot;
      }
    }

    throw Error(`Could not find commit data for root "${rootID}"`);
  } // Profiling data has been recorded for at least one root.


  get didRecordCommits() {
    return this._dataFrontend !== null && this._dataFrontend.dataForRoots.size > 0;
  }

  get isProcessingData() {
    return this._rendererQueue.size > 0 || this._dataBackends.length > 0;
  }

  get isProfilingBasedOnUserInput() {
    return this._isProfilingBasedOnUserInput;
  }

  get profilingCache() {
    return this._cache;
  }

  get profilingData() {
    return this._dataFrontend;
  }

  set profilingData(value) {
    if (this._isBackendProfiling) {
      console.warn('Profiling data cannot be updated while profiling is in progress.');
      return;
    }

    this._dataBackends.splice(0);

    this._dataFrontend = value;

    this._initialRendererIDs.clear();

    this._initialSnapshotsByRootID.clear();

    this._inProgressOperationsByRootID.clear();

    this._cache.invalidate();

    this.emit('profilingData');
  }

  clear() {
    this._dataBackends.splice(0);

    this._dataFrontend = null;

    this._initialRendererIDs.clear();

    this._initialSnapshotsByRootID.clear();

    this._inProgressOperationsByRootID.clear();

    this._rendererQueue.clear(); // Invalidate suspense cache if profiling data is being (re-)recorded.
    // Note that we clear now because any existing data is "stale".


    this._cache.invalidate();

    this.emit('profilingData');
  }

  startProfiling() {
    this.clear();

    this._bridge.send('startProfiling', {
      recordChangeDescriptions: this._store.recordChangeDescriptions,
      recordTimeline: this._store.supportsTimeline
    });

    this._isProfilingBasedOnUserInput = true;
    this.emit('isProfiling'); // Don't actually update the local profiling boolean yet!
    // Wait for onProfilingStatus() to confirm the status has changed.
    // This ensures the frontend and backend are in sync wrt which commits were profiled.
    // We do this to avoid mismatches on e.g. CommitTreeBuilder that would cause errors.
  }

  stopProfiling() {
    this._bridge.send('stopProfiling'); // Backend might be busy serializing the payload, so we are going to display
    // optimistic UI to the user that profiling is stopping.


    this._isProfilingBasedOnUserInput = false;
    this.emit('isProfiling'); // Wait for onProfilingStatus() to confirm the status has changed, this will update _isBackendProfiling.
    // This ensures the frontend and backend are in sync wrt which commits were profiled.
    // We do this to avoid mismatches on e.g. CommitTreeBuilder that would cause errors.
  }

}
;// CONCATENATED MODULE: ../react-devtools-shared/src/errors/PermissionNotGrantedError.js
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */
class PermissionNotGrantedError extends Error {
  constructor() {
    super("User didn't grant the required permission to perform an action"); // Maintains proper stack trace for where our error was thrown (only available on V8)

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PermissionNotGrantedError);
    }

    this.name = 'PermissionNotGrantedError';
  }

}
;// CONCATENATED MODULE: ../react-devtools-shared/src/frontend/utils/withPermissionsCheck.js
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */

// browser.permissions is not available for DevTools pages in Firefox
// https://bugzilla.mozilla.org/show_bug.cgi?id=1796933
// We are going to assume that requested permissions are not optional.
function withPermissionsCheck(options, callback) {
  if (true) {
    return callback;
  } else {}
}
;// CONCATENATED MODULE: ../react-devtools-shared/src/UnsupportedBridgeOperationError.js
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */
class UnsupportedBridgeOperationError extends Error {
  constructor(message) {
    super(message); // Maintains proper stack trace for where our error was thrown (only available on V8)

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, UnsupportedBridgeOperationError);
    }

    this.name = 'UnsupportedBridgeOperationError';
  }

}
;// CONCATENATED MODULE: ../react-devtools-shared/src/devtools/store.js
function store_defineProperty(obj, key, value) { key = store_toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function store_toPropertyKey(t) { var i = store_toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }

function store_toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }

/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */















const store_debug = (methodName, ...args) => {
  if (__DEBUG__) {
    console.log(`%cStore %c${methodName}`, 'color: green; font-weight: bold;', 'font-weight: bold;', ...args);
  }
};

const LOCAL_STORAGE_COLLAPSE_ROOTS_BY_DEFAULT_KEY = 'React::DevTools::collapseNodesByDefault';
const LOCAL_STORAGE_RECORD_CHANGE_DESCRIPTIONS_KEY = 'React::DevTools::recordChangeDescriptions';

/**
 * The store is the single source of truth for updates from the backend.
 * ContextProviders can subscribe to the Store for specific things they want to provide.
 */
class Store extends EventEmitter {
  // If the backend version is new enough to report its (NPM) version, this is it.
  // This version may be displayed by the frontend for debugging purposes.
  // Computed whenever _errorsAndWarnings Map changes.
  // Should new nodes be collapsed by default when added to the tree?
  // Map of ID to number of recorded error and warning message IDs.
  // At least one of the injected renderers contains (DEV only) owner metadata.
  // Map of ID to (mutable) Element.
  // Elements are mutated to avoid excessive cloning during tree updates.
  // The InspectedElement Suspense cache also relies on this mutability for its WeakMap usage.
  // Should the React Native style editor panel be shown?
  // Older backends don't support an explicit bridge protocol,
  // so we should timeout eventually and show a downgrade message.
  // Map of element (id) to the set of elements (ids) it owns.
  // This map enables getOwnersListForElement() to avoid traversing the entire tree.
  // Incremented each time the store is mutated.
  // This enables a passive effect to detect a mutation between render and commit phase.
  // This Array must be treated as immutable!
  // Passive effects will check it for changes between render and mount.
  // Renderer ID is needed to support inspection fiber props, state, and hooks.
  // These options may be initially set by a configuration option when constructing the Store.
  // These options default to false but may be updated as roots are added and removed.
  // Total number of visible elements (within all roots).
  // Used for windowing purposes.
  // Only used in browser extension for synchronization with built-in Elements panel.
  constructor(_bridge, config) {
    super();

    store_defineProperty(this, "_backendVersion", null);

    store_defineProperty(this, "_cachedComponentWithErrorCount", 0);

    store_defineProperty(this, "_cachedComponentWithWarningCount", 0);

    store_defineProperty(this, "_cachedErrorAndWarningTuples", null);

    store_defineProperty(this, "_collapseNodesByDefault", true);

    store_defineProperty(this, "_errorsAndWarnings", new Map());

    store_defineProperty(this, "_hasOwnerMetadata", false);

    store_defineProperty(this, "_idToElement", new Map());

    store_defineProperty(this, "_isNativeStyleEditorSupported", false);

    store_defineProperty(this, "_nativeStyleEditorValidAttributes", null);

    store_defineProperty(this, "_onBridgeProtocolTimeoutID", null);

    store_defineProperty(this, "_ownersMap", new Map());

    store_defineProperty(this, "_recordChangeDescriptions", false);

    store_defineProperty(this, "_revision", 0);

    store_defineProperty(this, "_roots", []);

    store_defineProperty(this, "_rootIDToCapabilities", new Map());

    store_defineProperty(this, "_rootIDToRendererID", new Map());

    store_defineProperty(this, "_supportsInspectMatchingDOMElement", false);

    store_defineProperty(this, "_supportsClickToInspect", false);

    store_defineProperty(this, "_supportsTimeline", false);

    store_defineProperty(this, "_supportsTraceUpdates", false);

    store_defineProperty(this, "_isReloadAndProfileFrontendSupported", false);

    store_defineProperty(this, "_isReloadAndProfileBackendSupported", false);

    store_defineProperty(this, "_rootSupportsBasicProfiling", false);

    store_defineProperty(this, "_rootSupportsTimelineProfiling", false);

    store_defineProperty(this, "_bridgeProtocol", null);

    store_defineProperty(this, "_unsupportedBridgeProtocolDetected", false);

    store_defineProperty(this, "_unsupportedRendererVersionDetected", false);

    store_defineProperty(this, "_weightAcrossRoots", 0);

    store_defineProperty(this, "_shouldCheckBridgeProtocolCompatibility", false);

    store_defineProperty(this, "_hookSettings", null);

    store_defineProperty(this, "_shouldShowWarningsAndErrors", false);

    store_defineProperty(this, "_lastSelectedHostInstanceElementId", null);

    store_defineProperty(this, "_adjustParentTreeWeight", (parentElement, weightDelta) => {
      let isInsideCollapsedSubTree = false;

      while (parentElement != null) {
        parentElement.weight += weightDelta; // Additions and deletions within a collapsed subtree should not bubble beyond the collapsed parent.
        // Their weight will bubble up when the parent is expanded.

        if (parentElement.isCollapsed) {
          isInsideCollapsedSubTree = true;
          break;
        }

        parentElement = this._idToElement.get(parentElement.parentID);
      } // Additions and deletions within a collapsed subtree should not affect the overall number of elements.


      if (!isInsideCollapsedSubTree) {
        this._weightAcrossRoots += weightDelta;
      }
    });

    store_defineProperty(this, "onBridgeNativeStyleEditorSupported", ({
      isSupported,
      validAttributes
    }) => {
      this._isNativeStyleEditorSupported = isSupported;
      this._nativeStyleEditorValidAttributes = validAttributes || null;
      this.emit('supportsNativeStyleEditor');
    });

    store_defineProperty(this, "onBridgeOperations", operations => {
      if (__DEBUG__) {
        console.groupCollapsed('onBridgeOperations');
        store_debug('onBridgeOperations', operations.join(','));
      }

      let haveRootsChanged = false;
      let haveErrorsOrWarningsChanged = false; // The first two values are always rendererID and rootID

      const rendererID = operations[0];
      const addedElementIDs = []; // This is a mapping of removed ID -> parent ID:

      const removedElementIDs = new Map(); // We'll use the parent ID to adjust selection if it gets deleted.

      let i = 2; // Reassemble the string table.

      const stringTable = [null // ID = 0 corresponds to the null string.
      ];
      const stringTableSize = operations[i];
      i++;
      const stringTableEnd = i + stringTableSize;

      while (i < stringTableEnd) {
        const nextLength = operations[i];
        i++;
        const nextString = utfDecodeStringWithRanges(operations, i, i + nextLength - 1);
        stringTable.push(nextString);
        i += nextLength;
      }

      while (i < operations.length) {
        const operation = operations[i];

        switch (operation) {
          case constants_TREE_OPERATION_ADD:
            {
              const id = operations[i + 1];
              const type = operations[i + 2];
              i += 3;

              if (this._idToElement.has(id)) {
                this._throwAndEmitError(Error(`Cannot add node "${id}" because a node with that id is already in the Store.`));
              }

              if (type === types_ElementTypeRoot) {
                if (__DEBUG__) {
                  store_debug('Add', `new root node ${id}`);
                }

                const isStrictModeCompliant = operations[i] > 0;
                i++;
                const supportsBasicProfiling = (operations[i] & PROFILING_FLAG_BASIC_SUPPORT) !== 0;
                const supportsTimeline = (operations[i] & PROFILING_FLAG_TIMELINE_SUPPORT) !== 0;
                i++;
                let supportsStrictMode = false;
                let hasOwnerMetadata = false; // If we don't know the bridge protocol, guess that we're dealing with the latest.
                // If we do know it, we can take it into consideration when parsing operations.

                if (this._bridgeProtocol === null || this._bridgeProtocol.version >= 2) {
                  supportsStrictMode = operations[i] > 0;
                  i++;
                  hasOwnerMetadata = operations[i] > 0;
                  i++;
                }

                this._roots = this._roots.concat(id);

                this._rootIDToRendererID.set(id, rendererID);

                this._rootIDToCapabilities.set(id, {
                  supportsBasicProfiling,
                  hasOwnerMetadata,
                  supportsStrictMode,
                  supportsTimeline
                }); // Not all roots support StrictMode;
                // don't flag a root as non-compliant unless it also supports StrictMode.


                const isStrictModeNonCompliant = !isStrictModeCompliant && supportsStrictMode;

                this._idToElement.set(id, {
                  children: [],
                  depth: -1,
                  displayName: null,
                  hocDisplayNames: null,
                  id,
                  isCollapsed: false,
                  // Never collapse roots; it would hide the entire tree.
                  isStrictModeNonCompliant,
                  key: null,
                  ownerID: 0,
                  parentID: 0,
                  type,
                  weight: 0,
                  compiledWithForget: false
                });

                haveRootsChanged = true;
              } else {
                const parentID = operations[i];
                i++;
                const ownerID = operations[i];
                i++;
                const displayNameStringID = operations[i];
                const displayName = stringTable[displayNameStringID];
                i++;
                const keyStringID = operations[i];
                const key = stringTable[keyStringID];
                i++;

                if (__DEBUG__) {
                  store_debug('Add', `node ${id} (${displayName || 'null'}) as child of ${parentID}`);
                }

                const parentElement = this._idToElement.get(parentID);

                if (parentElement === undefined) {
                  this._throwAndEmitError(Error(`Cannot add child "${id}" to parent "${parentID}" because parent node was not found in the Store.`));

                  break;
                }

                parentElement.children.push(id);
                const {
                  formattedDisplayName: displayNameWithoutHOCs,
                  hocDisplayNames,
                  compiledWithForget
                } = parseElementDisplayNameFromBackend(displayName, type);
                const element = {
                  children: [],
                  depth: parentElement.depth + 1,
                  displayName: displayNameWithoutHOCs,
                  hocDisplayNames,
                  id,
                  isCollapsed: this._collapseNodesByDefault,
                  isStrictModeNonCompliant: parentElement.isStrictModeNonCompliant,
                  key,
                  ownerID,
                  parentID,
                  type,
                  weight: 1,
                  compiledWithForget
                };

                this._idToElement.set(id, element);

                addedElementIDs.push(id);

                this._adjustParentTreeWeight(parentElement, 1);

                if (ownerID > 0) {
                  let set = this._ownersMap.get(ownerID);

                  if (set === undefined) {
                    set = new Set();

                    this._ownersMap.set(ownerID, set);
                  }

                  set.add(id);
                }
              }

              break;
            }

          case constants_TREE_OPERATION_REMOVE:
            {
              const removeLength = operations[i + 1];
              i += 2;

              for (let removeIndex = 0; removeIndex < removeLength; removeIndex++) {
                const id = operations[i];

                const element = this._idToElement.get(id);

                if (element === undefined) {
                  this._throwAndEmitError(Error(`Cannot remove node "${id}" because no matching node was found in the Store.`));

                  break;
                }

                i += 1;
                const {
                  children,
                  ownerID,
                  parentID,
                  weight
                } = element;

                if (children.length > 0) {
                  this._throwAndEmitError(Error(`Node "${id}" was removed before its children.`));
                }

                this._idToElement.delete(id);

                let parentElement = null;

                if (parentID === 0) {
                  if (__DEBUG__) {
                    store_debug('Remove', `node ${id} root`);
                  }

                  this._roots = this._roots.filter(rootID => rootID !== id);

                  this._rootIDToRendererID.delete(id);

                  this._rootIDToCapabilities.delete(id);

                  haveRootsChanged = true;
                } else {
                  if (__DEBUG__) {
                    store_debug('Remove', `node ${id} from parent ${parentID}`);
                  }

                  parentElement = this._idToElement.get(parentID);

                  if (parentElement === undefined) {
                    this._throwAndEmitError(Error(`Cannot remove node "${id}" from parent "${parentID}" because no matching node was found in the Store.`));

                    break;
                  }

                  const index = parentElement.children.indexOf(id);
                  parentElement.children.splice(index, 1);
                }

                this._adjustParentTreeWeight(parentElement, -weight);

                removedElementIDs.set(id, parentID);

                this._ownersMap.delete(id);

                if (ownerID > 0) {
                  const set = this._ownersMap.get(ownerID);

                  if (set !== undefined) {
                    set.delete(id);
                  }
                }

                if (this._errorsAndWarnings.has(id)) {
                  this._errorsAndWarnings.delete(id);

                  haveErrorsOrWarningsChanged = true;
                }
              }

              break;
            }

          case constants_TREE_OPERATION_REMOVE_ROOT:
            {
              i += 1;
              const id = operations[1];

              if (__DEBUG__) {
                store_debug(`Remove root ${id}`);
              }

              const recursivelyDeleteElements = elementID => {
                const element = this._idToElement.get(elementID);

                this._idToElement.delete(elementID);

                if (element) {
                  // Mostly for Flow's sake
                  for (let index = 0; index < element.children.length; index++) {
                    recursivelyDeleteElements(element.children[index]);
                  }
                }
              };

              const root = this._idToElement.get(id);

              if (root === undefined) {
                this._throwAndEmitError(Error(`Cannot remove root "${id}": no matching node was found in the Store.`));

                break;
              }

              recursivelyDeleteElements(id);

              this._rootIDToCapabilities.delete(id);

              this._rootIDToRendererID.delete(id);

              this._roots = this._roots.filter(rootID => rootID !== id);
              this._weightAcrossRoots -= root.weight;
              break;
            }

          case constants_TREE_OPERATION_REORDER_CHILDREN:
            {
              const id = operations[i + 1];
              const numChildren = operations[i + 2];
              i += 3;

              const element = this._idToElement.get(id);

              if (element === undefined) {
                this._throwAndEmitError(Error(`Cannot reorder children for node "${id}" because no matching node was found in the Store.`));

                break;
              }

              const children = element.children;

              if (children.length !== numChildren) {
                this._throwAndEmitError(Error(`Children cannot be added or removed during a reorder operation.`));
              }

              for (let j = 0; j < numChildren; j++) {
                const childID = operations[i + j];
                children[j] = childID;

                if (false) {}
              }

              i += numChildren;

              if (__DEBUG__) {
                store_debug('Re-order', `Node ${id} children ${children.join(',')}`);
              }

              break;
            }

          case constants_TREE_OPERATION_SET_SUBTREE_MODE:
            {
              const id = operations[i + 1];
              const mode = operations[i + 2];
              i += 3; // If elements have already been mounted in this subtree, update them.
              // (In practice, this likely only applies to the root element.)

              if (mode === StrictMode) {
                this._recursivelyUpdateSubtree(id, element => {
                  element.isStrictModeNonCompliant = false;
                });
              }

              if (__DEBUG__) {
                store_debug('Subtree mode', `Subtree with root ${id} set to mode ${mode}`);
              }

              break;
            }

          case constants_TREE_OPERATION_UPDATE_TREE_BASE_DURATION:
            // Base duration updates are only sent while profiling is in progress.
            // We can ignore them at this point.
            // The profiler UI uses them lazily in order to generate the tree.
            i += 3;
            break;

          case constants_TREE_OPERATION_UPDATE_ERRORS_OR_WARNINGS:
            const id = operations[i + 1];
            const errorCount = operations[i + 2];
            const warningCount = operations[i + 3];
            i += 4;

            if (errorCount > 0 || warningCount > 0) {
              this._errorsAndWarnings.set(id, {
                errorCount,
                warningCount
              });
            } else if (this._errorsAndWarnings.has(id)) {
              this._errorsAndWarnings.delete(id);
            }

            haveErrorsOrWarningsChanged = true;
            break;

          default:
            this._throwAndEmitError(new UnsupportedBridgeOperationError(`Unsupported Bridge operation "${operation}"`));

        }
      }

      this._revision++; // Any time the tree changes (e.g. elements added, removed, or reordered) cached indices may be invalid.

      this._cachedErrorAndWarningTuples = null;

      if (haveErrorsOrWarningsChanged) {
        let componentWithErrorCount = 0;
        let componentWithWarningCount = 0;

        this._errorsAndWarnings.forEach(entry => {
          if (entry.errorCount > 0) {
            componentWithErrorCount++;
          }

          if (entry.warningCount > 0) {
            componentWithWarningCount++;
          }
        });

        this._cachedComponentWithErrorCount = componentWithErrorCount;
        this._cachedComponentWithWarningCount = componentWithWarningCount;
      }

      if (haveRootsChanged) {
        const prevRootSupportsProfiling = this._rootSupportsBasicProfiling;
        const prevRootSupportsTimelineProfiling = this._rootSupportsTimelineProfiling;
        this._hasOwnerMetadata = false;
        this._rootSupportsBasicProfiling = false;
        this._rootSupportsTimelineProfiling = false;

        this._rootIDToCapabilities.forEach(({
          supportsBasicProfiling,
          hasOwnerMetadata,
          supportsTimeline
        }) => {
          if (supportsBasicProfiling) {
            this._rootSupportsBasicProfiling = true;
          }

          if (hasOwnerMetadata) {
            this._hasOwnerMetadata = true;
          }

          if (supportsTimeline) {
            this._rootSupportsTimelineProfiling = true;
          }
        });

        this.emit('roots');

        if (this._rootSupportsBasicProfiling !== prevRootSupportsProfiling) {
          this.emit('rootSupportsBasicProfiling');
        }

        if (this._rootSupportsTimelineProfiling !== prevRootSupportsTimelineProfiling) {
          this.emit('rootSupportsTimelineProfiling');
        }
      }

      if (__DEBUG__) {
        console.log(printStore(this, true));
        console.groupEnd();
      }

      this.emit('mutated', [addedElementIDs, removedElementIDs]);
    });

    store_defineProperty(this, "onBridgeOverrideComponentFilters", componentFilters => {
      this._componentFilters = componentFilters;
      setSavedComponentFilters(componentFilters);
    });

    store_defineProperty(this, "onBridgeShutdown", () => {
      if (__DEBUG__) {
        store_debug('onBridgeShutdown', 'unsubscribing from Bridge');
      }

      const bridge = this._bridge;
      bridge.removeListener('operations', this.onBridgeOperations);
      bridge.removeListener('overrideComponentFilters', this.onBridgeOverrideComponentFilters);
      bridge.removeListener('shutdown', this.onBridgeShutdown);
      bridge.removeListener('isReloadAndProfileSupportedByBackend', this.onBackendReloadAndProfileSupported);
      bridge.removeListener('isNativeStyleEditorSupported', this.onBridgeNativeStyleEditorSupported);
      bridge.removeListener('unsupportedRendererVersion', this.onBridgeUnsupportedRendererVersion);
      bridge.removeListener('backendVersion', this.onBridgeBackendVersion);
      bridge.removeListener('bridgeProtocol', this.onBridgeProtocol);
      bridge.removeListener('saveToClipboard', this.onSaveToClipboard);
      bridge.removeListener('selectElement', this.onHostInstanceSelected);

      if (this._onBridgeProtocolTimeoutID !== null) {
        clearTimeout(this._onBridgeProtocolTimeoutID);
        this._onBridgeProtocolTimeoutID = null;
      }
    });

    store_defineProperty(this, "onBackendReloadAndProfileSupported", isReloadAndProfileSupported => {
      this._isReloadAndProfileBackendSupported = isReloadAndProfileSupported;
      this.emit('supportsReloadAndProfile');
    });

    store_defineProperty(this, "onBridgeUnsupportedRendererVersion", () => {
      this._unsupportedRendererVersionDetected = true;
      this.emit('unsupportedRendererVersionDetected');
    });

    store_defineProperty(this, "onBridgeBackendVersion", backendVersion => {
      this._backendVersion = backendVersion;
      this.emit('backendVersion');
    });

    store_defineProperty(this, "onBridgeProtocol", bridgeProtocol => {
      if (this._onBridgeProtocolTimeoutID !== null) {
        clearTimeout(this._onBridgeProtocolTimeoutID);
        this._onBridgeProtocolTimeoutID = null;
      }

      this._bridgeProtocol = bridgeProtocol;

      if (bridgeProtocol.version !== currentBridgeProtocol.version) {// Technically newer versions of the frontend can, at least for now,
        // gracefully handle older versions of the backend protocol.
        // So for now we don't need to display the unsupported dialog.
      }
    });

    store_defineProperty(this, "onBridgeProtocolTimeout", () => {
      this._onBridgeProtocolTimeoutID = null; // If we timed out, that indicates the backend predates the bridge protocol,
      // so we can set a fake version (0) to trigger the downgrade message.

      this._bridgeProtocol = BRIDGE_PROTOCOL[0];
      this.emit('unsupportedBridgeProtocolDetected');
    });

    store_defineProperty(this, "onSaveToClipboard", text => {
      withPermissionsCheck({
        permissions: ['clipboardWrite']
      }, () => (0,clipboard.copy)(text))();
    });

    store_defineProperty(this, "onBackendInitialized", () => {
      // Verify that the frontend version is compatible with the connected backend.
      // See github.com/facebook/react/issues/21326
      if (this._shouldCheckBridgeProtocolCompatibility) {
        // Older backends don't support an explicit bridge protocol,
        // so we should timeout eventually and show a downgrade message.
        this._onBridgeProtocolTimeoutID = setTimeout(this.onBridgeProtocolTimeout, 10000);

        this._bridge.addListener('bridgeProtocol', this.onBridgeProtocol);

        this._bridge.send('getBridgeProtocol');
      }

      this._bridge.send('getBackendVersion');

      this._bridge.send('getIfHasUnsupportedRendererVersion');

      this._bridge.send('getHookSettings'); // Warm up cached hook settings

    });

    store_defineProperty(this, "onHostInstanceSelected", elementId => {
      if (this._lastSelectedHostInstanceElementId === elementId) {
        return;
      }

      this._lastSelectedHostInstanceElementId = elementId; // By the time we emit this, there is no guarantee that TreeContext is rendered.

      this.emit('hostInstanceSelected', elementId);
    });

    store_defineProperty(this, "getHookSettings", () => {
      if (this._hookSettings != null) {
        this.emit('hookSettings', this._hookSettings);
      } else {
        this._bridge.send('getHookSettings');
      }
    });

    store_defineProperty(this, "updateHookSettings", settings => {
      this._hookSettings = settings;

      this._bridge.send('updateHookSettings', settings);

      this.emit('settingsUpdated', settings);
    });

    store_defineProperty(this, "onHookSettings", settings => {
      this._hookSettings = settings;
      this.setShouldShowWarningsAndErrors(settings.showInlineWarningsAndErrors);
      this.emit('hookSettings', settings);
    });

    if (__DEBUG__) {
      store_debug('constructor', 'subscribing to Bridge');
    }

    this._collapseNodesByDefault = storage_localStorageGetItem(LOCAL_STORAGE_COLLAPSE_ROOTS_BY_DEFAULT_KEY) === 'true';
    this._recordChangeDescriptions = storage_localStorageGetItem(LOCAL_STORAGE_RECORD_CHANGE_DESCRIPTIONS_KEY) === 'true';
    this._componentFilters = getSavedComponentFilters();
    let isProfiling = false;

    if (config != null) {
      isProfiling = config.isProfiling === true;
      const {
        supportsInspectMatchingDOMElement,
        supportsClickToInspect,
        supportsReloadAndProfile,
        supportsTimeline,
        supportsTraceUpdates,
        checkBridgeProtocolCompatibility
      } = config;

      if (supportsInspectMatchingDOMElement) {
        this._supportsInspectMatchingDOMElement = true;
      }

      if (supportsClickToInspect) {
        this._supportsClickToInspect = true;
      }

      if (supportsReloadAndProfile) {
        this._isReloadAndProfileFrontendSupported = true;
      }

      if (supportsTimeline) {
        this._supportsTimeline = true;
      }

      if (supportsTraceUpdates) {
        this._supportsTraceUpdates = true;
      }

      if (checkBridgeProtocolCompatibility) {
        this._shouldCheckBridgeProtocolCompatibility = true;
      }
    }

    this._bridge = _bridge;

    _bridge.addListener('operations', this.onBridgeOperations);

    _bridge.addListener('overrideComponentFilters', this.onBridgeOverrideComponentFilters);

    _bridge.addListener('shutdown', this.onBridgeShutdown);

    _bridge.addListener('isReloadAndProfileSupportedByBackend', this.onBackendReloadAndProfileSupported);

    _bridge.addListener('isNativeStyleEditorSupported', this.onBridgeNativeStyleEditorSupported);

    _bridge.addListener('unsupportedRendererVersion', this.onBridgeUnsupportedRendererVersion);

    this._profilerStore = new ProfilerStore(_bridge, this, isProfiling);

    _bridge.addListener('backendVersion', this.onBridgeBackendVersion);

    _bridge.addListener('saveToClipboard', this.onSaveToClipboard);

    _bridge.addListener('hookSettings', this.onHookSettings);

    _bridge.addListener('backendInitialized', this.onBackendInitialized);

    _bridge.addListener('selectElement', this.onHostInstanceSelected);
  } // This is only used in tests to avoid memory leaks.


  assertExpectedRootMapSizes() {
    if (this.roots.length === 0) {
      // The only safe time to assert these maps are empty is when the store is empty.
      this.assertMapSizeMatchesRootCount(this._idToElement, '_idToElement');
      this.assertMapSizeMatchesRootCount(this._ownersMap, '_ownersMap');
    } // These maps should always be the same size as the number of roots


    this.assertMapSizeMatchesRootCount(this._rootIDToCapabilities, '_rootIDToCapabilities');
    this.assertMapSizeMatchesRootCount(this._rootIDToRendererID, '_rootIDToRendererID');
  } // This is only used in tests to avoid memory leaks.


  assertMapSizeMatchesRootCount(map, mapName) {
    const expectedSize = this.roots.length;

    if (map.size !== expectedSize) {
      this._throwAndEmitError(Error(`Expected ${mapName} to contain ${expectedSize} items, but it contains ${map.size} items\n\n${(0,util.inspect)(map, {
        depth: 20
      })}`));
    }
  }

  get backendVersion() {
    return this._backendVersion;
  }

  get collapseNodesByDefault() {
    return this._collapseNodesByDefault;
  }

  set collapseNodesByDefault(value) {
    this._collapseNodesByDefault = value;
    localStorageSetItem(LOCAL_STORAGE_COLLAPSE_ROOTS_BY_DEFAULT_KEY, value ? 'true' : 'false');
    this.emit('collapseNodesByDefault');
  }

  get componentFilters() {
    return this._componentFilters;
  }

  set componentFilters(value) {
    if (this._profilerStore.isProfilingBasedOnUserInput) {
      // Re-mounting a tree while profiling is in progress might break a lot of assumptions.
      // If necessary, we could support this- but it doesn't seem like a necessary use case.
      this._throwAndEmitError(Error('Cannot modify filter preferences while profiling'));
    } // Filter updates are expensive to apply (since they impact the entire tree).
    // Let's determine if they've changed and avoid doing this work if they haven't.


    const prevEnabledComponentFilters = this._componentFilters.filter(filter => filter.isEnabled);

    const nextEnabledComponentFilters = value.filter(filter => filter.isEnabled);
    let haveEnabledFiltersChanged = prevEnabledComponentFilters.length !== nextEnabledComponentFilters.length;

    if (!haveEnabledFiltersChanged) {
      for (let i = 0; i < nextEnabledComponentFilters.length; i++) {
        const prevFilter = prevEnabledComponentFilters[i];
        const nextFilter = nextEnabledComponentFilters[i];

        if (shallowDiffers(prevFilter, nextFilter)) {
          haveEnabledFiltersChanged = true;
          break;
        }
      }
    }

    this._componentFilters = value; // Update persisted filter preferences stored in localStorage.

    setSavedComponentFilters(value); // Notify the renderer that filter preferences have changed.
    // This is an expensive operation; it unmounts and remounts the entire tree,
    // so only do it if the set of enabled component filters has changed.

    if (haveEnabledFiltersChanged) {
      this._bridge.send('updateComponentFilters', value);
    }

    this.emit('componentFilters');
  }

  get bridgeProtocol() {
    return this._bridgeProtocol;
  }

  get componentWithErrorCount() {
    if (!this._shouldShowWarningsAndErrors) {
      return 0;
    }

    return this._cachedComponentWithErrorCount;
  }

  get componentWithWarningCount() {
    if (!this._shouldShowWarningsAndErrors) {
      return 0;
    }

    return this._cachedComponentWithWarningCount;
  }

  get displayingErrorsAndWarningsEnabled() {
    return this._shouldShowWarningsAndErrors;
  }

  get hasOwnerMetadata() {
    return this._hasOwnerMetadata;
  }

  get nativeStyleEditorValidAttributes() {
    return this._nativeStyleEditorValidAttributes;
  }

  get numElements() {
    return this._weightAcrossRoots;
  }

  get profilerStore() {
    return this._profilerStore;
  }

  get recordChangeDescriptions() {
    return this._recordChangeDescriptions;
  }

  set recordChangeDescriptions(value) {
    this._recordChangeDescriptions = value;
    localStorageSetItem(LOCAL_STORAGE_RECORD_CHANGE_DESCRIPTIONS_KEY, value ? 'true' : 'false');
    this.emit('recordChangeDescriptions');
  }

  get revision() {
    return this._revision;
  }

  get rootIDToRendererID() {
    return this._rootIDToRendererID;
  }

  get roots() {
    return this._roots;
  } // At least one of the currently mounted roots support the Legacy profiler.


  get rootSupportsBasicProfiling() {
    return this._rootSupportsBasicProfiling;
  } // At least one of the currently mounted roots support the Timeline profiler.


  get rootSupportsTimelineProfiling() {
    return this._rootSupportsTimelineProfiling;
  }

  get supportsInspectMatchingDOMElement() {
    return this._supportsInspectMatchingDOMElement;
  }

  get supportsClickToInspect() {
    return this._supportsClickToInspect;
  }

  get supportsNativeStyleEditor() {
    return this._isNativeStyleEditorSupported;
  }

  get supportsReloadAndProfile() {
    return this._isReloadAndProfileFrontendSupported && this._isReloadAndProfileBackendSupported;
  } // This build of DevTools supports the Timeline profiler.
  // This is a static flag, controlled by the Store config.


  get supportsTimeline() {
    return this._supportsTimeline;
  }

  get supportsTraceUpdates() {
    return this._supportsTraceUpdates;
  }

  get unsupportedBridgeProtocolDetected() {
    return this._unsupportedBridgeProtocolDetected;
  }

  get unsupportedRendererVersionDetected() {
    return this._unsupportedRendererVersionDetected;
  }

  get lastSelectedHostInstanceElementId() {
    return this._lastSelectedHostInstanceElementId;
  }

  containsElement(id) {
    return this._idToElement.has(id);
  }

  getElementAtIndex(index) {
    if (index < 0 || index >= this.numElements) {
      console.warn(`Invalid index ${index} specified; store contains ${this.numElements} items.`);
      return null;
    } // Find which root this element is in...


    let root;
    let rootWeight = 0;

    for (let i = 0; i < this._roots.length; i++) {
      const rootID = this._roots[i];
      root = this._idToElement.get(rootID);

      if (root === undefined) {
        this._throwAndEmitError(Error(`Couldn't find root with id "${rootID}": no matching node was found in the Store.`));

        return null;
      }

      if (root.children.length === 0) {
        continue;
      }

      if (rootWeight + root.weight > index) {
        break;
      } else {
        rootWeight += root.weight;
      }
    }

    if (root === undefined) {
      return null;
    } // Find the element in the tree using the weight of each node...
    // Skip over the root itself, because roots aren't visible in the Elements tree.


    let currentElement = root;
    let currentWeight = rootWeight - 1;

    while (index !== currentWeight) {
      const numChildren = currentElement.children.length;

      for (let i = 0; i < numChildren; i++) {
        const childID = currentElement.children[i];

        const child = this._idToElement.get(childID);

        if (child === undefined) {
          this._throwAndEmitError(Error(`Couldn't child element with id "${childID}": no matching node was found in the Store.`));

          return null;
        }

        const childWeight = child.isCollapsed ? 1 : child.weight;

        if (index <= currentWeight + childWeight) {
          currentWeight++;
          currentElement = child;
          break;
        } else {
          currentWeight += childWeight;
        }
      }
    }

    return currentElement || null;
  }

  getElementIDAtIndex(index) {
    const element = this.getElementAtIndex(index);
    return element === null ? null : element.id;
  }

  getElementByID(id) {
    const element = this._idToElement.get(id);

    if (element === undefined) {
      console.warn(`No element found with id "${id}"`);
      return null;
    }

    return element;
  } // Returns a tuple of [id, index]


  getElementsWithErrorsAndWarnings() {
    if (!this._shouldShowWarningsAndErrors) {
      return [];
    }

    if (this._cachedErrorAndWarningTuples !== null) {
      return this._cachedErrorAndWarningTuples;
    }

    const errorAndWarningTuples = [];

    this._errorsAndWarnings.forEach((_, id) => {
      const index = this.getIndexOfElementID(id);

      if (index !== null) {
        let low = 0;
        let high = errorAndWarningTuples.length;

        while (low < high) {
          const mid = low + high >> 1;

          if (errorAndWarningTuples[mid].index > index) {
            high = mid;
          } else {
            low = mid + 1;
          }
        }

        errorAndWarningTuples.splice(low, 0, {
          id,
          index
        });
      }
    }); // Cache for later (at least until the tree changes again).


    this._cachedErrorAndWarningTuples = errorAndWarningTuples;
    return errorAndWarningTuples;
  }

  getErrorAndWarningCountForElementID(id) {
    if (!this._shouldShowWarningsAndErrors) {
      return {
        errorCount: 0,
        warningCount: 0
      };
    }

    return this._errorsAndWarnings.get(id) || {
      errorCount: 0,
      warningCount: 0
    };
  }

  getIndexOfElementID(id) {
    const element = this.getElementByID(id);

    if (element === null || element.parentID === 0) {
      return null;
    } // Walk up the tree to the root.
    // Increment the index by one for each node we encounter,
    // and by the weight of all nodes to the left of the current one.
    // This should be a relatively fast way of determining the index of a node within the tree.


    let previousID = id;
    let currentID = element.parentID;
    let index = 0;

    while (true) {
      const current = this._idToElement.get(currentID);

      if (current === undefined) {
        return null;
      }

      const {
        children
      } = current;

      for (let i = 0; i < children.length; i++) {
        const childID = children[i];

        if (childID === previousID) {
          break;
        }

        const child = this._idToElement.get(childID);

        if (child === undefined) {
          return null;
        }

        index += child.isCollapsed ? 1 : child.weight;
      }

      if (current.parentID === 0) {
        // We found the root; stop crawling.
        break;
      }

      index++;
      previousID = current.id;
      currentID = current.parentID;
    } // At this point, the current ID is a root (from the previous loop).
    // We also need to offset the index by previous root weights.


    for (let i = 0; i < this._roots.length; i++) {
      const rootID = this._roots[i];

      if (rootID === currentID) {
        break;
      }

      const root = this._idToElement.get(rootID);

      if (root === undefined) {
        return null;
      }

      index += root.weight;
    }

    return index;
  }

  getOwnersListForElement(ownerID) {
    const list = [];

    const element = this._idToElement.get(ownerID);

    if (element !== undefined) {
      list.push({ ...element,
        depth: 0
      });

      const unsortedIDs = this._ownersMap.get(ownerID);

      if (unsortedIDs !== undefined) {
        const depthMap = new Map([[ownerID, 0]]); // Items in a set are ordered based on insertion.
        // This does not correlate with their order in the tree.
        // So first we need to order them.
        // I wish we could avoid this sorting operation; we could sort at insertion time,
        // but then we'd have to pay sorting costs even if the owners list was never used.
        // Seems better to defer the cost, since the set of ids is probably pretty small.

        const sortedIDs = Array.from(unsortedIDs).sort((idA, idB) => (this.getIndexOfElementID(idA) || 0) - (this.getIndexOfElementID(idB) || 0)); // Next we need to determine the appropriate depth for each element in the list.
        // The depth in the list may not correspond to the depth in the tree,
        // because the list has been filtered to remove intermediate components.
        // Perhaps the easiest way to do this is to walk up the tree until we reach either:
        // (1) another node that's already in the tree, or (2) the root (owner)
        // at which point, our depth is just the depth of that node plus one.

        sortedIDs.forEach(id => {
          const innerElement = this._idToElement.get(id);

          if (innerElement !== undefined) {
            let parentID = innerElement.parentID;
            let depth = 0;

            while (parentID > 0) {
              if (parentID === ownerID || unsortedIDs.has(parentID)) {
                // $FlowFixMe[unsafe-addition] addition with possible null/undefined value
                depth = depthMap.get(parentID) + 1;
                depthMap.set(id, depth);
                break;
              }

              const parent = this._idToElement.get(parentID);

              if (parent === undefined) {
                break;
              }

              parentID = parent.parentID;
            }

            if (depth === 0) {
              this._throwAndEmitError(Error('Invalid owners list'));
            }

            list.push({ ...innerElement,
              depth
            });
          }
        });
      }
    }

    return list;
  }

  getRendererIDForElement(id) {
    let current = this._idToElement.get(id);

    while (current !== undefined) {
      if (current.parentID === 0) {
        const rendererID = this._rootIDToRendererID.get(current.id);

        return rendererID == null ? null : rendererID;
      } else {
        current = this._idToElement.get(current.parentID);
      }
    }

    return null;
  }

  getRootIDForElement(id) {
    let current = this._idToElement.get(id);

    while (current !== undefined) {
      if (current.parentID === 0) {
        return current.id;
      } else {
        current = this._idToElement.get(current.parentID);
      }
    }

    return null;
  }

  isInsideCollapsedSubTree(id) {
    let current = this._idToElement.get(id);

    while (current != null) {
      if (current.parentID === 0) {
        return false;
      } else {
        current = this._idToElement.get(current.parentID);

        if (current != null && current.isCollapsed) {
          return true;
        }
      }
    }

    return false;
  } // TODO Maybe split this into two methods: expand() and collapse()


  toggleIsCollapsed(id, isCollapsed) {
    let didMutate = false;
    const element = this.getElementByID(id);

    if (element !== null) {
      if (isCollapsed) {
        if (element.type === types_ElementTypeRoot) {
          this._throwAndEmitError(Error('Root nodes cannot be collapsed'));
        }

        if (!element.isCollapsed) {
          didMutate = true;
          element.isCollapsed = true;
          const weightDelta = 1 - element.weight;

          let parentElement = this._idToElement.get(element.parentID);

          while (parentElement !== undefined) {
            // We don't need to break on a collapsed parent in the same way as the expand case below.
            // That's because collapsing a node doesn't "bubble" and affect its parents.
            parentElement.weight += weightDelta;
            parentElement = this._idToElement.get(parentElement.parentID);
          }
        }
      } else {
        let currentElement = element;

        while (currentElement != null) {
          const oldWeight = currentElement.isCollapsed ? 1 : currentElement.weight;

          if (currentElement.isCollapsed) {
            didMutate = true;
            currentElement.isCollapsed = false;
            const newWeight = currentElement.isCollapsed ? 1 : currentElement.weight;
            const weightDelta = newWeight - oldWeight;

            let parentElement = this._idToElement.get(currentElement.parentID);

            while (parentElement !== undefined) {
              parentElement.weight += weightDelta;

              if (parentElement.isCollapsed) {
                // It's important to break on a collapsed parent when expanding nodes.
                // That's because expanding a node "bubbles" up and expands all parents as well.
                // Breaking in this case prevents us from over-incrementing the expanded weights.
                break;
              }

              parentElement = this._idToElement.get(parentElement.parentID);
            }
          }

          currentElement = currentElement.parentID !== 0 ? this.getElementByID(currentElement.parentID) : null;
        }
      } // Only re-calculate weights and emit an "update" event if the store was mutated.


      if (didMutate) {
        let weightAcrossRoots = 0;

        this._roots.forEach(rootID => {
          const {
            weight
          } = this.getElementByID(rootID);
          weightAcrossRoots += weight;
        });

        this._weightAcrossRoots = weightAcrossRoots; // The Tree context's search reducer expects an explicit list of ids for nodes that were added or removed.
        // In this  case, we can pass it empty arrays since nodes in a collapsed tree are still there (just hidden).
        // Updating the selected search index later may require auto-expanding a collapsed subtree though.

        this.emit('mutated', [[], new Map()]);
      }
    }
  }

  _recursivelyUpdateSubtree(id, callback) {
    const element = this._idToElement.get(id);

    if (element) {
      callback(element);
      element.children.forEach(child => this._recursivelyUpdateSubtree(child, callback));
    }
  } // Certain backends save filters on a per-domain basis.
  // In order to prevent filter preferences and applied filters from being out of sync,
  // this message enables the backend to override the frontend's current ("saved") filters.
  // This action should also override the saved filters too,
  // else reloading the frontend without reloading the backend would leave things out of sync.


  setShouldShowWarningsAndErrors(status) {
    const previousStatus = this._shouldShowWarningsAndErrors;
    this._shouldShowWarningsAndErrors = status;

    if (previousStatus !== status) {
      // Propagate to subscribers, although tree state has not changed
      this.emit('mutated', [[], new Map()]);
    }
  } // The Store should never throw an Error without also emitting an event.
  // Otherwise Store errors will be invisible to users,
  // but the downstream errors they cause will be reported as bugs.
  // For example, https://github.com/facebook/react/issues/21402
  // Emitting an error event allows the ErrorBoundary to show the original error.


  _throwAndEmitError(error) {
    this.emit('error', error); // Throwing is still valuable for local development
    // and for unit testing the Store itself.

    throw error;
  }

}
;// CONCATENATED MODULE: ./src/headless.js



function createStore(bridge, config) {
  return new Store(bridge, {
    checkBridgeProtocolCompatibility: true,
    supportsTraceUpdates: true,
    supportsTimeline: true,
    ...config
  });
}
function createBridge(wall) {
  return new bridge(wall);
}
})();

var __webpack_exports__createBridge = __webpack_exports__.EH;
var __webpack_exports__createStore = __webpack_exports__.MT;
var __webpack_exports__prepareProfilingDataExport = __webpack_exports__.l3;
var __webpack_exports__prepareProfilingDataFrontendFromExport = __webpack_exports__.TV;
export { __webpack_exports__createBridge as createBridge, __webpack_exports__createStore as createStore, __webpack_exports__prepareProfilingDataExport as prepareProfilingDataExport, __webpack_exports__prepareProfilingDataFrontendFromExport as prepareProfilingDataFrontendFromExport };

//# sourceMappingURL=headless.js.map