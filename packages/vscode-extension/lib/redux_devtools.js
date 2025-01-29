function async(fn) {
   setTimeout(fn, 0);
 }
 
 function str2array(
   str,
 ) {
   return typeof str === "string"
     ? [str]
     : str && str.length > 0
       ? str
       : undefined;
 }
 
 function getRandomId() {
   return Math.random().toString(36).substring(2);
 }

 // interface CommunicationAdatapter {
 //   initAsync(): Promise<void>;
 //   closeAsync(): Promise<void>;
 //   addMessageListenerOnce: (method: string, listener: (params: any) => void) => void;
 //   addMessageListener: (method: string, listener: (params: any) => void) => void;
 //   removeMessageListener: (method: string, listener: (params: any) => void) => void;
 //   sendMessage: (method: string, params: any) => void;
 // }
 
 const getDevToolsPluginClientAsync = async (pluginId) => ({
   addMessageListenerOnce: (method, listener) => {
     console.log("CommunicationAdatapter --> addMessageListenerOnce", method, listener);
   },
   addMessageListener: (method, listener) => {
     console.log("CommunicationAdatapter --> addMessageListener", method, listener);
   },
   removeMessageListener: (method, listener) => {
     console.log("CommunicationAdatapter --> removeMessageListener", method, listener);
   },
   sendMessage: (method, params) => {
     console.log("CommunicationAdatapter --> sendMessage", method, params);
   },
   closeAsync: () => {
     console.log("CommunicationAdatapter --> closeAsync");
   },
   initAsync: () => {
     console.log("CommunicationAdatapter --> initAsync");
   },
 });

 class DevToolsEnhancer {
   // eslint-disable-next-line @typescript-eslint/ban-types
   store;
   filters;
   instanceId;
   devToolsPluginClient;
   devtoolsAgent;
   sendTo;
   instanceName;
   appInstanceId;
   stateSanitizer;
   actionSanitizer;
   isExcess;
   actionCreators;
   isMonitored;
   lastErrorMsg;
   started;
   suppressConnectErrors;
   startOn;
   stopOn;
   sendOn;
   sendOnError;
   channel;
   errorCounts;
   lastAction;
   paused;
   locked;
 
   getInstanceId() {
     if (!this.instanceId) {
       this.instanceId = getRandomId();
     }
     return this.instanceId;
   }
 
   getLiftedStateRaw() {
     return this.store.liftedStore.getState();
   }
 
   getLiftedState() {
     return filterStagedActions(this.getLiftedStateRaw(), this.filters);
   }
 
   send = () => {
     if (!this.sendTo) {
       console.log(
         "redux-devtools-expo-dev-plugin: Cannot send message from sendOn or sendOnError without a sendTo URL being provided",
       );
       return;
     }
 
     try {
       fetch(this.sendTo, {
         method: "POST",
         headers: {
           "content-type": "application/json",
         },
         body: JSON.stringify({
           type: "STATE",
           id: this.getInstanceId(),
           name: this.instanceName,
           payload: stringify(this.getLiftedState()),
         }),
       }).catch(function (err) {
         console.log(err);
       });
     } catch (err) {
       console.log(err);
     }
   };
 
   relay(
     type,
     state,
     action,
     nextActionId,
   ) {
     const message = {
       type,
       id: this.getInstanceId(),
       name: this.instanceName,
       instanceId: this.appInstanceId,
     };
     if (state) {
       message.payload =
         type === "ERROR"
           ? state
           : stringify(
               filterState(
                 state,
                 type,
                 this.filters,
                 this.stateSanitizer,
                 this.actionSanitizer
               ),
             );
     }
     if (type === "ACTION") {
       message.action = stringify(
         !this.actionSanitizer
           ? action
           : this.actionSanitizer(
               action.action,
               nextActionId - 1,
             ),
       );
       message.isExcess = this.isExcess;
       message.nextActionId = nextActionId;
     } else if (action) {
       message.action = action;
     }
     this.devToolsPluginClient?.sendMessage("log", message);
   }
 
   dispatchRemotely(
     action,
   ) {
     try {
       const result = evalAction(
         action,
         this.actionCreators,
       );
       this.store.dispatch(result);
     } catch (e) {
       this.relay("ERROR", e.message);
     }
   }
 
   handleMessages = (message) => {
     if (
       message.type === "IMPORT" ||
       (message.type === "SYNC" &&
         // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
         this.instanceId &&
         // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
         message.id !== this.instanceId)
     ) {
       this.store.liftedStore.dispatch({
         type: "IMPORT_STATE",
         // eslint-disable-next-line @typescript-eslint/ban-types
         nextLiftedState: parse(message.state),
       });
     } else if (message.type === "UPDATE") {
       this.relay("STATE", this.getLiftedState());
     } else if (message.type === "START") {
       this.isMonitored = true;
       if (typeof this.actionCreators === "function")
         this.actionCreators = this.actionCreators();
       this.relay("STATE", this.getLiftedState(), this.actionCreators);
     } else if (message.type === "STOP" || message.type === "DISCONNECTED") {
       this.isMonitored = false;
       this.relay("STOP");
     } else if (message.type === "ACTION") {
       this.dispatchRemotely(message.action);
     } else if (message.type === "DISPATCH") {
       this.store.liftedStore.dispatch(message.action);
     }
   };
 
   sendError = (errorAction) => {
     // Prevent flooding
     if (errorAction.message && errorAction.message === this.lastErrorMsg)
       return;
     this.lastErrorMsg = errorAction.message;
 
     async(() => {
       this.store.dispatch(errorAction);
       if (!this.started) this.send();
     });
   };
 
   init(options) {
     this.instanceName = options.name;
     this.appInstanceId = getRandomId();
     const { blacklist, whitelist, denylist, allowlist } = options.filters || {};
     // TODO
     this.filter = undefined;
     // this.filters = getLocalFilter({
     //   actionsDenylist:
     //     denylist ??
     //     options.actionsDenylist ??
     //     blacklist ??
     //     options.actionsBlacklist,
     //   actionsAllowlist:
     //     allowlist ??
     //     options.actionsAllowlist ??
     //     whitelist ??
     //     options.actionsWhitelist,
     // });
 
     this.suppressConnectErrors =
       options.suppressConnectErrors !== undefined
         ? options.suppressConnectErrors
         : true;
 
     this.startOn = str2array(options.startOn);
     this.stopOn = str2array(options.stopOn);
     this.sendOn = str2array(options.sendOn);
     this.sendOnError = options.sendOnError;
     this.sendTo = options.sendTo;
     if (this.sendOnError === 1) catchErrors(this.sendError);
 
     if (options.actionCreators)
       this.actionCreators = () => getActionsArray(options.actionCreators);
     this.stateSanitizer = options.stateSanitizer;
     this.actionSanitizer = options.actionSanitizer;
   }
 
   stop = async () => {
     this.started = false;
     this.isMonitored = false;
     if (!this.devToolsPluginClient) return;
     await this.devToolsPluginClient.closeAsync();
     this.devToolsPluginClient = undefined;
   };
 
   start = () => {
     if (this.started) return;
 
     (async () => {
       try {
         console.log("----> Starting Redux DevTools!!!!");
         this.devToolsPluginClient = await getDevToolsPluginClientAsync(
           "redux-devtools-expo-dev-plugin",
         );
 
         this.devToolsPluginClient.addMessageListener(
           "respond",
           (data) => {
             this.handleMessages(data);
           },
         );
 
         this.started = true;
         this.relay("START");
       } catch (e) {
         console.warn(
           "Failed to setup Expo dev plugin client from Redux DevTools enhancer: " +
             e.toString(),
         );
         this.stop();
       }
     })();
   };
 
   checkForReducerErrors = (liftedState = this.getLiftedStateRaw()) => {
     if (liftedState.computedStates[liftedState.currentStateIndex].error) {
       if (this.started)
         this.relay("STATE", filterStagedActions(liftedState, this.filters));
       else this.send();
       return true;
     }
     return false;
   };
 
   // eslint-disable-next-line @typescript-eslint/ban-types
   monitorReducer = (state = {}, action) => {
     this.lastAction = action.type;
     if (!this.started && this.sendOnError === 2 && this.store.liftedStore)
       async(this.checkForReducerErrors);
     else if ((action).action) {
       if (
         this.startOn &&
         !this.started &&
         this.startOn.indexOf((action).action.type) !== -1
       )
         async(this.start);
       else if (
         this.stopOn &&
         this.started &&
         this.stopOn.indexOf((action).action.type) !== -1
       )
         async(this.stop);
       else if (
         this.sendOn &&
         !this.started &&
         this.sendOn.indexOf((action).action.type) !== -1
       )
         async(this.send);
     }
     return state;
   };
 
   // eslint-disable-next-line @typescript-eslint/ban-types
   handleChange(state, liftedState, maxAge) {
     if (this.checkForReducerErrors(liftedState)) return;
 
     if (this.lastAction === "PERFORM_ACTION") {
       const nextActionId = liftedState.nextActionId;
       const liftedAction = liftedState.actionsById[nextActionId - 1];
       if (isFiltered(liftedAction.action, this.filters)) return;
       this.relay("ACTION", state, liftedAction, nextActionId);
       if (!this.isExcess && maxAge)
         this.isExcess = liftedState.stagedActionIds.length >= maxAge;
     } else {
       if (this.lastAction === "JUMP_TO_STATE") return;
       if (this.lastAction === "PAUSE_RECORDING") {
         this.paused = liftedState.isPaused;
       } else if (this.lastAction === "LOCK_CHANGES") {
         this.locked = liftedState.isLocked;
       }
       if (this.paused || this.locked) {
         if (this.lastAction) this.lastAction = undefined;
         else return;
       }
       this.relay("STATE", filterStagedActions(liftedState, this.filters));
     }
   }
 
   enhance = (options) => {
     this.init(options);
     const maxAge = options.maxAge || 30;
     const config = options || {};
     config.features = { pause: true, export: true, test: true };
     config.type = 'redux';
     if (config.autoPause === undefined) config.autoPause = true;
     if (config.latency === undefined) config.latency = 500;
     const realtime = typeof config.realtime === "undefined" || config.realtime;

     return (createStore) => {
       return (
         reducer,
         preloadedState,
       ) => {
         this.store = createStore(reducer, preloadedState);
         const origDispatch = this.store.dispatch;
   
         // this.init(store.getState());
         console.log("----> Enhancing Redux Store", this.store.getState());
         const dispatch = (action) => {
           const r = origDispatch(action);

           this.devtoolsAgent?._bridge?.send("RNIDE_plugins", {
             id: 'redux-devtools',
             data: {
               action: action,
               state: this.store.getState(),
             }
           });

           return r;
         };

         console.log("----> this", Object.keys(this));
         if (realtime) this.start();
         this.store.subscribe(() => {
           console.log("subscribe", this.isMonitored, this.store.getState());
           if (this.isMonitored)
             this.handleChange(
               this.store.getState(),
               undefined,
               maxAge,
             );
         });
         

         this.store.dispatch = dispatch;
   
         return this.store;
       };
     };
   }
   // Original enhance method
   // enhance = (options = {}) => {
   //   this.init(options);
   //   const realtime =
   //     typeof options.realtime === "undefined" || options.realtime;
 
   //   const maxAge = options.maxAge || 30;
   //   return ((next) => {
   //     return (reducer, initialState) => {
   //       this.store = configureStore(next, this.monitorReducer, {
   //         maxAge,
   //         trace: options.trace,
   //         traceLimit: options.traceLimit,
   //         shouldCatchErrors: !!this.sendOnError,
   //         shouldHotReload: options.shouldHotReload,
   //         shouldRecordChanges: options.shouldRecordChanges,
   //         shouldStartLocked: options.shouldStartLocked,
   //         pauseActionType: options.pauseActionType || "@@PAUSED",
   //       })(reducer, initialState);
 
   //       if (realtime) this.start();
   //       this.store.subscribe(() => {
   //         if (this.isMonitored)
   //           this.handleChange(
   //             this.store.getState(),
   //             this.getLiftedStateRaw(),
   //             maxAge,
   //           );
   //       });
   //       return this.store;
   //     };
   //   });
   // };
 }

 export const devToolsEnhancer = new DevToolsEnhancer();

 const compose = (options) => (...funcs) => (...args) => {
   function preEnhancer(createStore) {
     return (
       reducer,
       preloadedState,
     ) => {
       devToolsEnhancer.store = createStore(reducer, preloadedState);
       return {
         ...devToolsEnhancer.store,
         dispatch: (action) =>
           devToolsEnhancer.locked
             ? action
             : devToolsEnhancer.store.dispatch(action),
       };
     };
   }

   return [preEnhancer, ...funcs].reduceRight(
     (composed, f) => f(composed),
     devToolsEnhancer.enhance(options)(
       ...(args),
     ),
   );
 };

 function composeWithDevTools(
   ...funcs
 ) {
   if (funcs.length === 0) {
     return new devToolsEnhancer.enhance();
   }
   if (funcs.length === 1 && typeof funcs[0] === "object") {
     return compose(funcs[0]);
   }
   return compose({})(...(funcs));
 }

 window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ = composeWithDevTools;


 // taken from https://github.com/reduxjs/redux-devtools/blob/5b33056bc5b4ae33e1f05eaeac263ede8c8bc071/extension/src/pageScript/index.ts#L645
 
 // let generateIdCounter = 0;

 // function generateId(instanceId) {
 //   return instanceId || ++generateIdCounter;
 // }

 // const preEnhancer = (instanceId) => (next) => (reducer, preloadedState) => {
 //   const store = next(reducer, preloadedState);

 //   if (stores[instanceId]) {
 //     (stores[instanceId].initialDispatch) = store.dispatch;
 //   }

 //   return {
 //     ...store,
 //     dispatch: (...args) =>
 //       !window.__REDUX_DEVTOOLS_EXTENSION_LOCKED__ &&
 //       (store.dispatch)(...args),
 //   };
 // };

 // const extensionCompose = (config) =>(...funcs) => {
 //   // @ts-expect-error FIXME
 //   return (...args) => {
 //     const instanceId = generateId(config.instanceId);
 //     return [preEnhancer(instanceId), ...funcs].reduceRight(
 //       (composed, f) => f(composed),
 //       window.__REDUX_DEVTOOLS_EXTENSION__({ ...config, instanceId })(...args),
 //     );
 //   };
 // };

 // function reduxDevtoolsExtensionCompose(...funcs) {
 //   if (funcs.length === 0) {
 //     return __REDUX_DEVTOOLS_EXTENSION__();
 //   }
 //   if (funcs.length === 1 && typeof funcs[0] === 'object') {
 //     return extensionCompose(funcs[0]);
 //   }
 //   return extensionCompose({})(...(funcs));
 // }

 // window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ = reduxDevtoolsExtensionCompose;